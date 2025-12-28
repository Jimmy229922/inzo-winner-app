/**
 * Backfill legacy Agent documents so older agents get new default fields.
 *
 * Safe by default (dry-run). To apply updates:
 *   node backend/scripts/backfill_legacy_agents_defaults.js --apply
 *
 * Optional:
 *   --mongo <uri>  override MongoDB URI
 */

const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');
require('dotenv').config();

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

async function main() {
  const apply = hasFlag('--apply');
  const mongoOverride = getArgValue('--mongo');
  const mongoUri = mongoOverride || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inzo-db';

  console.log('[Legacy Agents Backfill] Mode:', apply ? 'APPLY' : 'DRY-RUN');
  console.log('[Legacy Agents Backfill] Mongo:', mongoUri);

  await mongoose.connect(mongoUri);
  console.log('✓ Connected');

  const total = await Agent.countDocuments({});

  // Missing/blank checks
  const missingCompetitionsPerWeek = await Agent.countDocuments({ $or: [ { competitions_per_week: { $exists: false } }, { competitions_per_week: null } ] });
  const missingAuditDays = await Agent.countDocuments({ $or: [ { audit_days: { $exists: false } }, { audit_days: null } ] });
  const missingAuditingFlag = await Agent.countDocuments({ $or: [ { is_auditing_enabled: { $exists: false } }, { is_auditing_enabled: null } ] });
  const missingCompetitionDuration = await Agent.countDocuments({ competition_duration: { $exists: false } });
  const missingAgentNumber = await Agent.countDocuments({ $or: [ { agent_id: { $exists: false } }, { agent_id: null }, { agent_id: '' } ] });
  const missingClassification = await Agent.countDocuments({ $or: [ { classification: { $exists: false } }, { classification: null }, { classification: '' } ] });

  console.log('\n[Legacy Agents Backfill] Summary');
  console.log('  - Total agents:', total);
  console.log('  - Missing competitions_per_week:', missingCompetitionsPerWeek);
  console.log('  - Missing audit_days:', missingAuditDays);
  console.log('  - Missing is_auditing_enabled:', missingAuditingFlag);
  console.log('  - Missing competition_duration:', missingCompetitionDuration);
  console.log('  - Missing classification:', missingClassification);
  console.log('  - Missing agent_id (agent number):', missingAgentNumber);

  // Fast set-based defaults for simple fields
  const updates = [];

  updates.push({
    name: 'audit_days default []',
    filter: { $or: [ { audit_days: { $exists: false } }, { audit_days: null } ] },
    update: { $set: { audit_days: [] } }
  });

  updates.push({
    name: 'is_auditing_enabled default false',
    filter: { $or: [ { is_auditing_enabled: { $exists: false } }, { is_auditing_enabled: null } ] },
    update: { $set: { is_auditing_enabled: false } }
  });

  updates.push({
    name: 'competition_duration default null',
    filter: { competition_duration: { $exists: false } },
    update: { $set: { competition_duration: null } }
  });

  updates.push({
    name: 'classification default R',
    filter: { $or: [ { classification: { $exists: false } }, { classification: null }, { classification: '' } ] },
    update: { $set: { classification: 'R' } }
  });

  // Numeric defaults used widely across the app
  const numericDefaults = {
    competition_bonus: 0,
    deposit_bonus_percentage: 0,
    deposit_bonus_count: 0,
    remaining_balance: 0,
    consumed_balance: 0,
    remaining_deposit_bonus: 0,
    used_deposit_bonus: 0,
    single_competition_balance: 0,
    winners_count: 0,
    prize_per_winner: 0,
    deposit_bonus_winners_count: 0
  };

  for (const [field, value] of Object.entries(numericDefaults)) {
    updates.push({
      name: `${field} default ${value}`,
      filter: { $or: [ { [field]: { $exists: false } }, { [field]: null } ] },
      update: { $set: { [field]: value } }
    });
  }

  // competitions_per_week depends on classification -> do per-document
  const agentsNeedingCompetitionsPerWeek = await Agent.find({ $or: [ { competitions_per_week: { $exists: false } }, { competitions_per_week: null } ] }).select('_id classification competitions_per_week').lean();

  // agent_id backfill: assign next numeric id for missing
  const agentsMissingAgentNumber = await Agent.find({ $or: [ { agent_id: { $exists: false } }, { agent_id: null }, { agent_id: '' } ] }).select('_id agent_id name').lean();

  let maxNumericAgentId = 0;
  if (agentsMissingAgentNumber.length > 0) {
    const existing = await Agent.find({ agent_id: { $exists: true, $ne: null, $ne: '' } }).select('agent_id').lean();
    for (const a of existing) {
      const n = parseInt(a.agent_id, 10);
      if (!Number.isNaN(n)) maxNumericAgentId = Math.max(maxNumericAgentId, n);
    }
    if (maxNumericAgentId === 0) maxNumericAgentId = 1000;
  }

  if (!apply) {
    console.log('\n[Legacy Agents Backfill] DRY-RUN details');
    console.log('  - Would update competitions_per_week for:', agentsNeedingCompetitionsPerWeek.length);
    console.log('  - Would backfill agent_id for:', agentsMissingAgentNumber.length);
    if (agentsMissingAgentNumber.length > 0) {
      console.log('  - Next agent_id start (approx):', maxNumericAgentId + 1);
      console.log('  - Sample missing agent_id:', agentsMissingAgentNumber.slice(0, 5).map(a => ({ _id: String(a._id), name: a.name })));
    }

    await mongoose.connection.close();
    console.log('\n✓ Done (dry-run). Run with --apply to write changes.');
    process.exit(0);
  }

  console.log('\n[Legacy Agents Backfill] Applying simple defaults...');
  for (const u of updates) {
    const res = await Agent.updateMany(u.filter, u.update);
    if (res.modifiedCount > 0) {
      console.log(`  ✓ ${u.name}: modified ${res.modifiedCount} (matched ${res.matchedCount})`);
    }
  }

  console.log('\n[Legacy Agents Backfill] Applying competitions_per_week...');
  let cpwUpdated = 0;
  for (const agent of agentsNeedingCompetitionsPerWeek) {
    const classification = (agent.classification || 'R').toString().toUpperCase();
    const competitions_per_week = (classification === 'R' || classification === 'A') ? 2 : 1;
    const res = await Agent.updateOne(
      { _id: agent._id, $or: [ { competitions_per_week: { $exists: false } }, { competitions_per_week: null } ] },
      { $set: { competitions_per_week } }
    );
    if (res.modifiedCount > 0) cpwUpdated++;
  }
  console.log(`  ✓ competitions_per_week updated: ${cpwUpdated}`);

  console.log('\n[Legacy Agents Backfill] Applying agent_id backfill...');
  let agentIdUpdated = 0;
  const used = new Set();
  if (agentsMissingAgentNumber.length > 0) {
    const existing = await Agent.find({ agent_id: { $exists: true, $ne: null, $ne: '' } }).select('agent_id').lean();
    for (const a of existing) used.add(String(a.agent_id));

    let next = maxNumericAgentId + 1;
    for (const a of agentsMissingAgentNumber) {
      // Find the next free numeric id
      while (used.has(String(next))) next++;
      const newAgentId = String(next);

      const res = await Agent.updateOne(
        { _id: a._id, $or: [ { agent_id: { $exists: false } }, { agent_id: null }, { agent_id: '' } ] },
        { $set: { agent_id: newAgentId } }
      );

      if (res.modifiedCount > 0) {
        agentIdUpdated++;
        used.add(newAgentId);
        next++;
      }
    }
  }
  console.log(`  ✓ agent_id backfilled: ${agentIdUpdated}`);

  // Final verification
  const missingAfter = await Agent.countDocuments({ $or: [ { competitions_per_week: { $exists: false } }, { competitions_per_week: null } ] });
  const missingAgentIdAfter = await Agent.countDocuments({ $or: [ { agent_id: { $exists: false } }, { agent_id: null }, { agent_id: '' } ] });

  console.log('\n[Legacy Agents Backfill] Verification');
  console.log('  - competitions_per_week still missing:', missingAfter);
  console.log('  - agent_id still missing:', missingAgentIdAfter);

  await mongoose.connection.close();
  console.log('\n✓ Done!');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error:', err);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
