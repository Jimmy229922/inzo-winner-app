const Competition = require('../models/Competition');
const Agent = require('../models/Agent');
const Template = require('../models/Template');

/**
 * Calculates the UTC end date for a competition based on local timezone logic.
 * @param {string} duration - The duration string (e.g., '1d', '2d', '1w').
 * @param {number} tzOffsetHours - The timezone offset in hours (e.g., 3 for Egypt).
 * @returns {string|null} The ISO string of the calculated end date in UTC, or null.
 */
function calculateEndsAtUTC(duration, tzOffsetHours = 3) {
    const msDay = 86400000;

    // FIX: Correctly get the start of the current local day.
    const localToday = new Date();
    localToday.setHours(0, 0, 0, 0);
    const localDayStartMs = localToday.getTime(); // This gives the timestamp for the start of the local day.
    const durationMap = { '1d': 1, '2d': 2, '1w': 7 };
    const durationDays = durationMap[duration];
    if (durationDays === undefined) return null;

    // The competition ends at the start of the day *after* the duration ends.
    // The winner selection date is the day *after* the competition's actual end date.
    // So, winner_selection_date = creation_date + duration_days + 1.
    const winnerLocalStartMs = localDayStartMs + (durationDays + 1) * msDay; // This logic is correct

    const winnerUtcMs = winnerLocalStartMs; // The timestamp is already correct relative to UTC
    return new Date(winnerUtcMs).toISOString();
}

exports.getAllCompetitions = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, classification, sort, excludeStatus, agentId } = req.query;

        let query = {};

        if (agentId) {
            query.agent_id = agentId;
        }

        if (search) {
            const agents = await Agent.find({ name: { $regex: search, $options: 'i' } }).select('_id');
            const agentIds = agents.map(a => a._id);
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { agent_id: { $in: agentIds } }
            ];
        }

        if (status && status !== 'all') {
            query.is_active = status === 'active';
        }

        if (excludeStatus) {
            query.status = { $ne: excludeStatus };
        }

        let sortOptions = { createdAt: -1 };
        if (sort === 'name_asc') sortOptions = { name: 1 };

        const competitions = await Competition.find(query)
            .populate('agent_id', 'name avatar_url classification')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // Rename agent_id to agents and handle deleted agents
        const formattedCompetitions = competitions.map(comp => {
            const { agent_id, ...rest } = comp;
            return {
                ...rest,
                agents: agent_id || {
                    name: 'وكيل محذوف',
                    classification: 'غير متاح',
                    avatar_url: null
                },
                id: comp._id
            };
        });

        // Filter by classification after populating
        let finalCompetitions = formattedCompetitions;
        if (classification && classification !== 'all') {
            finalCompetitions = formattedCompetitions.filter(c => c.agents && c.agents.classification === classification);
        }

        const count = await Competition.countDocuments(query);

        res.json({
            data: finalCompetitions,
            count: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching competitions.', error: error.message });
    }
};

exports.createCompetition = async (req, res) => {
    try {
        const competitionData = req.body;
        
        // Calculate ends_at on the backend for consistency and accuracy.
        const endsAtUTC = calculateEndsAtUTC(competitionData.duration);
        if (!endsAtUTC) {
            return res.status(400).json({ message: 'Invalid competition duration provided.' });
        }
        competitionData.ends_at = endsAtUTC;

        const competition = new Competition(competitionData);

        await competition.save();

        // TODO: Increment usage_count on the template
        res.status(201).json({ data: competition });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create competition.', error: error.message });
    }
};

exports.updateCompetition = async (req, res) => {
    try {
        const updatedCompetition = await Competition.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedCompetition) return res.status(404).json({ message: 'Competition not found.' });
        res.json({ data: updatedCompetition });
    } catch (error) {
        res.status(400).json({ message: 'Failed to update competition.', error: error.message });
    }
};

exports.deleteCompetition = async (req, res) => {
    try {
        const competition = await Competition.findByIdAndDelete(req.params.id);
        if (!competition) return res.status(404).json({ message: 'Competition not found.' });
        res.json({ message: 'Competition deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete competition.', error: error.message });
    }
};

exports.bulkUpdateCompetitions = async (req, res) => {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || !data) {
        return res.status(400).json({ message: 'Invalid request body for bulk update.' });
    }
    try {
        await Competition.updateMany({ _id: { $in: ids } }, { $set: data });
        res.json({ message: 'Competitions updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to bulk update competitions.', error: error.message });
    }
};

exports.bulkDeleteCompetitions = async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ message: 'Invalid request body for bulk delete.' });
    }
    try {
        await Competition.deleteMany({ _id: { $in: ids } });
        res.json({ message: 'Competitions deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to bulk delete competitions.', error: error.message });
    }
};