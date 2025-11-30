/**
 * Script to create a new super_admin user
 * Usage: node scripts/create-superadmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

const SUPER_ADMIN = {
    email: 'admin@inzo.com',
    password: 'admin123',  // Change this to your desired password
    full_name: 'Super Admin',
    role: 'super_admin',
    status: 'active'
};

async function createSuperAdmin() {
    try {
        // Connect to database
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner_db';
        console.log(`Connecting to database: ${dbUri}`);
        
        await mongoose.connect(dbUri);
        
        console.log('✓ Connected to database successfully\n');

        // Check if user already exists
        const existingUser = await User.findOne({ email: SUPER_ADMIN.email });
        
        if (existingUser) {
            console.log('User already exists. Updating to super_admin...');
            existingUser.role = 'super_admin';
            existingUser.status = 'active';
            await existingUser.save();
            
            console.log('\n✓ Successfully updated existing user to super_admin!');
            console.log(`  Email: ${existingUser.email}`);
            console.log(`  Name: ${existingUser.full_name || existingUser.name}`);
            console.log(`  Role: ${existingUser.role}`);
            console.log(`\nYou can now log in with your existing password.`);
        } else {
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, salt);

            // Create new user
            const newUser = new User({
                email: SUPER_ADMIN.email,
                password: hashedPassword,
                full_name: SUPER_ADMIN.full_name,
                role: SUPER_ADMIN.role,
                status: SUPER_ADMIN.status
            });

            await newUser.save();

            console.log('✓ Successfully created super_admin user!');
            console.log(`\nLogin credentials:`);
            console.log(`  Email: ${SUPER_ADMIN.email}`);
            console.log(`  Password: ${SUPER_ADMIN.password}`);
            console.log(`  Role: ${SUPER_ADMIN.role}`);
            console.log(`\n⚠️  IMPORTANT: Change the password after first login!`);
        }

    } catch (error) {
        console.error('\n✗ Error occurred:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n✓ Database connection closed.');
    }
}

createSuperAdmin();
