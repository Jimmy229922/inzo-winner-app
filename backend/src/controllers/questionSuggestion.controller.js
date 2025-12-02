const QuestionSuggestion = require('../models/QuestionSuggestion');
const { logActivity } = require('../utils/logActivity');

// ==============================================
// للموظفين - إضافة اقتراح سؤال جديد
// ==============================================
exports.submitSuggestion = async (req, res) => {
    try {
        const { question, correct_answer, category, difficulty, additional_notes, custom_category } = req.body;
        const userId = req.user._id;
        const userName = req.user.full_name;

        // التحقق من البيانات
        if (!question || !correct_answer) {
            return res.status(400).json({
                success: false,
                message: 'السؤال والإجابة مطلوبان'
            });
        }

        // تحقق من التصنيف المخصص عند اختيار other
        if (category === 'other' && (!custom_category || !custom_category.trim())) {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال اسم التصنيف المخصص عند اختيار أخرى'
            });
        }

        // إنشاء الاقتراح
        const suggestion = new QuestionSuggestion({
            suggested_by: userId,
            suggested_by_name: userName,
            question: question.trim(),
            correct_answer: correct_answer.trim(),
            category: category || 'general',
            custom_category: category === 'other' ? custom_category?.trim() : undefined,
            difficulty: difficulty || 'medium',
            additional_notes: additional_notes ? additional_notes.trim() : '',
            status: 'pending'
        });

        await suggestion.save();

        // تسجيل النشاط
        await logActivity(
            userId,
            'suggestion_submitted',
            'QuestionSuggestion',
            suggestion._id,
            { question: question.substring(0, 50) + '...' }
        );

        res.status(201).json({
            success: true,
            message: 'تم إرسال الاقتراح بنجاح',
            data: suggestion
        });

    } catch (error) {
        console.error('Error submitting suggestion:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إرسال الاقتراح',
            error: error.message
        });
    }
};

// ==============================================
// للموظفين - عرض اقتراحاتهم الخاصة
// ==============================================
exports.getMySuggestions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, page = 1, limit = 20 } = req.query;

        const query = { suggested_by: userId };
        if (status) {
            query.status = status;
        }

        const suggestions = await QuestionSuggestion.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const count = await QuestionSuggestion.countDocuments(query);

        res.json({
            success: true,
            data: suggestions,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalSuggestions: count
        });

    } catch (error) {
        console.error('Error fetching my suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب الاقتراحات',
            error: error.message
        });
    }
};

// ==============================================
// للإدارة - عرض جميع الاقتراحات
// ==============================================
exports.getAllSuggestions = async (req, res) => {
    try {
        const { status, page = 1, limit = 50, category } = req.query;

        const query = {};
        if (status) {
            query.status = status;
        }
        if (category) {
            query.category = category;
        }

        const suggestions = await QuestionSuggestion.find(query)
            .populate('suggested_by', 'full_name email')
            .populate('evaluation.reviewed_by', 'full_name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const count = await QuestionSuggestion.countDocuments(query);

        // إحصائيات سريعة
        const stats = {
            total: count,
            pending: await QuestionSuggestion.countDocuments({ status: 'pending' }),
            approved: await QuestionSuggestion.countDocuments({ status: 'approved' }),
            rejected: await QuestionSuggestion.countDocuments({ status: 'rejected' }),
            needs_revision: await QuestionSuggestion.countDocuments({ status: 'needs_revision' })
        };

        res.json({
            success: true,
            data: suggestions,
            stats,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalSuggestions: count
        });

    } catch (error) {
        console.error('Error fetching all suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب الاقتراحات',
            error: error.message
        });
    }
};

// ==============================================
// للإدارة - تقييم اقتراح
// ==============================================
exports.evaluateSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rating, feedback, admin_notes } = req.body;
        const reviewerId = req.user._id;
        const reviewerName = req.user.full_name;

        // التحقق من الحالة
        const validStatuses = ['approved', 'rejected', 'needs_revision'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'الحالة غير صحيحة'
            });
        }

        const suggestion = await QuestionSuggestion.findById(id);
        if (!suggestion) {
            return res.status(404).json({
                success: false,
                message: 'الاقتراح غير موجود'
            });
        }

        // تحديث التقييم
        suggestion.status = status;
        suggestion.evaluation = {
            reviewed_by: reviewerId,
            reviewed_by_name: reviewerName,
            reviewed_at: new Date(),
            rating: rating || null,
            feedback: feedback || '',
            admin_notes: admin_notes || ''
        };
        suggestion.employee_notified = false; // سيتم إرسال إشعار

        await suggestion.save();

        // تسجيل النشاط
        await logActivity(
            reviewerId,
            'suggestion_evaluated',
            'QuestionSuggestion',
            suggestion._id,
            { status, rating }
        );

        res.json({
            success: true,
            message: 'تم تقييم الاقتراح بنجاح',
            data: suggestion
        });

    } catch (error) {
        console.error('Error evaluating suggestion:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تقييم الاقتراح',
            error: error.message
        });
    }
};

// ==============================================
// حذف اقتراح (للإدارة فقط)
// ==============================================
exports.deleteSuggestion = async (req, res) => {
    try {
        const { id } = req.params;

        const suggestion = await QuestionSuggestion.findByIdAndDelete(id);
        if (!suggestion) {
            return res.status(404).json({
                success: false,
                message: 'الاقتراح غير موجود'
            });
        }

        await logActivity(
            req.user.id,
            'suggestion_deleted',
            'QuestionSuggestion',
            id,
            { question: suggestion.question.substring(0, 50) }
        );

        res.json({
            success: true,
            message: 'تم حذف الاقتراح بنجاح'
        });

    } catch (error) {
        console.error('Error deleting suggestion:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء حذف الاقتراح',
            error: error.message
        });
    }
};

// ==============================================
// تحديث حالة الإشعار
// ==============================================
exports.markAsNotified = async (req, res) => {
    try {
        const { id } = req.params;

        await QuestionSuggestion.findByIdAndUpdate(id, {
            employee_notified: true
        });

        res.json({
            success: true,
            message: 'تم تحديث حالة الإشعار'
        });

    } catch (error) {
        console.error('Error marking as notified:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ',
            error: error.message
        });
    }
};

// ==============================================
// الحصول على إحصائيات الموظف
// ==============================================
exports.getMyStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = {
            total: await QuestionSuggestion.countDocuments({ suggested_by: userId }),
            pending: await QuestionSuggestion.countDocuments({ suggested_by: userId, status: 'pending' }),
            approved: await QuestionSuggestion.countDocuments({ suggested_by: userId, status: 'approved' }),
            rejected: await QuestionSuggestion.countDocuments({ suggested_by: userId, status: 'rejected' }),
            needs_revision: await QuestionSuggestion.countDocuments({ suggested_by: userId, status: 'needs_revision' }),
            used_in_competitions: await QuestionSuggestion.countDocuments({ suggested_by: userId, used_in_competition: true })
        };

        // متوسط التقييم
        const suggestions = await QuestionSuggestion.find({
            suggested_by: userId,
            'evaluation.rating': { $exists: true, $ne: null }
        }).select('evaluation.rating');

        const ratings = suggestions.map(s => s.evaluation.rating);
        stats.average_rating = ratings.length > 0 
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
            : null;

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching my stats:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب الإحصائيات',
            error: error.message
        });
    }
};
