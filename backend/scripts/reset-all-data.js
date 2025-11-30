/**
 * Script to completely reset all data (DANGER: irreversible!)
 * This will delete ALL agents, competitions, tasks, logs, rank changes
 * Usage: node scripts/reset-all-data.js
 * 
 * ⚠️ WARNING: This will permanently delete all data!
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');
const Competition = require('../src/models/Competition');
const Task = require('../src/models/Task');
const ActivityLog = require('../src/models/ActivityLog');
const AgentRankChange = require('../src/models/AgentRankChange');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function resetAllData() {
    try {
        // Connect to database
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner_db';
        console.log(`Connecting to database: ${dbUri}`);
        
        await mongoose.connect(dbUri);
        
        console.log('✓ Connected to database successfully\n');

        // Warning
        console.log('='.repeat(60));
        console.log('⚠️  WARNING: DESTRUCTIVE OPERATION ⚠️');
        console.log('='.repeat(60));
        console.log('This will permanently delete ALL:');
        console.log('  - Agents');
        console.log('  - Competitions');
        console.log('  - Tasks');
        console.log('  - Activity Logs');
        console.log('  - Rank/Classification Changes');
        console.log('');
        console.log('This action CANNOT be undone!');
        console.log('='.repeat(60));
        console.log('');

        // Double confirmation
        const answer1 = await askQuestion('Type "DELETE ALL DATA" to confirm: ');
        
        if (answer1.trim() !== 'DELETE ALL DATA') {
            console.log('\n❌ Confirmation text incorrect. Aborting...');
            rl.close();
            process.exit(0);
        }

        const answer2 = await askQuestion('\nAre you absolutely sure? Type "YES" to proceed: ');
        
        if (answer2.trim().toUpperCase() !== 'YES') {
            console.log('\n❌ Operation cancelled.');
            rl.close();
            process.exit(0);
        }

        console.log('\n🔥 Starting data deletion...\n');

        let totalDeleted = 0;

        // 1. Delete Agents
        console.log('[1/5] Deleting all agents...');
        const agentResult = await Agent.deleteMany({});
        console.log(`   ✓ Deleted ${agentResult.deletedCount} agents`);
        totalDeleted += agentResult.deletedCount;

        // 2. Delete Competitions
        console.log('[2/5] Deleting all competitions...');
        const compResult = await Competition.deleteMany({});
        console.log(`   ✓ Deleted ${compResult.deletedCount} competitions`);
        totalDeleted += compResult.deletedCount;

        // 3. Delete Tasks
        console.log('[3/5] Deleting all tasks...');
        const taskResult = await Task.deleteMany({});
        console.log(`   ✓ Deleted ${taskResult.deletedCount} tasks`);
        totalDeleted += taskResult.deletedCount;

        // 4. Delete Activity Logs
        console.log('[4/5] Deleting all activity logs...');
        const logResult = await ActivityLog.deleteMany({});
        console.log(`   ✓ Deleted ${logResult.deletedCount} activity logs`);
        totalDeleted += logResult.deletedCount;

        // 5. Delete Agent Rank Changes
        console.log('[5/5] Deleting all rank/classification changes...');
        const rankResult = await AgentRankChange.deleteMany({});
        console.log(`   ✓ Deleted ${rankResult.deletedCount} rank changes`);
        totalDeleted += rankResult.deletedCount;

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Complete reset finished!`);
        console.log(`✅ Total records deleted: ${totalDeleted}`);
        console.log(`✅ Database is now clean and ready for fresh data.`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error occurred:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        rl.close();
        await mongoose.connection.close();
        console.log('\n✓ Database connection closed.');
    }
}

resetAllData();
