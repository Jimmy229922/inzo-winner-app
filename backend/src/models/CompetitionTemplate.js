const mongoose = require('mongoose');

const CompetitionTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Template name is required.'],
        trim: true,
        unique: true
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
    is_archived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const CompetitionTemplate = mongoose.model('CompetitionTemplate', CompetitionTemplateSchema);

module.exports = CompetitionTemplate;