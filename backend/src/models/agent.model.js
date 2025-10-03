const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    agent_id: { type: String, required: true, unique: true, trim: true },
    classification: { type: String, default: 'R' },
    rank: { type: String, default: 'BEGINNING' },
    avatar_url: { type: String, default: null },
    telegram_channel_url: { type: String, default: null },
    telegram_group_url: { type: String, default: null },
    telegram_chat_id: { type: String, default: null },
    telegram_group_name: { type: String, default: null },
    renewal_period: { type: String, default: 'none' },
    audit_days: { type: [Number], default: [] },
    competition_duration: { type: String, enum: ['24h', '48h', null], default: null },
    competitions_per_week: { type: Number, default: 1 },
    competition_bonus: { type: Number, default: 0 },
    deposit_bonus_percentage: { type: Number, default: 0 },
    deposit_bonus_count: { type: Number, default: 0 },
    remaining_balance: { type: Number, default: 0 },
    consumed_balance: { type: Number, default: 0 },
    remaining_deposit_bonus: { type: Number, default: 0 },
    used_deposit_bonus: { type: Number, default: 0 },
    single_competition_balance: { type: Number, default: 0 },
    winners_count: { type: Number, default: 0 },
    prize_per_winner: { type: Number, default: 0 },
    last_renewal_date: { type: Date, default: null },
    last_competition_date: { type: Date, default: null },
    winner_selection_date: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Agent', AgentSchema);