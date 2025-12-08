const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    agent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true,
    },
    // --- إصلاح: إضافة حقل تاريخ المهمة إلى المخطط ---
    task_date: {
        type: Date,
        required: true,
    },
    // --- NEW: Store day index explicitly to avoid timezone issues ---
    // Updated to support only 6 days (Sunday=0 to Friday=5), Saturday removed
    day_index: {
        type: Number,
        required: true,
        min: 0,
        max: 5
    },
    audited: {
        type: Boolean,
        default: false,
    },
    competition_sent: {
        type: Boolean,
        default: false,
    },
    updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true, // يضيف حقلي createdAt و updatedAt تلقائياً
});

module.exports = mongoose.model('Task', taskSchema);