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
        // 1. جلب الوكلاء الذين لديهم مهام مجدولة فقط
        // --- إصلاح: جلب الوكلاء الذين لديهم أيام تدقيق محددة فقط ---
        // هذا يضمن أن القائمة تحتوي فقط على الوكلاء ذوي الصلة بالتقويم، مما يحل مشكلة عدم تطابق الأعداد.
        const agents = await Agent.find({ 
            status: { $ne: 'inactive' },
            // التأكد من أن حقل أيام التدقيق موجود وليس فارغاً
            audit_days: { $exists: true, $not: { $size: 0 } } 
        }).select(
            '_id agent_id name avatar_url classification audit_days'
        ).lean();

        // 2. جلب جميع المهام المسجلة للوكلاء الذين تم جلبهم للأسبوع الحالي فقط
        // --- إصلاح: إعادة التقييد بتاريخ الأسبوع الحالي ---
        // هذا يضمن أن الواجهة الأمامية تعرض فقط حالة المهام للأسبوع الحالي،
        // مما يمنع تداخل البيانات القديمة مع الحالة الحالية.
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // Sunday = 0
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDayOfWeek);
        sunday.setHours(0, 0, 0, 0);
        
        const nextSunday = new Date(sunday);
        nextSunday.setDate(sunday.getDate() + 7);

        const agentIds = agents.map(a => a._id);
        const tasks = await Task.find({ 
            agent_id: { $in: agentIds },
            task_date: { $gte: sunday, $lt: nextSunday }
        }).lean();

        // 3. إرسال البيانات إلى الواجهة الأمامية
        res.json({ agents, tasks });

    } catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب بيانات التقويم.' });
    }
};