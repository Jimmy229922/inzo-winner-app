const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    agent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    audited: {
        type: Boolean,
        default: false
    },
    competition_sent: {
        type: Boolean,
        default: false
    },
    audited_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    competition_sent_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);