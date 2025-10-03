const mongoose = require('mongoose');

const CompetitionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    is_active: { type: Boolean, default: true },
    status: {
        type: String,
        enum: ['sent', 'awaiting_winners', 'completed', 'archived'],
        default: 'sent'
    },
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    total_cost: { type: Number, default: 0 },
    ends_at: { type: Date },
    winners_count: { type: Number, default: 0 },
    prize_per_winner: { type: Number, default: 0 },
    correct_answer: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Competition', CompetitionSchema);