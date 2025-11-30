/**
 * Script to check auditing status for a specific agent
 * Run: node backend/scripts/check_agent_auditing.js <agent_id>
 */

const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');
require('dotenv').config();

async function checkAgentAuditing() {
    try {
        const agentId = process.argv[2];
        
        if (!agentId) {
            console.log('❌ Usage: node check_agent_auditing.js <agent_id>');
            process.exit(1);
        }

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inzo-db';
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB\n');

        // Find agent
        const agent = await Agent.findById(agentId);
        
        if (!agent) {
            console.log(`❌ Agent not found: ${agentId}`);
            process.exit(1);
        }

        console.log('📋 Agent Information:');
        console.log(`   Name: ${agent.name}`);
        console.log(`   Agent ID: ${agent.agent_id}`);
        console.log(`   Classification: ${agent.classification}`);
        console.log(`   Is Auditing Enabled: ${agent.is_auditing_enabled ? '✅ YES' : '❌ NO'}`);
        console.log(`   Audit Days: ${agent.audit_days?.join(', ') || 'None'}`);

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAgentAuditing();
