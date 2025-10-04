const Log = require('../models/Log');

/**
 * @desc    Get all logs with pagination and filtering
 * @route   GET /api/logs
 * @access  Private
 */
exports.getAllLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, agent_id } = req.query;
        const query = {};

        if (agent_id) {
            query.agent_id = agent_id;
        }

        const logs = await Log.find(query)
            .populate('user', 'full_name') // جلب اسم المستخدم المرتبط بالسجل
            .populate('agent_id', 'name') // جلب اسم الوكيل المرتبط بالسجل
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((page - 1) * parseInt(limit))
            .lean();

        const count = await Log.countDocuments(query);

        // تحويل البيانات لتتوافق مع الواجهة الأمامية
        const formattedLogs = logs.map(log => ({
            ...log,
            user_name: log.user ? log.user.full_name : 'النظام', // إضافة حقل user_name
            agent: log.agent_id // إعادة تسمية agent_id إلى agent
        }));

        res.json({ data: formattedLogs, count });

    } catch (error) {
        console.error("Error fetching logs:", error);
        res.status(500).json({ message: 'Server error while fetching logs.', error: error.message });
    }
};

/**
 * @desc    Create a new log entry from the frontend
 * @route   POST /api/logs
 * @access  Private
 */
exports.createLog = async (req, res) => {
    try {
        const { agentId, action_type, description, metadata } = req.body;

        const logEntry = new Log({
            user: req.user._id, // إصلاح: استخدام _id بدلاً من id لجلب هوية المستخدم
            agent_id: agentId,
            action_type: action_type,
            description: description,
            details: metadata || {}
        });

        await logEntry.save();
        res.status(201).json({ message: 'Log created successfully', data: logEntry });
    } catch (error) {
        console.error("Error creating log:", error);
        res.status(500).json({ message: 'Server error while creating log.', error: error.message });
    }
};