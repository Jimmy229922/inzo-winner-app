const Competition = require('../models/Competition');
const Agent = require('../models/agent.model');
const CompetitionTemplate = require('../models/CompetitionTemplate'); // NEW: Import the template model

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
    const durationMap = { '24h': 1, '48h': 2, '168h': 7 };
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

        // --- REFACTOR: Integrate classification filter into the main query for efficiency and correctness ---
        if (classification && classification !== 'all') {
            // Find agents with the specified classification first
            const classifiedAgents = await Agent.find({ classification: classification }).select('_id');
            const classifiedAgentIds = classifiedAgents.map(a => a._id);
            // Add this condition to the main query
            query.agent_id = { $in: classifiedAgentIds };
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

        const count = await Competition.countDocuments(query);

        res.json({
            data: formattedCompetitions,
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
        console.log(`[Competition Controller Debug] createCompetition received duration: ${req.body.duration}`);
        const { agent_id, template_id } = req.body;

        // --- NEW: Server-side check to prevent duplicate competitions ---
        if (agent_id && template_id) {
            const existingCompetition = await Competition.findOne({ agent_id, template_id });
            if (existingCompetition) {
                return res.status(409).json({
                    message: 'Conflict: A competition with this template has already been sent to this agent.',
                    error: 'Duplicate competition entry.'
                });
            }
        }

        const competitionData = req.body;
        
        // Calculate ends_at on the backend for consistency and accuracy.
        const endsAtUTC = calculateEndsAtUTC(competitionData.duration);
        if (!endsAtUTC) {
            return res.status(400).json({ message: 'Invalid competition duration provided.' });
        }
        competitionData.ends_at = endsAtUTC;

        const competition = new Competition(competitionData);

        await competition.save();

        // --- NEW: Increment template usage count and archive if limit is reached ---
        if (req.body.template_id) {
            const template = await CompetitionTemplate.findById(req.body.template_id);
            if (template) {
                template.usage_count = (template.usage_count || 0) + 1;

                // Archive if usage limit is met or exceeded
                if (template.usage_limit !== null && template.usage_count >= template.usage_limit) {
                    template.is_archived = true;
                }

                await template.save();
            }
        }
        res.status(201).json({ data: competition });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create competition.', error: error.message });
    }
};

exports.updateCompetition = async (req, res) => {
    try {
        const competitionBeforeUpdate = await Competition.findById(req.params.id).lean();
        if (!competitionBeforeUpdate) {
            return res.status(404).json({ message: 'Competition not found.' });
        }

        const updatedCompetition = await Competition.findByIdAndUpdate(req.params.id, req.body, { new: true });

        // --- FIX: Add activity logging for competition updates ---
        const userId = req.user?._id;
        if (userId && updatedCompetition) {
            const changes = Object.entries(req.body).map(([field, newValue]) => {
                const oldValue = competitionBeforeUpdate[field];
                if (String(oldValue) !== String(newValue)) {
                    return `حقل "${field}" تغير من "${oldValue}" إلى "${newValue}"`;
                }
                return null;
            }).filter(Boolean);

            if (changes.length > 0) {
                const description = `تم تحديث مسابقة "${updatedCompetition.name}":\n${changes.join('\n')}`;
                await logActivity(userId, updatedCompetition.agent_id, 'COMPETITION_UPDATE', description);
            }
        }

        res.json({ data: updatedCompetition });
    } catch (error) {
        res.status(400).json({ message: 'Failed to update competition.', error: error.message });
    }
};

exports.deleteCompetition = async (req, res) => {
    try {
        const competition = await Competition.findByIdAndDelete(req.params.id);
        // --- FIX: Log this action ---
        const userId = req.user?._id;
        if (userId && competition) {
            await logActivity(userId, competition.agent_id, 'COMPETITION_DELETED', `تم حذف المسابقة: ${competition.name}.`);
        }
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

/**
 * NEW: Checks if a competition for a specific agent and template already exists.
 */
exports.checkCompetitionExistence = async (req, res) => {
    const { agent_id, template_id } = req.query;

    if (!agent_id || !template_id) {
        return res.status(400).json({ message: 'Agent ID and Template ID are required.' });
    }

    try {
        const existingCompetition = await Competition.findOne({ agent_id, template_id });
        res.json({ exists: !!existingCompetition });
    } catch (error) {
        res.status(500).json({
            message: 'Server error while checking for competition existence.',
            error: error.message
        });
    }
};

/**
 * NEW: Uploads an image for a competition.
 */
exports.uploadImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
        const imageUrl = `/uploads/competitions/${req.file.filename}`;
        res.status(200).json({ imageUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error while handling image upload.', error: error.message });
    }
};