const mongoose = require('mongoose');

async function countCompetitions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/inzo_winner');
    
    const Competition = mongoose.model('Competition', new mongoose.Schema({}, { strict: false }));
    
    console.log('Active DB (env):', process.env.MONGODB_URI);
    const total = await Competition.countDocuments();
    console.log('Total competitions (current DB):', total);
    
    const completed = await Competition.countDocuments({ status: 'completed' });
    console.log('Completed competitions (current DB):', completed);
    
    const withDeposit = await Competition.countDocuments({ 
      status: 'completed', 
      deposit_bonus_percentage: { $gt: 0 } 
    });
    console.log('Completed with deposit_bonus_percentage > 0 (current DB):', withDeposit);

    const testComps = await Competition.find({
      deposit_bonus_percentage: { $gt: 0 }
    }).select('name status');
    
    console.log('\nTest competitions with deposit bonus:');
    testComps.forEach(c => {
      console.log(`  - ${c.name} | status: ${c.status}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

countCompetitions();
