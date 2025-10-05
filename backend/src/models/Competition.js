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
        enum: ['sent', 'active', 'awaiting_winners', 'completed', 'archived'],
        default: 'sent'
    },
    duration: {
        type: String,
        enum: ['1d', '2d', '1w']
    },
    total_cost: {
        type: Number,
        default: 0
    },
    ends_at: {
        type: Date,
        required: true
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
    },
    processed_at: {
        type: Date,
        default: null
    },
    template_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template'
    }
}, {
    timestamps: true
});

// إضافة دالة مساعدة للتحقق من حالة المسابقة
competitionSchema.methods.isExpired = function() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.ends_at < now;
};

module.exports = mongoose.model('Competition', competitionSchema);