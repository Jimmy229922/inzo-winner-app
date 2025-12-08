const Agent = require('../models/agent.model');
const Competition = require('../models/Competition');
const Task = require('../models/Task');

/**
 * @desc    جلب جميع بيانات الوكلاء والمهام الأسبوعية الحالية
 * @route   GET /api/calendar/data
 * @access  Private
 */
exports.getCalendarData = async (req, res) => {
    try {
        // 1. جلب جميع الوكلاء النشطين
        // --- إصلاح: إزالة شرط أيام التدقيق للسماح بعرض جميع الوكلاء ---
        const agents = await Agent.find({ 
            status: { $ne: 'inactive' }
        }).select(
            '_id agent_id name avatar_url classification audit_days'
        ).lean();
        
        // 2. جلب مهام الأسبوع الحالي فقط
        // --- إصلاح: تقييد البحث بمهام الأسبوع الحالي فقط لمنع تداخل البيانات القديمة ---
        const today = new Date();
        const currentDayOfWeek = today.getDay(); 
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        const agentIds = agents.map(a => a._id);
        const tasks = await Task.find({ 
            agent_id: { $in: agentIds },
            task_date: { $gte: startOfWeek, $lt: endOfWeek }
        }).lean();

        // 3. إرسال البيانات إلى الواجهة الأمامية
        res.json({ agents, tasks });

    } catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب بيانات التقويم.' });
    }
};