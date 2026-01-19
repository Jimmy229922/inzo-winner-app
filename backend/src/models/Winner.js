const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    competition_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
    name: { type: String, required: true },
    account_number: { type: String },
    email: { type: String }, // Added email field
    national_id: { type: String }, // National ID number
    national_id_image: { type: String }, // Path to national ID image
    prize_type: { type: String }, // Added prize type
    prize_value: { type: Number }, // Added prize value
    order_number: { type: Number }, // رقم ترتيب الفائز (يدوي)
    video_url: { type: String }, // Added video URL
    selected_at: { type: Date, default: Date.now },
    meta: { type: Object, default: {} }
}, {
    timestamps: true
});

module.exports = mongoose.models.Winner || mongoose.model('Winner', winnerSchema);
