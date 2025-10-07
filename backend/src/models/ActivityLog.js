const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ActivityLogSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null // For system-generated actions
    },
    agent_id: {
        type: Schema.Types.ObjectId,
        ref: 'Agent',
        default: null
    },
    action_type: {
        type: String,
        required: true,
        index: true
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true // This will add `createdAt` and `updatedAt` fields
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);