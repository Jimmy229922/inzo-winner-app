
const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action_type: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Log', LogSchema);
                