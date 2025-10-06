const mongoose = require('mongoose');

const CompetitionTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Template name is required.'],
        trim: true,
        unique: true
    },
    question: {
        type: String,
        required: [true, 'Template name (question) is required.'],
        trim: true,
        // unique: true // The 'name' field is now the unique identifier
    },
    content: {
        type: String,
        required: [true, 'Template content is required.']
    },
    correct_answer: {
        type: String
    },
    description: {
        type: String,
        trim: true
    },
    competition_type: {
        type: String,
        enum: ['standard', 'special'],
        default: 'standard'
    },
    classification: {
        type: String,
        default: 'All'
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
    }
}, {
    timestamps: true
});

const CompetitionTemplate = mongoose.model('CompetitionTemplate', CompetitionTemplateSchema);

module.exports = CompetitionTemplate;