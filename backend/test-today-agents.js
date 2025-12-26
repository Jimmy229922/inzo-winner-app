const mongoose = require('mongoose');
const Agent = require('./src/models/agent.model');

async function testTodayAgents() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/inzo-db');
        console.log('Connected to MongoDB\n');
        
        const today = new Date();
        const dayOfWeekIndex = today.getDay();
        
        const dayNames = ['الأحد (Sunday)', 'الاثنين (Monday)', 'الثلاثاء (Tuesday)', 
                         'الأربعاء (Wednesday)', 'الخميس (Thursday)', 'الجمعة (Friday)'];
        
        console.log('='.repeat(80));
        console.log('TODAY IS:', dayNames[dayOfWeekIndex], '- Index:', dayOfWeekIndex);
        console.log('='.repeat(80));
        
        // Query same as getTodayTasks
        const query = { audit_days: { $in: [dayOfWeekIndex] } };
        console.log('\nQuery:', JSON.stringify(query));
        
        const agentsForToday = await Agent.find(query)
            .select('name agent_id audit_days')
            .lean();
        
        console.log('\nAgents found:', agentsForToday.length);
        console.log('='.repeat(80));
        
        if (agentsForToday.length === 0) {
            console.log('✅ CORRECT: No agents scheduled for today (Wednesday)');
        } else {
            console.log('❌ ERROR: Found agents that should NOT appear today:');
            agentsForToday.forEach((agent, idx) => {
                console.log(`\n${idx + 1}. ${agent.name} (ID: ${agent.agent_id})`);
                console.log('   audit_days:', agent.audit_days);
                console.log('   Contains', dayOfWeekIndex, '?', agent.audit_days.includes(dayOfWeekIndex) ? 'YES' : 'NO');
            });
        }
        
        console.log('\n' + '='.repeat(80));
        
        // Show all agents
        const allAgents = await Agent.find({}).select('name agent_id audit_days').lean();
        console.log('\nALL AGENTS IN DATABASE:');
        allAgents.forEach((agent, idx) => {
            console.log(`${idx + 1}. ${agent.name} - audit_days: [${agent.audit_days.join(', ')}]`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testTodayAgents();
