const addCompetitionsPerWeek = require('./migration-add-competitions-per-week');

/**
 * This runner executes all migration scripts in order.
 * It's designed to be called once on server startup.
 */
const runAllMigrations = async () => {
    await addCompetitionsPerWeek();
};

module.exports = runAllMigrations;