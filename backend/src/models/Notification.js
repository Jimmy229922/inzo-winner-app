const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null means broadcast to all (or system wide)
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
    },
    is_read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 30 // Auto-delete after 30 days
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
