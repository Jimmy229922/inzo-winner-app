const Agent = require('./models/agent.model');

/**
 * This migration script adds a default `competitions_per_week` value
 * to existing agents who do not have this field set.
 * - Classification R, A get 2 competitions per week.
 * - Classification B, C get 1 competition per week.
 */
const run = async () => {
    console.log('[Migration] Running: Add default competitions_per_week...');

    try {
        // Wait for mongoose connection to be ready
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            console.log('[Migration] Waiting for database connection...');
            await new Promise((resolve) => {
                if (mongoose.connection.readyState === 1) resolve();
                else mongoose.connection.once('connected', resolve);
            });
        }

        // Find all agents where competitions_per_week is not set or is null
        const agentsToUpdate = await Agent.find({
            competitions_per_week: { $exists: false }
        });

        if (agentsToUpdate.length === 0) {
            console.log('[Migration] No agents found needing an update for competitions_per_week. Migration complete.');
            return;
        }

        console.log(`[Migration] Found ${agentsToUpdate.length} agents to update.`);

        for (const agent of agentsToUpdate) {
            const classification = agent.classification.toUpperCase();
            if (classification === 'R' || classification === 'A') {
                agent.competitions_per_week = 2;
            } else if (classification === 'B' || classification === 'C') {
                agent.competitions_per_week = 1;
            }
            await agent.save();
        }

        console.log(`[Migration] Successfully updated ${agentsToUpdate.length} agents with default competitions_per_week.`);
    } catch (error) {
        console.error('[Migration Error] Failed to add default competitions_per_week:', error);
    }
};

module.exports = run;