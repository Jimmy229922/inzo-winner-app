const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AgentRankChangeSchema = new Schema({
    agent_id: {
        type: Schema.Types.ObjectId,
        ref: 'Agent',
        required: true,
        index: true
    },
    agent_name: {
        type: String,
        required: true
    },
    agent_number: {
        type: String,
        required: true
    },
    classification: {
        type: String,
        required: true
    },
    // For rank changes
    old_rank: {
        type: String,
        required: false
    },
    new_rank: {
        type: String,
        required: false
    },
    // For classification changes
    old_classification: {
        type: String,
        required: false
    },
    new_classification: {
        type: String,
        required: false
    },
    // Type of change
    change_type: {
        type: String,
        enum: ['rank', 'classification'],
        default: 'rank'
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    action_taken: {
        type: String,
        required: true,
        trim: true
    },
    changed_by: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    changed_by_name: {
        type: String,
        required: true
    }
}, {
    timestamps: true // This will add `createdAt` and `updatedAt` fields
});

// Index for efficient querying
AgentRankChangeSchema.index({ createdAt: -1 });
AgentRankChangeSchema.index({ agent_id: 1, createdAt: -1 });

module.exports = mongoose.model('AgentRankChange', AgentRankChangeSchema);
