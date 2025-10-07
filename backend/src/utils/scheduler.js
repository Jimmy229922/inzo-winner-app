const Competition = require('../models/Competition');
const Agent = require('../models/Agent'); // FIX: Correct path to Agent model
const { logActivity } = require('./logActivity');
const { postToTelegram } = require('./telegram');

/**
 * Checks for competitions that have ended and updates their status.
 * It also sends a notification to the agent to select winners.
 */
async function checkExpiredCompetitions() {
    try {
        // FIX: Use UTC for consistent date comparison across timezones.
        const now = new Date(); // Current time in UTC

        // البحث عن المسابقات التي انتهى يومها
        const expiredCompetitions = await Competition.find({
            status: { $in: ['sent', 'active'] }, // Only process active or sent competitions
            ends_at: { $lte: now } // Find competitions where the end date/time has passed
        }).populate('agent_id', 'name telegram_chat_id');

        // سنظهر رسالة فقط إذا كان هناك مسابقات منتهية
        if (expiredCompetitions.length > 0) {
            console.log(`[Scheduler] Found ${expiredCompetitions.length} expired competitions to process`);
        }

        for (const comp of expiredCompetitions) {
            
            // تحديث حالة المسابقة
            comp.status = 'awaiting_winners';
            comp.processed_at = new Date();
            await comp.save();

            const agent = comp.agent_id;
            if (agent && agent.telegram_chat_id) {
                const clicheText = `دمت بخير شريكنا العزيز ${agent.name}،\n\n` +
                    `انتهت فترة المشاركة في مسابقة "${comp.name}".\n` +
                    `يرجى اختيار الفائزين في المسابقة.\n\n` +
                    `الإجابة الصحيحة هي: ${comp.correct_answer || 'غير محددة'}\n\n` +
                    `ملاحظة: تم إغلاق المشاركة في المسابقة تلقائياً.`;
                
                try {
                    await postToTelegram(clicheText, agent.telegram_chat_id);
                    console.log(`[Scheduler] Sent winner selection request for competition ${comp._id} to agent ${agent.name}`);
                    
                    await logActivity(
                        null,
                        agent._id, 
                        'COMPETITION_EXPIRED', 
                        `تم إغلاق المسابقة "${comp.name}" وإرسال طلب اختيار الفائزين تلقائياً.`
                    );
                } catch (telegramError) {
                    console.error(`[Scheduler] Failed to send Telegram message for competition ${comp._id}:`, telegramError);
                    await logActivity(
                        null,
                        agent._id,
                        'TELEGRAM_ERROR',
                        `فشل إرسال إشعار اختيار الفائزين للمسابقة "${comp.name}"`
                    );
                }
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error checking for expired competitions:', error);
    }
}

/**
 * Starts the scheduler to run the checkExpiredCompetitions function periodically.
 */
function startScheduler() {
    console.log('[Scheduler] Background scheduler started');
    setInterval(checkExpiredCompetitions, 60000); // كل دقيقة
    checkExpiredCompetitions(); // تشغيل فوري عند بدء النظام
}

module.exports = { startScheduler };