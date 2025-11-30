const mongoose = require('mongoose');

const CompetitionTemplateSchema = new mongoose.Schema({
    // البيانات الأساسية للقالب
    question: {
        type: String,
        required: [true, 'سؤال القالب مطلوب'],
        trim: true,
        unique: true
    },
    // Legacy field: some older data/indexes expect `name`.
    name: {
        type: String,
        trim: true,
        // not setting `required` here because older docs may lack it; we will populate it from `question` before validation.
    },
    content: {
        type: String,
        required: [true, 'محتوى القالب مطلوب'],
        trim: true
    },
    // النوع والتصنيف
    type: {
        type: String,
        enum: ['مميزات', 'تفاعلية'],
        default: 'مميزات',
        required: [true, 'نوع القالب مطلوب'],
        trim: true
    },
    bonus_percentage: {
        type: Number,
        default: 0
    },
    classification: {
        type: String,
        enum: ['All', 'R', 'A', 'B', 'C'],
        default: 'All',
        required: [true, 'تصنيف القالب مطلوب']
    },
    // تفاصيل المسابقة
    description: {
        type: String,
        trim: true
    },
    correct_answer: {
        type: String,
        required: [true, 'الإجابة الصحيحة مطلوبة'],
        trim: true
    },
    competition_type: {
        type: String,
        enum: ['standard', 'special'],
        default: 'standard'
    },
    prize_details: {
        type: String,
        trim: true
    },
    deposit_bonus_prize_details: {
        type: String,
        trim: true
    },
    competition_duration: {
        type: String,
        trim: true
    },
    // إحصائيات وضوابط الاستخدام
    usage_limit: {
        type: Number,
        min: [0, 'لا يمكن أن يكون حد الاستخدام أقل من صفر'],
        default: null
    },
    usage_count: {
        type: Number,
        default: 0,
        min: [0, 'لا يمكن أن يكون عدد مرات الاستخدام أقل من صفر']
    },
    // إجمالي مرات الاستخدام عبر كل الدورات (لا يُعاد تعيينه عند إعادة التفعيل)
    usage_total: {
        type: Number,
        default: 0,
        min: [0, 'لا يمكن أن يكون إجمالي مرات الاستخدام أقل من صفر']
    },
    times_used: [{
        date: { type: Date, default: Date.now },
        competition_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition' }
    }],
    // الوسائط والمرفقات
    image_url: {
        type: String,
        trim: true
    },
    attachments: [{
        type: { type: String, enum: ['image', 'document', 'video'] },
        url: String,
        name: String,
        uploaded_at: { type: Date, default: Date.now }
    }],
    // معلومات الحالة
    status: {
        type: String,
        enum: ['active', 'inactive', 'archived'],
        default: 'active'
    },
    is_archived: {
        type: Boolean,
        default: false
    },
    // معلومات المستخدم والتواريخ
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    last_modified_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true, // يضيف createdAt و updatedAt تلقائياً
    collection: 'competitiontemplates'
});

// Ensure legacy `name` field is populated from `question` before validation to avoid unique index collisions
CompetitionTemplateSchema.pre('validate', function(next) {
    try {
        if ((!this.name || this.name === null) && this.question) {
            this.name = this.question;
        }
    } catch (err) {
        // ignore
    }
    next();
});

const CompetitionTemplate = mongoose.model('CompetitionTemplate', CompetitionTemplateSchema);

module.exports = CompetitionTemplate;