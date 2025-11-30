/**
 * Script to completely reset all data - NO CONFIRMATION (USE WITH CAUTION!)
 * Usage: node scripts/reset-all-data-now.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');
const Competition = require('../src/models/Competition');
const Task = require('../src/models/Task');
const ActivityLog = require('../src/models/ActivityLog');
const AgentRankChange = require('../src/models/AgentRankChange');
const Template = require('../src/models/Template');
const CompetitionTemplate = require('../src/models/CompetitionTemplate');

async function resetAllData() {
    try {
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner_db';
        console.log(`Connecting to database: ${dbUri}`);
        
        await mongoose.connect(dbUri);
        console.log('✓ Connected to database successfully\n');

        console.log('🔥 Starting complete data deletion...\n');

        let totalDeleted = 0;

        console.log('[1/5] Deleting all agents...');
        const agentResult = await Agent.deleteMany({});
        console.log(`   ✓ Deleted ${agentResult.deletedCount} agents`);
        totalDeleted += agentResult.deletedCount;

        console.log('[2/5] Deleting all competitions...');
        const compResult = await Competition.deleteMany({});
        console.log(`   ✓ Deleted ${compResult.deletedCount} competitions`);
        totalDeleted += compResult.deletedCount;

        console.log('[3/5] Deleting all tasks...');
        const taskResult = await Task.deleteMany({});
        console.log(`   ✓ Deleted ${taskResult.deletedCount} tasks`);
        totalDeleted += taskResult.deletedCount;

        console.log('[4/5] Deleting all activity logs...');
        const logResult = await ActivityLog.deleteMany({});
        console.log(`   ✓ Deleted ${logResult.deletedCount} activity logs`);
        totalDeleted += logResult.deletedCount;

        console.log('[5/7] Deleting all rank/classification changes...');
        const rankResult = await AgentRankChange.deleteMany({});
        console.log(`   ✓ Deleted ${rankResult.deletedCount} rank changes`);
        totalDeleted += rankResult.deletedCount;

        console.log('[6/7] Deleting all templates...');
        const templateResult = await Template.deleteMany({});
        console.log(`   ✓ Deleted ${templateResult.deletedCount} templates`);
        totalDeleted += templateResult.deletedCount;

        console.log('[7/7] Deleting all competition templates...');
        const compTemplateResult = await CompetitionTemplate.deleteMany({});
        console.log(`   ✓ Deleted ${compTemplateResult.deletedCount} competition templates`);
        totalDeleted += compTemplateResult.deletedCount;

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
        await mongoose.connection.close();
        console.log('\n✓ Database connection closed.');
    }
}

resetAllData();
