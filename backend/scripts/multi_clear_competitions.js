const mongoose = require('mongoose');

const DBS = [
  'mongodb://127.0.0.1:27017/inzo-db', // active env
  'mongodb://127.0.0.1:27017/inzo_winner', // old underscore
  'mongodb://127.0.0.1:27017/inzo-winner-app' // hyphen
];

async function clear(db) {
  const conn = await mongoose.createConnection(db).asPromise();
  const Competition = conn.model('Competition', new mongoose.Schema({}, { strict: false, collection: 'competitions' }));
  const before = await Competition.countDocuments();
  const res = await Competition.deleteMany({});
  const after = await Competition.countDocuments();
  await conn.close();
  return { db, before, deleted: res.deletedCount, after };
}

(async () => {
  try {
    const results = [];
    for (const db of DBS) {
      console.log('Clearing DB:', db);
      results.push(await clear(db));
    }
    console.table(results);
    process.exit(0);
  } catch (e) {
    console.error('Error multi clearing:', e);
    process.exit(1);
  }
})();
