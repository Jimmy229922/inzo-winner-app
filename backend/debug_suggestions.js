const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const QuestionSuggestion = require('./src/models/QuestionSuggestion');

async function checkSuggestions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const userId = '69309c3745e000e85c531c71'; // The user ID from the logs
        
        const suggestions = await QuestionSuggestion.find({ suggested_by: userId });
        console.log(`Found ${suggestions.length} suggestions for user ${userId}`);

        suggestions.forEach(s => {
            console.log(`ID: ${s._id}, Status: ${s.status}, Has Update: ${s.has_new_update}, SuggestedBy: ${s.suggested_by}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkSuggestions();
