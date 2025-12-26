const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Competition = require('./src/models/Competition');

async function checkCompetitionData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const competitions = await Competition.find({}).select('name status deposit_winners_count deposit_bonus_percentage trading_winners_count winners_count total_cost createdAt');

        console.log(`Found ${competitions.length} competitions (all statuses).`);

        competitions.forEach(c => {
            console.log('--------------------------------------------------');
            console.log(`Name: ${c.name}`);
            console.log(`Status: ${c.status}`);
            console.log(`Deposit Winners Count: ${c.deposit_winners_count}`);
            console.log(`Deposit Bonus Percentage: ${c.deposit_bonus_percentage}`);
            console.log(`Trading Winners Count: ${c.trading_winners_count}`);
            console.log(`Total Winners Count: ${c.winners_count}`);
            console.log(`Total Cost: ${c.total_cost}`);
            console.log(`Created At: ${c.createdAt}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkCompetitionData();
