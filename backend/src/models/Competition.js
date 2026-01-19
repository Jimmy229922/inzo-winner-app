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
        enum: ['5s', '10s', '1d', '2d', '1w'] // Added '10s' duration for extended testing
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
    trading_winners_count: {
        type: Number,
        default: 0
    },
    deposit_bonus_percentage: {
        type: Number,
        default: 0
    },
    // عدد الفائزين المطلوب اختيارهم لهذه المسابقة
    required_winners: {
        type: Number,
        default: 3,
        min: 1
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
    // نوع المسابقة (يُشتق من القالب). نخزن القيم بالعربية: 'مميزات' | 'تفاعلية'
    type: {
        type: String,
        trim: true
    },
    processed_at: {
        type: Date,
        default: null
    },
    winner_request_sent_at: {
        type: Date,
        default: null
    },
    winners_selected_at: {
        type: Date,
        default: null
    },
    restored_at: {
        type: Date,
        default: null
    },
    // سجل كل مرات الاسترجاع
    restore_history: [{
        restored_at: { type: Date, default: Date.now },
        restored_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        restored_by_name: { type: String }
    }],
    // نسخة كاملة من البيانات عند اكتمال المسابقة للاسترجاع المستقبلي
    completion_snapshot: {
        // بيانات الوكيل وقت الاكتمال
        agent: {
            _id: { type: mongoose.Schema.Types.ObjectId },
            name: { type: String },
            agent_id: { type: Number },
            chat_id: { type: String },
            avatar_url: { type: String }
        },
        // بيانات الفائزين الكاملة
        winners: [{
            _id: { type: mongoose.Schema.Types.ObjectId },
            name: { type: String },
            account_number: { type: String },
            email: { type: String },
            national_id: { type: String },
            national_id_image: { type: String },
            prize_type: { type: String },
            prize_value: { type: Number },
            video_url: { type: String },
            order_number: { type: Number }
        }],
        // تاريخ حفظ النسخة
        snapshot_at: { type: Date },
        // معلومات إضافية
        total_prize_value: { type: Number },
        completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        completed_by_name: { type: String }
    },
    template_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CompetitionTemplate'
    },
    image_url: {
        type: String,
        default: '/images/competition_bg.jpg'
    },
    // Idempotency key to stop duplicate competition creation per agent
    client_request_id: {
        type: String,
        trim: true
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

// Enforce uniqueness per agent + request when provided (sparse)
competitionSchema.index({ agent_id: 1, client_request_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Competition || mongoose.model('Competition', competitionSchema);
