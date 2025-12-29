const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Try to load .env from multiple locations
const envPaths = [
    path.join(__dirname, '../.env'),      // backend/.env
    path.join(__dirname, '../../.env')    // root/.env
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        break;
    }
}

const Competition = require('../src/models/Competition');

async function fixLegacyCompetitions() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inzo-db';
        await mongoose.connect(dbUri);
        console.log('✓ Connected to MongoDB');

        console.log('Starting legacy competitions fix...');

        // 1. Fix missing numeric defaults
        // These are fields that might be missing in old documents but are required or have defaults in the new schema
        const numericDefaults = {
            required_winners: 3,
            deposit_bonus_percentage: 0,
            trading_winners_count: 0,
            deposit_winners_count: 0,
            participants_count: 0,
            views_count: 0,
            reactions_count: 0,
            total_cost: 0,
            winners_count: 0,
            prize_per_winner: 0
        };

        for (const [field, value] of Object.entries(numericDefaults)) {
            const result = await Competition.updateMany(
                { [field]: { $exists: false } },
                { $set: { [field]: value } }
            );
            if (result.modifiedCount > 0) {
                console.log(`✓ Set default ${field}=${value} for ${result.modifiedCount} competitions.`);
            }
        }

        // 2. Fix missing string defaults
        const stringDefaults = {
            image_url: '/images/competition_bg.jpg',
            type: 'general',
            status: 'sent'
        };

        for (const [field, value] of Object.entries(stringDefaults)) {
            const result = await Competition.updateMany(
                { [field]: { $exists: false } },
                { $set: { [field]: value } }
            );
            if (result.modifiedCount > 0) {
                console.log(`✓ Set default ${field}='${value}' for ${result.modifiedCount} competitions.`);
            }
        }
        
        // 3. Fix invalid durations
        // The schema enforces specific enum values. If old data has something else, save() will fail.
        const validDurations = ['5s', '10s', '1d', '2d', '1w'];
        // Find competitions where duration exists but is NOT in the valid list
        const invalidDurationResult = await Competition.updateMany(
            { duration: { $exists: true, $nin: validDurations } },
            { $set: { duration: '1d' } } // Default to 1 day
        );
        
        if (invalidDurationResult.modifiedCount > 0) {
             console.log(`✓ Fixed ${invalidDurationResult.modifiedCount} competitions with invalid duration (set to '1d').`);
        }

        // 4. Ensure is_active is set
        const activeResult = await Competition.updateMany(
            { is_active: { $exists: false } },
            { $set: { is_active: true } }
        );
        if (activeResult.modifiedCount > 0) {
            console.log(`✓ Set is_active=true for ${activeResult.modifiedCount} competitions.`);
        }

        console.log('✓ Legacy competitions fix completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing competitions:', error);
        process.exit(1);
    }
}

fixLegacyCompetitions();
