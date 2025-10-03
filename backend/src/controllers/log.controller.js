
const Log = require('../models/Log');

exports.getAllLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, sort = 'newest', populate } = req.query;
        
        const sortOptions = {};
        if (sort === 'newest') {
            sortOptions.createdAt = -1;
        }

        let query = Log.find()
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((page - 1) * limit);

        if (populate === 'agent') {
            query = query.populate('agent', 'name');
        }

        const logs = await query.lean();
        const count = await Log.countDocuments();

        res.json({
            data: logs,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching logs.', error: error.message });
    }
};
                