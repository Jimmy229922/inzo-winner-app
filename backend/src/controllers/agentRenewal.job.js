const cron = require('node-cron');
const { renewEligibleAgentBalances } = require('../controllers/agent.controller');

/**
 * This cron job runs every hour to check for and renew agent balances.
 * The logic inside renewEligibleAgentBalances will determine if an agent's
 * renewal period (weekly, monthly, etc.) has passed.
 */
const startAgentRenewalJob = () => {
    console.log('[Scheduler] Agent renewal job initialized. Will run every hour.');
    // Schedule to run at the beginning of every hour.
    cron.schedule('0 * * * *', renewEligibleAgentBalances);
};

module.exports = { startAgentRenewalJob };