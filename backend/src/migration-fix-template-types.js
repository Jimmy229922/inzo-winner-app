const CompetitionTemplate = require('./models/CompetitionTemplate');
const mongoose = require('mongoose');

/**
 * Migration: Normalize template types and extract deposit bonus percentage.
 * - Converts Arabic legacy types ("مميزات","تفاعلية") to new standardized types:
 *   * If has deposit_bonus_prize_details -> type = 'deposit'
 *   * Else keep 'trading' for "تفاعلية" and 'general' for others
 * - Extracts percentage from deposit_bonus_prize_details into bonus_percentage
 */
module.exports = async function migrateTemplateTypes() {
  console.log('\n[Migration] Starting migrateTemplateTypes (no transactions)...');
  try {
    const templates = await CompetitionTemplate.find({});
    let updatedCount = 0;
    for (const tpl of templates) {
      let changed = false;
      if (tpl.type === 'مميزات') { tpl.type = 'general'; changed = true; }
      else if (tpl.type === 'تفاعلية') { tpl.type = 'trading'; changed = true; }
      if (tpl.deposit_bonus_prize_details && /%/.test(tpl.deposit_bonus_prize_details)) {
        tpl.type = 'deposit';
        const match = tpl.deposit_bonus_prize_details.match(/(40|50|60|75|85)\s*%/);
        if (match) { tpl.bonus_percentage = parseInt(match[1], 10); changed = true; }
      }
      if (changed) { await tpl.save(); updatedCount++; }
    }
    console.log(`[Migration] migrateTemplateTypes completed. Updated templates: ${updatedCount}`);
  } catch (err) {
    console.error('[Migration] migrateTemplateTypes failed:', err);
  }
};
