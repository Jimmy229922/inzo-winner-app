/**
 * Script to enable auditing for all existing agents
 * Run: node backend/scripts/enable_auditing_for_all.js
 */

const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');
require('dotenv').config();

async function enableAuditingForAll() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inzo-db';
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB:', mongoUri);

        // Find all agents where is_auditing_enabled is false or undefined
        const result = await Agent.updateMany(
            { 
                $or: [
                    { is_auditing_enabled: { $exists: false } },
                    { is_auditing_enabled: false }
                ]
            },
            { 
                $set: { is_auditing_enabled: true } 
            }
        );

        console.log(`✓ Updated ${result.modifiedCount} agents`);
        console.log(`  - Matched: ${result.matchedCount}`);
        console.log(`  - Modified: ${result.modifiedCount}`);

        // Verify the update
        const enabledCount = await Agent.countDocuments({ is_auditing_enabled: true });
        const totalCount = await Agent.countDocuments({});
        
        console.log(`\n✓ Verification:`);
        console.log(`  - Total agents: ${totalCount}`);
        console.log(`  - Auditing enabled: ${enabledCount}`);
        console.log(`  - Auditing disabled: ${totalCount - enabledCount}`);

        await mongoose.connection.close();
        console.log('\n✓ Done!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

enableAuditingForAll();
