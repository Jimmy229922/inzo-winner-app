const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    agent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    type: {
        type: String,
        enum: ['auto_renewal', 'manual_renewal', 'manual_adjustment'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    previous_balance: {
        type: Number,
        required: true,
        default: 0
    },
    new_balance: {
        type: Number,
        required: true,
        default: 0
    },
    details: {
        type: String,
        default: ''
    },
    performed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null means system/auto
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Transaction', transactionSchema);
