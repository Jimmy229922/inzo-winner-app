const mongoose = require('mongoose');

async function clearAll() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/inzo-db';
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);

    const Competition = mongoose.model('Competition', new mongoose.Schema({}, { strict: false, collection: 'competitions' }));

    const before = await Competition.countDocuments();
    const completedBefore = await Competition.countDocuments({ status: 'completed' });
    console.log(`Before delete -> total: ${before}, completed: ${completedBefore}`);

    const res = await Competition.deleteMany({});
    console.log('Delete result:', res);

    const after = await Competition.countDocuments();
    const completedAfter = await Competition.countDocuments({ status: 'completed' });
    console.log(`After delete -> total: ${after}, completed: ${completedAfter}`);

    process.exit(0);
  } catch (err) {
    console.error('Error clearing competitions:', err);
    process.exit(1);
  }
}

clearAll();
