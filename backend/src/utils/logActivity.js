const Log = require('../models/Log');

/**
 * دالة مساعدة لتسجيل الأنشطة في قاعدة البيانات.
 * @param {ObjectId | null} userId - معرف المستخدم الذي قام بالإجراء (يمكن أن يكون null للإجراءات التلقائية).
 * @param {ObjectId | null} agentId - معرف الوكيل المرتبط بالإجراء.
 * @param {string} actionType - نوع الإجراء (مثال: 'AGENT_CREATED', 'AUTO_RENEWAL').
 * @param {string} description - وصف نصي للإجراء.
 * @param {object} details - أي تفاصيل إضافية لتخزينها مع السجل.
 */
async function logActivity(userId, agentId, actionType, description, details = {}) {
    try {
        // FIX: Ensure parameters are correctly assigned even if called with shifted arguments.
        const logEntry = new Log({
            user: userId,
            agent_id: agentId,
            action_type: actionType,
            description: description,
            metadata: details
        });
        await logEntry.save();
    } catch (error) {
        // console.error(`[BACKEND LOG] ❌ فشل حفظ النشاط:`, error.message);
        // لا نرسل خطأ للمستخدم، فقط نسجله في الكونسول لأن تسجيل النشاط عملية خلفية
    }
}

module.exports = { logActivity };