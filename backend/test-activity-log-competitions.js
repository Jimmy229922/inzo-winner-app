// Test script to verify activity log for competition_sent actions
const mongoose = require('mongoose');
const ActivityLog = require('./src/models/ActivityLog');
const User = require('./src/models/user.model');
const Agent = require('./src/models/agent.model');

async function testActivityLogs() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/inzo-db');
        console.log('✅ Connected to MongoDB\n');

        // Get all activity logs related to competitions
        const competitionLogs = await ActivityLog.find({
            action_type: {
                $in: ['COMPETITION_SENT', 'COMPETITION_SENT_FAILED', 'TASK_UPDATE', 'TASK_COMPLETED', 'TASK_UNCOMPLETED']
            }
        })
        .populate('user_id', 'username role')
        .populate('agent_id', 'name agent_id')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

        console.log(`📊 Found ${competitionLogs.length} competition/task-related activity logs:\n`);

        if (competitionLogs.length === 0) {
            console.log('⚠️  No activity logs found for competitions or tasks.');
            console.log('   This means either:');
            console.log('   1. No competition/task actions have been performed yet');
            console.log('   2. The logging is not working\n');
        } else {
            competitionLogs.forEach((log, index) => {
                console.log(`${index + 1}. [${log.action_type}]`);
                console.log(`   Time: ${new Date(log.createdAt).toLocaleString('ar-EG')}`);
                console.log(`   User: ${log.user_id ? `${log.user_id.username} (${log.user_id.role})` : 'System'}`);
                console.log(`   Agent: ${log.agent_id ? `${log.agent_id.name} (#${log.agent_id.agent_id})` : 'N/A'}`);
                console.log(`   Description: ${log.description}`);
                console.log('');
            });
        }

        // Summary by action type
        const summary = competitionLogs.reduce((acc, log) => {
            acc[log.action_type] = (acc[log.action_type] || 0) + 1;
            return acc;
        }, {});

        console.log('📈 Summary by Action Type:');
        Object.entries(summary).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
        });

        await mongoose.connection.close();
        console.log('\n✅ Test completed');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testActivityLogs();
