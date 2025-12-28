/**
 * Script to update existing competitions with deposit_bonus_percentage
 * based on the agent's current deposit_bonus_percentage
 */

const path = require('path');
const fs = require('fs');

// Try to load .env from multiple locations
const envPaths = [
    path.join(__dirname, '../.env'),      // backend/.env
    path.join(__dirname, '../../.env')    // root/.env
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        // console.log(`Loaded env from ${envPath}`);
        break;
    }
}

const mongoose = require('mongoose');
const Competition = require('../src/models/Competition');
const Agent = require('../src/models/agent.model');

async function updateRealCompetitions() {
    try {
        // Connect to MongoDB
        // Use MONGODB_URI (standard in this project) or MONGO_URI, with correct fallback DB name
        const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inzo-db';
        
        console.log(`[INFO] Connecting to MongoDB...`); // Don't log full URI to hide creds
        
        await mongoose.connect(dbUri);
        console.log('✓ Connected to MongoDB');

        // Find all completed competitions with deposit_winners_count > 0
        const competitions = await Competition.find({
            status: 'completed',
            deposit_winners_count: { $gt: 0 }
        });

        console.log(`✓ Found ${competitions.length} competitions with deposit winners to update`);

        let updated = 0;
        for (const comp of competitions) {
            // Get the agent
            const agent = await Agent.findById(comp.agent_id);
            
            if (agent && agent.deposit_bonus_percentage && agent.deposit_bonus_percentage > 0) {
                comp.deposit_bonus_percentage = agent.deposit_bonus_percentage;
                await comp.save();
                updated++;
                console.log(`  Updated: ${comp.name.substring(0, 50)}... → ${comp.deposit_bonus_percentage}%`);
            } else {
                console.log(`  ⚠ Skipped: ${comp.name.substring(0, 50)}... (no agent deposit bonus)`);
            }
        }

        console.log(`\n✓ Updated ${updated} competitions with deposit_bonus_percentage`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
    }
}

// Run the script
updateRealCompetitions();
