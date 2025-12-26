const mongoose = require('mongoose');

const questionSuggestionSchema = new mongoose.Schema({
    // معلومات المقترح (الموظف)
    suggested_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    suggested_by_name: {
        type: String,
        required: true
    },
    suggested_by_role: {
        type: String,
        enum: ['user', 'employee', 'admin', 'super_admin'], // أضفنا 'user' لتوافق نموذج User
        required: true,
        default: 'user' // قيمة افتراضية للبيانات القديمة
    },
    
    // السؤال المقترح
    question: {
        type: String,
        required: true,
        trim: true
    },
    
    // الإجابة الصحيحة
    correct_answer: {
        type: String,
        required: true,
        trim: true
    },
    
    // معلومات إضافية اختيارية
    category: {
        type: String,
        enum: ['general', 'technical', 'trading', 'market', 'other'],
        default: 'general'
    },
    // اسم تصنيف مخصص عندما تكون category = 'other'
    custom_category: {
        type: String,
        trim: true
    },
    
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    
    // ملاحظات إضافية من المقترح
    additional_notes: {
        type: String,
        trim: true,
        default: ''
    },
    
    // حالة الاقتراح
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'needs_revision'],
        default: 'pending'
    },
    
    // التقييم من الإدارة
    evaluation: {
        reviewed_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewed_by_name: String,
        reviewed_at: Date,
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        feedback: String,
        admin_notes: String
    },
    
    // إشعار للموظف
    employee_notified: {
        type: Boolean,
        default: false
    },
    
    // إذا تم استخدامه في مسابقة
    used_in_competition: {
        type: Boolean,
        default: false
    },
    competition_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Competition'
    },

    // NEW: Flag for unread updates
    has_new_update: {
        type: Boolean,
        default: false
    },

    // NEW: Flag for archived suggestions
    is_archived: {
        type: Boolean,
        default: false
    },
    
    // NEW: Who archived the suggestion
    archived_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
    
}, {
    timestamps: true
});

// Index للبحث السريع
questionSuggestionSchema.index({ suggested_by: 1, status: 1 });
questionSuggestionSchema.index({ status: 1, createdAt: -1 });

const QuestionSuggestion = mongoose.model('QuestionSuggestion', questionSuggestionSchema);

module.exports = QuestionSuggestion;

