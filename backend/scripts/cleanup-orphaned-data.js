/**
 * Script to cleanup orphaned data (data pointing to deleted agents)
 * Usage: node scripts/cleanup-orphaned-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');
const Competition = require('../src/models/Competition');
const Task = require('../src/models/Task');
const ActivityLog = require('../src/models/ActivityLog');
const AgentRankChange = require('../src/models/AgentRankChange');

async function cleanupOrphanedData() {
    try {
        // Connect to database
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner_db';
        console.log(`Connecting to database: ${dbUri}`);
        
        await mongoose.connect(dbUri);
        
        console.log('✓ Connected to database successfully\n');

        // Get all valid agent IDs
        const validAgents = await Agent.find({}).select('_id').lean();
        const validAgentIds = validAgents.map(a => a._id.toString());
        
        console.log(`Found ${validAgentIds.length} active agents in database.\n`);

        let totalDeleted = 0;

        // 1. Clean Competitions
        console.log('[1/4] Cleaning competitions...');
        const competitions = await Competition.find({}).select('agent_id').lean();
        const orphanedCompetitions = competitions.filter(c => 
            c.agent_id && !validAgentIds.includes(c.agent_id.toString())
        );
        
        if (orphanedCompetitions.length > 0) {
            const compIds = orphanedCompetitions.map(c => c._id);
            const compResult = await Competition.deleteMany({ _id: { $in: compIds } });
            console.log(`   ✓ Deleted ${compResult.deletedCount} orphaned competitions`);
            totalDeleted += compResult.deletedCount;
        } else {
            console.log(`   ✓ No orphaned competitions found`);
        }

        // 2. Clean Tasks
        console.log('[2/4] Cleaning tasks...');
        const tasks = await Task.find({}).select('agent_id').lean();
        const orphanedTasks = tasks.filter(t => 
            t.agent_id && !validAgentIds.includes(t.agent_id.toString())
        );
        
        if (orphanedTasks.length > 0) {
            const taskIds = orphanedTasks.map(t => t._id);
            const taskResult = await Task.deleteMany({ _id: { $in: taskIds } });
            console.log(`   ✓ Deleted ${taskResult.deletedCount} orphaned tasks`);
            totalDeleted += taskResult.deletedCount;
        } else {
            console.log(`   ✓ No orphaned tasks found`);
        }

        // 3. Clean Activity Logs
        console.log('[3/4] Cleaning activity logs...');
        const logs = await ActivityLog.find({ agent_id: { $ne: null } }).select('agent_id').lean();
        const orphanedLogs = logs.filter(l => 
            l.agent_id && !validAgentIds.includes(l.agent_id.toString())
        );
        
        if (orphanedLogs.length > 0) {
            const logIds = orphanedLogs.map(l => l._id);
            const logResult = await ActivityLog.deleteMany({ _id: { $in: logIds } });
            console.log(`   ✓ Deleted ${logResult.deletedCount} orphaned activity logs`);
            totalDeleted += logResult.deletedCount;
        } else {
            console.log(`   ✓ No orphaned activity logs found`);
        }

        // 4. Clean Agent Rank Changes
        console.log('[4/4] Cleaning agent rank/classification changes...');
        const rankChanges = await AgentRankChange.find({}).select('agent_id').lean();
        const orphanedRankChanges = rankChanges.filter(r => 
            r.agent_id && !validAgentIds.includes(r.agent_id.toString())
        );
        
        if (orphanedRankChanges.length > 0) {
            const rankIds = orphanedRankChanges.map(r => r._id);
            const rankResult = await AgentRankChange.deleteMany({ _id: { $in: rankIds } });
            console.log(`   ✓ Deleted ${rankResult.deletedCount} orphaned rank/classification changes`);
            totalDeleted += rankResult.deletedCount;
        } else {
            console.log(`   ✓ No orphaned rank changes found`);
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✓ Cleanup completed successfully!`);
        console.log(`✓ Total orphaned records deleted: ${totalDeleted}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n✗ Error occurred:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n✓ Database connection closed.');
    }
}

cleanupOrphanedData();
