const Winner = require('../models/Winner');
const Agent = require('../models/agent.model');
const Competition = require('../models/Competition');

// GET /api/agents/:agentId/winners
exports.getWinnersByAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { competition_id } = req.query;
        if (!agentId) return res.status(400).json({ message: 'agentId is required' });

        let query = { agent_id: agentId };
        if (competition_id) {
            query.competition_id = competition_id;
        }

        // Find winners for this agent and populate competition info (name + description as question)
        const winners = await Winner.find(query)
            .populate('competition_id', 'name description')
            .lean();

        // Group by competition
        const compsMap = new Map();
        winners.forEach(w => {
            const compId = (w.competition_id && w.competition_id._id) ? String(w.competition_id._id) : String(w.competition_id);
            if (!compsMap.has(compId)) {
                compsMap.set(compId, {
                    id: compId,
                    title: (w.competition_id && w.competition_id.name) ? w.competition_id.name : 'غير معروف',
                    question: (w.competition_id && w.competition_id.description) ? w.competition_id.description : null,
                    winners: []
                });
            }
            compsMap.get(compId).winners.push({
                id: String(w._id),
                name: w.name,
                account_number: w.account_number,
                email: w.email,
                national_id: w.national_id,
                national_id_image: w.national_id_image,
                prize_type: w.prize_type, // Include prize_type
                prize_value: w.prize_value, // Include prize_value
                selected_at: w.selected_at,
                video_url: w.video_url, // Include video_url
                meta: w.meta
            });
        });

        const competitions = Array.from(compsMap.values());
        res.json({ competitions });
    } catch (err) {
        console.error('Failed to get winners by agent:', err);
        res.status(500).json({ message: 'Server error fetching winners' });
    }
};

// POST /api/agents/:agentId/winners/import
exports.importWinnersForAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const payload = req.body;

        if (!agentId) return res.status(400).json({ message: 'agentId is required' });
        if (!payload || !Array.isArray(payload.winners) || payload.winners.length === 0) {
            return res.status(400).json({ message: 'winners array is required in body' });
        }

        // Authorization: only allow super_admin or admin to import winners
        const user = req.user || {};
        if (!user.role || !['super_admin', 'admin'].includes(user.role)) {
            return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
        }

        const agent = await Agent.findById(agentId).lean();
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        // Find the agent's active competition - all winners must be associated with a real competition
        let activeCompetition = null;
        try {
            activeCompetition = await Competition.findOne({
                agent_id: agentId,
                status: { $in: ['sent', 'active', 'awaiting_winners'] },
                is_active: true
            }).sort({ created_at: -1 }).lean();
        } catch (e) {
            console.warn('[importWinnersForAgent] Failed to fetch active competition:', e);
        }

        if (!activeCompetition || !activeCompetition._id) {
            return res.status(400).json({ 
                message: 'No active competition found for this agent. Winners can only be imported to an active competition.' 
            });
        }

        console.log(`[importWinnersForAgent] Using active competition ${activeCompetition._id} (${activeCompetition.name})`);
        const mongoose = require('mongoose');
        const competitionId = activeCompetition._id;

        const docs = payload.winners.map(w => ({
            agent_id: agentId,
            competition_id: competitionId,
            name: w.name,
            account_number: w.account_number,
            email: w.email || (w.meta && w.meta.email) || null,
            national_id: w.national_id || (w.meta && w.meta.national_id) || null,
            prize_type: w.prize_type || (w.meta && w.meta.prize_type) || null,
            prize_value: typeof w.prize_value !== 'undefined' ? w.prize_value : (w.meta && w.meta.prize_value) || null,
            selected_at: w.selected_at ? new Date(w.selected_at) : new Date(),
            // Keep meta for backward compatibility and extra data
            meta: Object.assign({}, w.meta || {}, {
                email: w.email || (w.meta && w.meta.email) || null,
                national_id: w.national_id || (w.meta && w.meta.national_id) || null,
                prize_type: w.prize_type || (w.meta && w.meta.prize_type) || null,
                prize_value: typeof w.prize_value !== 'undefined' ? w.prize_value : (w.meta && w.meta.prize_value) || null,
                original_import_id: w.id || (w.meta && w.meta.original_import_id) || null
            })
        }));

        const inserted = await Winner.insertMany(docs, { ordered: false });

        // Update competition winners_count and selection timestamp
        try {
            // FIX: Do NOT increment winners_count as it represents the TARGET number of winners, not the current count.
            // We only update the timestamp.
            const update = {};
            const compDoc = await Competition.findById(competitionId);
            if (compDoc) {
                if (!compDoc.winners_selected_at) {
                    compDoc.winners_selected_at = new Date();
                    compDoc.processed_at = compDoc.winners_selected_at;
                    await compDoc.save();
                }
            }
        } catch (e) {
            console.warn('[importWinnersForAgent] Failed to update competition selection timestamp:', e);
        }

        res.json({ 
            inserted: inserted.length, 
            winners: inserted, // Return the created winners
            competition: { 
                id: activeCompetition._id, 
                name: activeCompetition.name 
            } 
        });
    } catch (err) {
        console.error('Failed to import winners:', err);
        res.status(500).json({ message: 'Server error importing winners', error: err.message });
    }
};

// DELETE /api/agents/:agentId/winners/:winnerId
exports.deleteWinner = async (req, res) => {
    try {
        const { agentId, winnerId } = req.params;
        if (!agentId || !winnerId) return res.status(400).json({ message: 'agentId and winnerId are required' });

        // Authorization: allow admin/super_admin or users with explicit permissions
        const user = req.user || {};
        if (!user.role || !['super_admin', 'admin'].includes(user.role)) {
            return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
        }

        const winner = await Winner.findById(winnerId);
        if (!winner) return res.status(404).json({ message: 'Winner not found' });
        if (String(winner.agent_id) !== String(agentId)) {
            return res.status(400).json({ message: 'Winner does not belong to the specified agent' });
        }

        const compId = winner.competition_id;

        await Winner.findByIdAndDelete(winnerId);

        // Decrement competition counters if competition exists
        if (compId) {
            try {
                // Decrement winners_count. Also try to decrement deposit/trading counters if meta.prizeType exists
                const update = { $inc: { winners_count: -1 } };
                if (winner.meta && winner.meta.prizeType === 'deposit') update.$inc.deposit_winners_count = -1;
                if (winner.meta && winner.meta.prizeType === 'trading') update.$inc.trading_winners_count = -1;
                await Competition.findByIdAndUpdate(compId, update);
            } catch (e) {
                // ignore update errors
            }
        }

        res.json({ deleted: true });
    } catch (err) {
        console.error('Failed to delete winner:', err);
        res.status(500).json({ message: 'Server error deleting winner' });
    }
};

// POST /api/winners/:id/video
exports.uploadWinnerVideo = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ message: 'No video file uploaded' });
        }

        const videoUrl = `/uploads/winners/${req.file.filename}`;
        
        const winner = await Winner.findByIdAndUpdate(
            id,
            { video_url: videoUrl },
            { new: true }
        );

        if (!winner) {
            return res.status(404).json({ message: 'Winner not found' });
        }

        res.json({ 
            message: 'Video uploaded successfully',
            video_url: videoUrl,
            winner
        });
    } catch (err) {
        console.error('Failed to upload winner video:', err);
        res.status(500).json({ message: 'Server error uploading video' });
    }
};

// POST /api/winners/:id/id-image
exports.uploadWinnerIdImage = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ message: 'No ID image file uploaded' });
        }

        const idImageUrl = `/uploads/winners/${req.file.filename}`;
        
        const winner = await Winner.findByIdAndUpdate(
            id,
            { national_id_image: idImageUrl },
            { new: true }
        );

        if (!winner) {
            return res.status(404).json({ message: 'Winner not found' });
        }

        res.json({ 
            message: 'ID image uploaded successfully',
            national_id_image: idImageUrl,
            winner
        });
    } catch (err) {
        console.error('Failed to upload winner ID image:', err);
        res.status(500).json({ message: 'Server error uploading ID image' });
    }
};

// PUT /api/winners/:id
exports.updateWinner = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Prevent updating immutable fields if necessary, but for now allow editing details
        // Map frontend fields to backend fields if needed, or assume payload matches schema
        // Frontend sends: name, account_number, email, prize_type, prize_value
        
        const allowedUpdates = ['name', 'account_number', 'email', 'national_id', 'prize_type', 'prize_value', 'meta'];
        const updateData = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updateData[key] = updates[key];
            }
        });

        // Also update meta if provided or merge it
        if (updates.meta) {
            updateData.meta = updates.meta;
        }

        const winner = await Winner.findByIdAndUpdate(id, updateData, { new: true });

        if (!winner) {
            return res.status(404).json({ message: 'Winner not found' });
        }

        res.json({ 
            message: 'Winner updated successfully',
            winner
        });
    } catch (err) {
        console.error('Failed to update winner:', err);
        res.status(500).json({ message: 'Server error updating winner' });
    }
};
