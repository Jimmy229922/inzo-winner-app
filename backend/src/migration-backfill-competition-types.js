const Competition = require('./models/Competition');
const CompetitionTemplate = require('./models/CompetitionTemplate');

/**
 * Migration: Backfill missing competition.type from related template.type
 * - Finds competitions where type is undefined or 'غير محدد'
 * - Loads template and copies its normalized type
 * - Falls back to 'general'
 */
module.exports = async function backfillCompetitionTypes() {
  console.log('\n[Migration] Starting backfillCompetitionTypes ...');
  try {
    // Wait for mongoose connection to be ready
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('[Migration] Waiting for database connection...');
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) resolve();
        else mongoose.connection.once('connected', resolve);
      });
    }

    const toFix = await Competition.find({ $or: [ { type: { $exists: false } }, { type: 'غير محدد' }, { type: null } ] }).limit(500).lean();
    if (!toFix.length) {
      console.log('[Migration] No competitions needing type backfill.');
      return;
    }
    let updated = 0;
    for (const comp of toFix) {
      let newType = 'general';
      if (comp.template_id) {
        try {
          const tpl = await CompetitionTemplate.findById(comp.template_id).lean();
          if (tpl?.type) newType = tpl.type;
        } catch (e) {
          console.warn('[Migration] Failed template lookup for competition', comp._id, e.message);
        }
      }
      await Competition.updateOne({ _id: comp._id }, { $set: { type: newType } });
      updated++;
    }
    console.log(`[Migration] backfillCompetitionTypes updated ${updated} competitions.`);
  } catch (err) {
    console.error('[Migration] backfillCompetitionTypes failed:', err);
  }
};
