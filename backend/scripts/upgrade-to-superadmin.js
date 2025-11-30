/**
 * Script to upgrade a user to super_admin role
 * Usage: node scripts/upgrade-to-superadmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const TARGET_EMAIL = 'admin@inzo.com';

async function upgradeSuperAdmin() {
    try {
        // Connect to database
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner_db';
        console.log(`Connecting to database: ${dbUri}`);
        
        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✓ Connected to database successfully');

        // Find user by email
        const user = await User.findOne({ email: TARGET_EMAIL });
        
        if (!user) {
            console.error(`✗ User with email "${TARGET_EMAIL}" not found!`);
            process.exit(1);
        }

        console.log(`\nFound user:`);
        console.log(`  Name: ${user.full_name || user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Current Role: ${user.role}`);

        if (user.role === 'super_admin') {
            console.log('\n✓ User is already a super_admin. No changes needed.');
            process.exit(0);
        }

        // Update role to super_admin
        user.role = 'super_admin';
        await user.save();

        console.log(`\n✓ Successfully upgraded user to super_admin!`);
        console.log(`  Email: ${user.email}`);
        console.log(`  New Role: ${user.role}`);
        
        console.log('\nYou can now log in with full super admin privileges.');

    } catch (error) {
        console.error('\n✗ Error occurred:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n✓ Database connection closed.');
    }
}

upgradeSuperAdmin();
