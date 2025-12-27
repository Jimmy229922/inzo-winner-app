const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Task = require('../src/models/Task');

async function removeSaturdayTasks() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Task.deleteMany({ day_index: 6 });
        console.log(`Deleted ${result.deletedCount} tasks for Saturday (day_index: 6).`);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error removing Saturday tasks:', error);
        process.exit(1);
    }
}

removeSaturdayTasks();
