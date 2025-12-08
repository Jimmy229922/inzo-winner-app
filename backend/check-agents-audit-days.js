const mongoose = require('mongoose');
const Agent = require('./src/models/agent.model');

async function checkAgents() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/inzo-db');
        console.log('Connected to MongoDB');
        console.log('='.repeat(80));
        console.log('ALL AGENTS AND THEIR AUDIT DAYS:');
        console.log('='.repeat(80));
        
        const agents = await Agent.find({}).select('name agent_id audit_days').lean();
        
        if (agents.length === 0) {
            console.log('No agents found in database!');
        } else {
            agents.forEach((agent, index) => {
                console.log(`\n${index + 1}. Agent: ${agent.name}`);
                console.log(`   ID: ${agent.agent_id}`);
                console.log(`   audit_days: [${agent.audit_days ? agent.audit_days.join(', ') : 'NONE'}]`);
                console.log(`   Has Wednesday (3)? ${agent.audit_days && agent.audit_days.includes(3) ? 'YES ✅' : 'NO ❌'}`);
            });
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`Total agents: ${agents.length}`);
        console.log('='.repeat(80));
        
        const todayIndex = new Date().getDay();
        const agentsForToday = agents.filter(a => a.audit_days && a.audit_days.includes(todayIndex));
        console.log(`\nToday is: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todayIndex]} (index: ${todayIndex})`);
        console.log(`Agents scheduled for today: ${agentsForToday.length}`);
        if (agentsForToday.length > 0) {
            console.log('Agents for today:');
            agentsForToday.forEach(a => console.log(`  - ${a.name} (ID: ${a.agent_id})`));
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAgents();
