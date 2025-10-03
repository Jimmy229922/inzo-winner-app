
const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    agent_id: { type: String, required: true, unique: true, trim: true },
    classification: { type: String, required: true, enum: ['R', 'A', 'B', 'C'] },
    rank: { type: String, required: true },
    avatar_url: { type: String, default: null },
    audit_days: { type: [Number], default: [] }, // 0=Sun, 1=Mon, ...
    renewal_period: { type: String, enum: ['none', 'weekly', 'biweekly', 'monthly'], default: 'none' },
    last_renewal_date: { type: Date, default: null },
    competition_duration: { type: String, enum: ['24h', '48h', null], default: null },
    last_competition_date: { type: Date, default: null },
    winner_selection_date: { type: Date, default: null },
    // Financials
    competition_bonus: { type: Number, default: 0 },
    consumed_balance: { type: Number, default: 0 },
    remaining_balance: { type: Number, default: 0 },
    deposit_bonus_percentage: { type: Number, default: null },
    deposit_bonus_count: { type: Number, default: null },
    used_deposit_bonus: { type: Number, default: 0 },
    remaining_deposit_bonus: { type: Number, default: 0 },
    single_competition_balance: { type: Number, default: 0 },
    winners_count: { type: Number, default: 0 },
    prize_per_winner: { type: Number, default: 0 },
    // Telegram
    telegram_channel_url: { type: String, default: null },
    telegram_group_url: { type: String, default: null },
    telegram_chat_id: { type: String, default: null },
    telegram_group_name: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Agent', AgentSchema);
                