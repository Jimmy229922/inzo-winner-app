const cron = require('node-cron');
const { renewEligibleAgentBalances } = require('../controllers/agent.controller');

/**
 * [للتجربة فقط]
 * هذه المهمة المجدولة تعمل كل 10 ثوانٍ لاختبار منطق تجديد رصيد الوكلاء.
 * يجب تعطيلها في بيئة الإنتاج.
 */
const startAgentRenewalTestJob = () => {
    console.log('[Scheduler] Agent renewal TEST job initialized. Will run every 10 seconds.');
    // جدولة للعمل كل 10 ثوانٍ.
    cron.schedule('*/10 * * * * *', renewEligibleAgentBalances);
};

module.exports = { startAgentRenewalTestJob };