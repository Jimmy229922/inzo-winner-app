/**
 * Script to update existing test competitions with deposit_bonus_percentage field
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Competition = require('../src/models/Competition');
const CompetitionTemplate = require('../src/models/CompetitionTemplate');

async function updateCompetitions() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner';
        await mongoose.connect(dbUri);
        console.log('✓ Connected to MongoDB');

        // Find all test competitions created by the script
        const testCompetitions = await Competition.find({
            name: /^مسابقة اختبار - بونص إيداع/,
            status: 'completed'
        });

        console.log(`✓ Found ${testCompetitions.length} test competitions to update`);

        let updated = 0;
        for (const comp of testCompetitions) {
            // Get template separately
            const template = await CompetitionTemplate.findById(comp.template_id);
            
            // Extract percentage from template bonus_percentage
            if (template && template.bonus_percentage) {
                comp.deposit_bonus_percentage = template.bonus_percentage;
                await comp.save();
                updated++;
                console.log(`  Updated: ${comp.name} → ${comp.deposit_bonus_percentage}%`);
            }
        }

        console.log(`\n✓ Updated ${updated} competitions with deposit_bonus_percentage`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
    }
}

// Run the script
updateCompetitions();
