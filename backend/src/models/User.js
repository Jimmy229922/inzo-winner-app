
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin', 'super_admin'], default: 'user' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    avatar_url: { type: String, default: null },
    permissions: {
        agents: {
            view_financials: { type: Boolean, default: false },
            edit_profile: { type: Boolean, default: false },
            edit_financials: { type: Boolean, default: false },
            can_view_competitions_tab: { type: Boolean, default: false },
            can_renew_all_balances: { type: Boolean, default: false }
        },
        competitions: {
            manage_comps: { type: String, enum: ['none', 'view', 'full'], default: 'none' },
            manage_templates: { type: String, enum: ['none', 'view', 'full'], default: 'none' },
            can_create: { type: Boolean, default: false }
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
                