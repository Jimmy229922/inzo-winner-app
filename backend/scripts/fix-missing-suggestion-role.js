/**
 * Script لتحديث البيانات القديمة وإضافة suggested_by_role المفقود
 */

require('dotenv').config();
const mongoose = require('mongoose');
const QuestionSuggestion = require('../src/models/QuestionSuggestion');

async function fixMissingSuggestionRole() {
    try {
        // الاتصال بقاعدة البيانات
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // البحث عن جميع الاقتراحات التي لا تحتوي على suggested_by_role
        const suggestions = await QuestionSuggestion.find({
            $or: [
                { suggested_by_role: { $exists: false } },
                { suggested_by_role: null },
                { suggested_by_role: '' }
            ]
        });

        console.log(`📊 Found ${suggestions.length} suggestions without suggested_by_role`);

        if (suggestions.length === 0) {
            console.log('✅ No suggestions need updating');
            process.exit(0);
        }

        // تحديث كل اقتراح
        let updated = 0;
        for (const suggestion of suggestions) {
            suggestion.suggested_by_role = 'user'; // قيمة افتراضية
            await suggestion.save({ validateBeforeSave: false });
            updated++;
            console.log(`✅ Updated suggestion ${suggestion._id} - ${updated}/${suggestions.length}`);
        }

        console.log(`🎉 Successfully updated ${updated} suggestions`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixMissingSuggestionRole();
