const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    full_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['employee', 'admin', 'super_admin'], default: 'employee' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    avatar_url: { type: String, default: null },
    permissions: {
        agents: {
            view_financials: { type: Boolean, default: false },
            edit_profile: { type: Boolean, default: false },
            edit_financials: { type: Boolean, default: false },
            can_view_competitions_tab: { type: Boolean, default: false },
            can_renew_all_balances: { type: Boolean, default: false },
        },
        competitions: {
            manage_comps: { type: String, enum: ['none', 'view', 'full'], default: 'none' },
            manage_templates: { type: String, enum: ['none', 'view', 'full'], default: 'none' },
            can_create: { type: Boolean, default: false },
        }
    }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', UserSchema);