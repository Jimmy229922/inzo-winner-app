const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action_type: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

LogSchema.virtual('user_name').get(function() {
    return this.user ? this.user.full_name : 'النظام';
});

LogSchema.virtual('created_at').get(function() {
    return this.createdAt ? this.createdAt.toISOString() : null;
});

const Log = mongoose.model('Log', LogSchema);

module.exports = Log;
