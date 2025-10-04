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