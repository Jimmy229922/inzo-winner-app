require('dotenv').config();
const mongoose = require('mongoose');
const migrateTemplateTypes = require('../src/migration-fix-template-types');

(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('[Migration] MONGODB_URI is not set in .env');
      process.exit(1);
    }
    await mongoose.connect(uri);
    console.log('[Migration] Connected to MongoDB');
    await migrateTemplateTypes();
  } catch (err) {
    console.error('[Migration] Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Disconnected. Done.');
    process.exit(0);
  }
})();
