const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    agent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['sent', 'active', 'completed', 'archived'],
        default: 'sent'
    },
    total_cost: {
        type: Number,
        default: 0
    },
    ends_at: {
        type: Date
    },
    winners_count: {
        type: Number,
        default: 0
    },
    prize_per_winner: {
        type: Number,
        default: 0
    },
    deposit_winners_count: {
        type: Number,
        default: 0
    },
    correct_answer: {
        type: String
    },
    views_count: {
        type: Number,
        default: 0
    },
    reactions_count: {
        type: Number,
        default: 0
    },
    participants_count: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Competition', competitionSchema);