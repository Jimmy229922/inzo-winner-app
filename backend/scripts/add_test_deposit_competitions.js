/**
 * Script to add test deposit bonus competitions to the database
 * This will create completed competitions with deposit bonus data for testing analytics
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Competition = require('../src/models/Competition');
const Agent = require('../src/models/agent.model');
const CompetitionTemplate = require('../src/models/CompetitionTemplate');

async function addTestDepositCompetitions() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/inzo_winner';
        await mongoose.connect(dbUri);
        console.log('✓ Connected to MongoDB');

        // Find an agent with deposit bonus
        const agent = await Agent.findOne({ 
            deposit_bonus_count: { $gt: 0 } 
        }).sort({ createdAt: -1 });

        if (!agent) {
            console.log('⚠ No agent with deposit bonus found. Creating sample competitions anyway...');
        } else {
            console.log(`✓ Found agent: ${agent.name} (ID: ${agent._id})`);
        }

        // Use the found agent or create a fallback agent ID
        const agentId = agent ? agent._id : new mongoose.Types.ObjectId();

        // Find super admin to use as created_by
        const User = require('../src/models/User');
        const superAdmin = await User.findOne({ role: 'super_admin' });
        if (!superAdmin) {
            // Try to find any admin user
            const anyAdmin = await User.findOne({ $or: [{ role: 'admin' }, { role: 'super_admin' }] });
            if (!anyAdmin) {
                console.error('❌ No admin found. Creating fallback admin ID...');
                // Use a fallback ID
                const fallbackAdminId = new mongoose.Types.ObjectId();
                console.log(`⚠ Using fallback admin ID: ${fallbackAdminId}`);
                var adminId = fallbackAdminId;
            } else {
                console.log(`✓ Using Admin ID: ${anyAdmin._id}`);
                var adminId = anyAdmin._id;
            }
        } else {
            console.log(`✓ Using Super Admin ID: ${superAdmin._id}`);
            var adminId = superAdmin._id;
        }

        // Find or create deposit templates
        let depositTemplate40 = await CompetitionTemplate.findOne({ 
            type: 'deposit',
            bonus_percentage: 40 
        });

        let depositTemplate50 = await CompetitionTemplate.findOne({ 
            type: 'deposit',
            bonus_percentage: 50 
        });

        let depositTemplate60 = await CompetitionTemplate.findOne({ 
            type: 'deposit',
            bonus_percentage: 60 
        });

        let depositTemplate75 = await CompetitionTemplate.findOne({ 
            type: 'deposit',
            bonus_percentage: 75 
        });

        let depositTemplate85 = await CompetitionTemplate.findOne({ 
            type: 'deposit',
            bonus_percentage: 85 
        });

        // Create templates if they don't exist
        if (!depositTemplate40) {
            depositTemplate40 = await CompetitionTemplate.create({
                name: 'بونص إيداع 40%',
                question: 'مسابقة اختبار - بونص إيداع 40%',
                type: 'deposit',
                bonus_percentage: 40,
                content: 'مسابقة اختبار للبونص الإيداع 40%',
                correct_answer: 'A',
                classification: 'All',
                image_url: '/images/competition_bg.jpg',
                created_by: adminId
            });
            console.log('✓ Created deposit template 40%');
        }

        if (!depositTemplate50) {
            depositTemplate50 = await CompetitionTemplate.create({
                name: 'بونص إيداع 50%',
                question: 'مسابقة اختبار - بونص إيداع 50%',
                type: 'deposit',
                bonus_percentage: 50,
                content: 'مسابقة اختبار للبونص الإيداع 50%',
                correct_answer: 'A',
                classification: 'All',
                image_url: '/images/competition_bg.jpg',
                created_by: adminId
            });
            console.log('✓ Created deposit template 50%');
        }

        if (!depositTemplate60) {
            depositTemplate60 = await CompetitionTemplate.create({
                name: 'بونص إيداع 60%',
                question: 'مسابقة اختبار - بونص إيداع 60%',
                type: 'deposit',
                bonus_percentage: 60,
                content: 'مسابقة اختبار للبونص الإيداع 60%',
                correct_answer: 'A',
                classification: 'All',
                image_url: '/images/competition_bg.jpg',
                created_by: adminId
            });
            console.log('✓ Created deposit template 60%');
        }

        if (!depositTemplate75) {
            depositTemplate75 = await CompetitionTemplate.create({
                name: 'بونص إيداع 75%',
                question: 'مسابقة اختبار - بونص إيداع 75%',
                type: 'deposit',
                bonus_percentage: 75,
                content: 'مسابقة اختبار للبونص الإيداع 75%',
                correct_answer: 'A',
                classification: 'All',
                image_url: '/images/competition_bg.jpg',
                created_by: adminId
            });
            console.log('✓ Created deposit template 75%');
        }

        if (!depositTemplate85) {
            depositTemplate85 = await CompetitionTemplate.create({
                name: 'بونص إيداع 85%',
                question: 'مسابقة اختبار - بونص إيداع 85%',
                type: 'deposit',
                bonus_percentage: 85,
                content: 'مسابقة اختبار للبونص الإيداع 85%',
                correct_answer: 'A',
                classification: 'All',
                image_url: '/images/competition_bg.jpg',
                created_by: adminId
            });
            console.log('✓ Created deposit template 85%');
        }

        // Create test competitions with different deposit bonus percentages
        const now = new Date();
        const competitions = [];

        // 40% - 3 winners
        for (let i = 0; i < 2; i++) {
            competitions.push({
                name: `مسابقة اختبار - بونص إيداع 40% (${i + 1})`,
                description: 'مسابقة اختبار لبيانات التحليلات',
                agent_id: agentId,
                template_id: depositTemplate40._id,
                status: 'completed',
                duration: '1d',
                total_cost: 0,
                ends_at: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000),
                processed_at: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
                winners_count: 0,
                prize_per_winner: 0,
                deposit_winners_count: 3,
                views_count: 150 + i * 20,
                reactions_count: 80 + i * 10,
                participants_count: 100 + i * 15
            });
        }

        // 50% - 5 winners
        for (let i = 0; i < 3; i++) {
            competitions.push({
                name: `مسابقة اختبار - بونص إيداع 50% (${i + 1})`,
                description: 'مسابقة اختبار لبيانات التحليلات',
                agent_id: agentId,
                template_id: depositTemplate50._id,
                status: 'completed',
                duration: '1d',
                total_cost: 0,
                ends_at: new Date(now.getTime() - (i + 3) * 24 * 60 * 60 * 1000),
                processed_at: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000),
                winners_count: 0,
                prize_per_winner: 0,
                deposit_winners_count: 5,
                views_count: 200 + i * 30,
                reactions_count: 120 + i * 15,
                participants_count: 150 + i * 20
            });
        }

        // 60% - 4 winners
        for (let i = 0; i < 2; i++) {
            competitions.push({
                name: `مسابقة اختبار - بونص إيداع 60% (${i + 1})`,
                description: 'مسابقة اختبار لبيانات التحليلات',
                agent_id: agentId,
                template_id: depositTemplate60._id,
                status: 'completed',
                duration: '1d',
                total_cost: 0,
                ends_at: new Date(now.getTime() - (i + 6) * 24 * 60 * 60 * 1000),
                processed_at: new Date(now.getTime() - (i + 5) * 24 * 60 * 60 * 1000),
                winners_count: 0,
                prize_per_winner: 0,
                deposit_winners_count: 4,
                views_count: 180 + i * 25,
                reactions_count: 100 + i * 12,
                participants_count: 130 + i * 18
            });
        }

        // 75% - 6 winners
        for (let i = 0; i < 2; i++) {
            competitions.push({
                name: `مسابقة اختبار - بونص إيداع 75% (${i + 1})`,
                description: 'مسابقة اختبار لبيانات التحليلات',
                agent_id: agentId,
                template_id: depositTemplate75._id,
                status: 'completed',
                duration: '1d',
                total_cost: 0,
                ends_at: new Date(now.getTime() - (i + 8) * 24 * 60 * 60 * 1000),
                processed_at: new Date(now.getTime() - (i + 7) * 24 * 60 * 60 * 1000),
                winners_count: 0,
                prize_per_winner: 0,
                deposit_winners_count: 6,
                views_count: 220 + i * 35,
                reactions_count: 140 + i * 18,
                participants_count: 170 + i * 22
            });
        }

        // 85% - 8 winners
        for (let i = 0; i < 3; i++) {
            competitions.push({
                name: `مسابقة اختبار - بونص إيداع 85% (${i + 1})`,
                description: 'مسابقة اختبار لبيانات التحليلات',
                agent_id: agentId,
                template_id: depositTemplate85._id,
                status: 'completed',
                duration: '1d',
                total_cost: 0,
                ends_at: new Date(now.getTime() - (i + 10) * 24 * 60 * 60 * 1000),
                processed_at: new Date(now.getTime() - (i + 9) * 24 * 60 * 60 * 1000),
                winners_count: 0,
                prize_per_winner: 0,
                deposit_winners_count: 8,
                views_count: 250 + i * 40,
                reactions_count: 160 + i * 20,
                participants_count: 200 + i * 25
            });
        }

        // Insert all competitions
        const insertedCompetitions = await Competition.insertMany(competitions);
        console.log(`\n✓ Successfully created ${insertedCompetitions.length} test deposit competitions!`);

        // Summary
        console.log('\n📊 Summary:');
        console.log('  - 40% Bonus: 6 winners (2 competitions × 3 winners)');
        console.log('  - 50% Bonus: 15 winners (3 competitions × 5 winners)');
        console.log('  - 60% Bonus: 8 winners (2 competitions × 4 winners)');
        console.log('  - 75% Bonus: 12 winners (2 competitions × 6 winners)');
        console.log('  - 85% Bonus: 24 winners (3 competitions × 8 winners)');
        console.log('  Total: 65 deposit bonus winners\n');

        console.log('✓ Now refresh the analytics page to see the data!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
    }
}

// Run the script
addTestDepositCompetitions();
