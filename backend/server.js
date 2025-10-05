require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');
const { startScheduler } = require('./src/utils/scheduler');

const port = process.env.PORT || 30001;

async function createSuperAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
        console.error('[CRITICAL] SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env file.');
        process.exit(1);
    }

    try {
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            console.log('[INFO] Super Admin user already exists.');
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const superAdmin = new User({
            full_name: 'INZO Super Admin',
            email,
            password: hashedPassword,
            role: 'super_admin',
            permissions: {
                agents: { view_financials: true, edit_profile: true, edit_financials: true, can_view_competitions_tab: true, can_renew_all_balances: true },
                competitions: { manage_comps: 'full', manage_templates: 'full', can_create: true }
            }
        });
        await superAdmin.save();
        console.log(`[SUCCESS] Initial Super Admin created successfully with email: ${email}`);
    } catch (error) {
        console.error('[CRITICAL] Failed to create initial Super Admin:', error.message);
        process.exit(1);
    }
}

async function startServer() {
    await connectDB();
    await createSuperAdmin();

    startScheduler();

    app.listen(port, () => {
        console.log(`Backend server is running at http://localhost:${port}`);
    });
}

startServer();