const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    classification: {
        type: String,
        enum: ['R', 'A', 'B', 'C', 'All'],
        required: true
    },
    correct_answer: {
        type: String,
        required: true
    },
    usage_limit: {
        type: Number,
        default: null
    },
    usage_count: {
        type: Number,
        default: 0
    },
    is_archived: {
        type: Boolean,
        default: false
    },
    image_url: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Template', templateSchema);