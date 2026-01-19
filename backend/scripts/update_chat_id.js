const mongoose = require('mongoose');
require('dotenv').config();

const Agent = require('../src/models/agent.model');

const OLD_CHAT_ID = '-5011395157';
const NEW_CHAT_ID = '-1003679452806';

async function updateChatIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Find agents with old chat ID
        const agentsWithOldId = await Agent.find({ telegram_chat_id: OLD_CHAT_ID });
        console.log(`Found ${agentsWithOldId.length} agents with old chat ID`);
        
        if (agentsWithOldId.length > 0) {
            const result = await Agent.updateMany(
                { telegram_chat_id: OLD_CHAT_ID },
                { $set: { telegram_chat_id: NEW_CHAT_ID } }
            );
            console.log(`Updated ${result.modifiedCount} agents to new chat ID: ${NEW_CHAT_ID}`);
        }
        
        // Also show all agents and their current chat IDs
        const allAgents = await Agent.find({}).select('name telegram_chat_id');
        console.log('\nAll agents and their chat IDs:');
        allAgents.forEach(a => {
            console.log(`  - ${a.name}: ${a.telegram_chat_id || 'NOT SET'}`);
        });
        
        await mongoose.disconnect();
        console.log('\nDone!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateChatIds();
