const Agent = require('../models/Agent');
const Task = require('../models/Task');

/**
 * @desc    جلب جميع بيانات الوكلاء والمهام الأسبوعية الحالية
 * @route   GET /api/calendar/data
 * @access  Private
 */
exports.getCalendarData = async (req, res) => {
    try {
        // 1. جلب جميع الوكلاء النشطين
        // تعديل: جلب جميع الوكلاء الذين حالتهم ليست "غير نشط"
        // هذا يضمن ظهور الوكلاء الجدد الذين ليس لديهم حقل status بعد
        const agents = await Agent.find({ status: { $ne: 'inactive' } }).select(
            '_id agent_id name avatar_url classification audit_days'
        ).lean();

        // 2. حساب تاريخ بداية ونهاية الأسبوع الحالي (من الأحد إلى السبت)
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const dayOfWeek = today.getUTCDay(); // 0 = Sunday
        
        const startDate = new Date(today);
        startDate.setUTCDate(today.getUTCDate() - dayOfWeek);

        const endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 6);

        // 3. جلب جميع المهام المسجلة خلال هذا الأسبوع
        const tasks = await Task.find({
            task_date: {
                $gte: startDate,
                $lte: endDate,
            },
        }).lean();

        // 4. إرسال البيانات إلى الواجهة الأمامية
        res.json({ agents, tasks });

    } catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب بيانات التقويم.' });
    }
};

/**
 * @desc    إنشاء أو تحديث مهمة (تدقيق أو مسابقة)
 * @route   POST /api/calendar/tasks
 * @access  Private
 */
exports.updateTask = async (req, res) => {
    const { agentId, taskType, status, taskDate } = req.body;

    // التحقق من صحة البيانات المدخلة
    if (!agentId || !taskType || typeof status !== 'boolean' || !taskDate) {
        return res.status(400).json({ message: 'البيانات المرسلة غير مكتملة.' });
    }

    if (taskType !== 'audited' && taskType !== 'competition_sent') {
        return res.status(400).json({ message: 'نوع المهمة غير صحيح.' });
    }

    try {
        const date = new Date(taskDate);
        date.setUTCHours(0, 0, 0, 0);

        // البحث عن المهمة وتحديثها، أو إنشاء مهمة جديدة إذا لم تكن موجودة
        const updatedTask = await Task.findOneAndUpdate(
            {
                agent_id: agentId,
                task_date: date,
            },
            {
                $set: {
                    [taskType]: status,
                    updated_by: req.user.id // حفظ معرف المستخدم الذي قام بالتعديل
                },
            },
            {
                upsert: true, // لإنشاء المستند إذا لم يكن موجوداً
                new: true,    // لإرجاع المستند بعد التحديث
                lean: true
            }
        );

        res.status(200).json({ message: 'تم تحديث المهمة بنجاح.', data: updatedTask });

    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء تحديث المهمة.' });
    }
};