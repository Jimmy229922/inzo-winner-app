const addCompetitionsPerWeek = require('./migration-add-competitions-per-week');
const backfillCompetitionTypes = require('./migration-backfill-competition-types');

/**
 * This runner executes all migration scripts in order.
 * It's designed to be called once on server startup.
 */
const runAllMigrations = async () => {
    await addCompetitionsPerWeek();
    // Skip migration-fix-template-types to preserve Arabic types
    // await migrateTemplateTypes();
    await backfillCompetitionTypes();
};

module.exports = runAllMigrations;