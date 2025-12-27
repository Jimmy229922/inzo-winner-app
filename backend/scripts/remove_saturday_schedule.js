const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');

async function removeSaturdaySchedule() {
    try {
        const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inzo_winner_db';
        await mongoose.connect(dbUri);
        console.log('Connected to MongoDB');

        // Update all agents to pull '6' from audit_days
        const result = await Agent.updateMany(
            { audit_days: 6 },
            { $pull: { audit_days: 6 } }
        );

        console.log(`Updated ${result.modifiedCount} agents. Removed Saturday (6) from their schedule.`);

        await mongoose.disconnect();
        console.log('Disconnected');
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

removeSaturdaySchedule();
