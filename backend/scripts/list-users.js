/**
 * Script to list all users in the database
 * Usage: node scripts/list-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function listUsers() {
    try {
        // Connect to database
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner_db';
        console.log(`Connecting to database: ${dbUri}`);
        
        await mongoose.connect(dbUri);
        
        console.log('✓ Connected to database successfully\n');

        // Find all users
        const users = await User.find({}).select('full_name name email role status').lean();
        
        if (users.length === 0) {
            console.log('No users found in database.');
            process.exit(0);
        }

        console.log(`Found ${users.length} user(s):\n`);
        
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.full_name || user.name || 'No Name'}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Status: ${user.status || 'active'}`);
            console.log('');
        });

    } catch (error) {
        console.error('\n✗ Error occurred:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('✓ Database connection closed.');
    }
}

listUsers();
