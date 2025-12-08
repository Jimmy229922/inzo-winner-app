const QuestionSuggestion = require('../models/QuestionSuggestion');
const User = require('../models/User');
const { logActivity } = require('../utils/logActivity');

// ==============================================
// للموظفين - إضافة اقتراح سؤال جديد
// ==============================================
exports.submitSuggestion = async (req, res) => {
    try {
        const { question, correct_answer, category, difficulty, additional_notes, custom_category } = req.body;
        const userId = req.user._id;
        const userName = req.user.full_name;

        console.log('📝 [Question Suggestion] Received submission from:', userName, 'User ID:', userId);
        console.log('📝 [Question Suggestion] Data:', { question, correct_answer, category, difficulty });

        // التحقق من البيانات
        if (!question || !correct_answer) {
            console.log('❌ [Question Suggestion] Validation failed: Missing question or answer');
            return res.status(400).json({
                success: false,
                message: 'السؤال والإجابة مطلوبان'
            });
        }

        // تحقق من التصنيف المخصص عند اختيار other
        if (category === 'other' && (!custom_category || !custom_category.trim())) {
            console.log('❌ [Question Suggestion] Validation failed: Missing custom category');
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال اسم التصنيف المخصص عند اختيار أخرى'
            });
        }

        // إنشاء الاقتراح
        const role = req.user.role || 'user'; // استخدام الدور الفعلي من المستخدم
        const suggestion = new QuestionSuggestion({
            suggested_by: userId,
            suggested_by_name: userName,
            suggested_by_role: role,
            question: question.trim(),
            correct_answer: correct_answer.trim(),
            category: category || 'general',
            difficulty: difficulty || 'medium',
            additional_notes: additional_notes ? additional_notes.trim() : '',
            status: 'pending'
        });

        await suggestion.save();

        console.log('✅ [Question Suggestion] Saved successfully! ID:', suggestion._id);
        console.log('✅ [Question Suggestion] Details:', {
            id: suggestion._id,
            suggested_by: userName,
            question: question.substring(0, 50) + '...',
            status: suggestion.status
        });

        // تسجيل النشاط
        await logActivity(
            userId,
            null, // agentId
            'suggestion_submitted',
            `تم إرسال اقتراح سؤال جديد`,
            { 
                suggestionId: suggestion._id,
                question: question.substring(0, 50) + '...',
                category: category
            }
        );

        // Notify Super Admins via WebSocket
        try {
            const superAdmins = await User.find({ role: 'super_admin' }).select('_id');
            const onlineClients = req.app.locals.onlineClients;
            if (onlineClients) {
                superAdmins.forEach(admin => {
                    const client = onlineClients.get(admin._id.toString());
                    if (client && client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'new_suggestion' }));
                    }
                });
            }
        } catch (wsError) {
            console.error('⚠️ [WebSocket] Failed to notify super admins:', wsError);
        }

        res.status(201).json({
            success: true,
            message: 'تم إرسال الاقتراح بنجاح',
            data: suggestion
        });

    } catch (error) {
        console.error('❌ [Question Suggestion] Error submitting suggestion:', error);
        console.error('❌ [Question Suggestion] Error name:', error.name);
        console.error('❌ [Question Suggestion] Error message:', error.message);
        console.error('❌ [Question Suggestion] Error stack:', error.stack);
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
// عام - عرض الاقتراحات المعتمدة فقط (للموظفين)
// ==============================================
exports.getPublicApprovedSuggestions = async (req, res) => {
    try {
        const { category, page = 1, limit = 50 } = req.query;
        const query = { status: 'approved' };
        if (category) query.category = category;

        const suggestions = await QuestionSuggestion.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const count = await QuestionSuggestion.countDocuments(query);

        return res.json({
            success: true,
            data: suggestions,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalSuggestions: count
        });
    } catch (err) {
        console.error('[getPublicApprovedSuggestions] error', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ==============================================
// للإدارة - عرض جميع الاقتراحات
// ==============================================
exports.getAllSuggestions = async (req, res) => {
    try {
        const { status, page = 1, limit = 50, category } = req.query;
        const userRole = req.user.role;
        const userId = req.user._id;

        // تحديد نطاق الرؤية (Visibility Scope)
        let baseQuery = {};
        if (userRole !== 'super_admin') {
            // الموظف والأدمن العادي يرى:
            // 1. جميع الاقتراحات المقبولة (من أي شخص)
            // 2. اقتراحاته الشخصية (بأي حالة كانت)
            baseQuery = {
                $or: [
                    { status: 'approved' },
                    { suggested_by: userId }
                ]
            };
        }

        // دمج نطاق الرؤية مع الفلاتر المطلوبة
        const query = { ...baseQuery };
        
        // التعامل مع الأرشفة
        if (req.query.is_archived === 'true') {
            query.is_archived = true;
            
            // NEW: Filter by who archived it if requested
            if (req.query.archived_by_me === 'true') {
                query.archived_by = userId;
            }
        } else if (req.query.include_archived !== 'true') {
            // افتراضياً، لا تعرض المؤرشفة إلا إذا طلب ذلك
            query.is_archived = { $ne: true };
        }

        if (status) {
            // إضافة فلتر الحالة (سيتم تطبيقه كـ AND مع baseQuery)
            query.status = status;
        }
        if (category) {
            query.category = category;
        }

        const suggestions = await QuestionSuggestion.find(query)
            .populate('suggested_by', 'full_name email')
            .populate('evaluation.reviewed_by', 'full_name')
            .populate('archived_by', 'full_name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const count = await QuestionSuggestion.countDocuments(query);

        // دالة مساعدة لحساب الإحصائيات بناءً على نطاق الرؤية
        const countWithStatus = async (s) => {
            const statusQuery = { ...baseQuery };
            statusQuery.status = s;
            return await QuestionSuggestion.countDocuments(statusQuery);
        };

        // إحصائيات سريعة (تراعي نطاق الرؤية)
        const stats = {
            total: await QuestionSuggestion.countDocuments(baseQuery),
            pending: await countWithStatus('pending'),
            approved: await countWithStatus('approved'),
            rejected: await countWithStatus('rejected'),
            needs_revision: await countWithStatus('needs_revision')
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

        console.log('🔍 [Evaluate] Starting evaluation for suggestion:', id);
        console.log('🔍 [Evaluate] Reviewer:', reviewerName, 'ID:', reviewerId);
        console.log('🔍 [Evaluate] Data:', { status, rating, feedback, admin_notes });

        // التحقق من الحالة
        const validStatuses = ['approved', 'rejected', 'needs_revision', 'pending'];
        if (!validStatuses.includes(status)) {
            console.log('❌ [Evaluate] Invalid status:', status);
            return res.status(400).json({
                success: false,
                message: 'الحالة غير صحيحة'
            });
        }

        const suggestion = await QuestionSuggestion.findById(id);
        if (!suggestion) {
            console.log('❌ [Evaluate] Suggestion not found:', id);
            return res.status(404).json({
                success: false,
                message: 'الاقتراح غير موجود'
            });
        }

        console.log('✅ [Evaluate] Found suggestion:', suggestion._id);
        console.log('✅ [Evaluate] Current status:', suggestion.status);

        // التأكد من وجود suggested_by_role للبيانات القديمة
        if (!suggestion.suggested_by_role) {
            console.log('⚠️ [Evaluate] Missing suggested_by_role, setting default value: user');
            suggestion.suggested_by_role = 'user';
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
        suggestion.has_new_update = true; // NEW: Mark as having a new update for the employee

        console.log('💾 [Evaluate] Saving suggestion with new evaluation...');
        await suggestion.save();
        console.log('✅ [Evaluate] Saved successfully!');

        // تسجيل النشاط
        await logActivity(
            reviewerId,
            null, // agentId - لا يوجد agent مرتبط
            'suggestion_evaluated',
            `تم تقييم اقتراح السؤال بحالة ${status}`,
            { 
                suggestionId: suggestion._id,
                status, 
                rating,
                suggestedBy: suggestion.suggested_by_name
            }
        );

        console.log('✅ [Evaluate] Activity logged successfully');

        // Notify the submitter via WebSocket
        try {
            const onlineClients = req.app.locals.onlineClients;
            if (onlineClients) {
                const client = onlineClients.get(suggestion.suggested_by.toString());
                if (client && client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'suggestion_update' }));
                }
            }
        } catch (wsError) {
            console.error('⚠️ [WebSocket] Failed to notify submitter:', wsError);
        }

        res.json({
            success: true,
            message: 'تم تقييم الاقتراح بنجاح',
            data: suggestion
        });

    } catch (error) {
        console.error('❌ [Evaluate] Error evaluating suggestion:', error);
        console.error('❌ [Evaluate] Error name:', error.name);
        console.error('❌ [Evaluate] Error message:', error.message);
        console.error('❌ [Evaluate] Error stack:', error.stack);
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
            req.user._id,
            null, // agentId
            'suggestion_deleted',
            `تم حذف اقتراح سؤال`,
            { 
                suggestionId: id,
                question: suggestion.question.substring(0, 50),
                suggestedBy: suggestion.suggested_by_name
            }
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

// ==============================================
// للسوبر أدمن - عدد الاقتراحات قيد المراجعة (pending)
// ==============================================
exports.getUnreadCount = async (req, res) => {
    try {
        // عد الاقتراحات قيد المراجعة فقط
        const pendingCount = await QuestionSuggestion.countDocuments({ status: 'pending' });

        res.json({
            success: true,
            data: {
                unreadCount: pendingCount
            }
        });

    } catch (error) {
        console.error('❌ Error fetching unread count:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب عدد الاقتراحات غير المقروءة',
            error: error.message
        });
    }
};

// NEW: Get unread updates count for the current employee
exports.getEmployeeUnreadUpdatesCount = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log('🔍 [Employee Unread] Checking updates for user:', userId);
        
        const count = await QuestionSuggestion.countDocuments({
            suggested_by: userId,
            has_new_update: true
        });
        
        console.log('✅ [Employee Unread] Found count:', count);
        res.json({ success: true, data: { unreadCount: count } });
    } catch (error) {
        console.error('Error fetching employee unread updates:', error);
        res.status(500).json({ success: false, message: 'Error fetching updates count' });
    }
};

// NEW: Mark all updates as seen for the current employee
exports.markUpdatesAsSeen = async (req, res) => {
    try {
        const userId = req.user._id;
        await QuestionSuggestion.updateMany(
            { suggested_by: userId, has_new_update: true },
            { $set: { has_new_update: false } }
        );
        res.json({ success: true, message: 'Updates marked as seen' });
    } catch (error) {
        console.error('Error marking updates as seen:', error);
        res.status(500).json({ success: false, message: 'Error marking updates as seen' });
    }
};

// ==============================================
// للإدارة - أرشفة اقتراح
// ==============================================
exports.archiveSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        
        const suggestion = await QuestionSuggestion.findByIdAndUpdate(
            id,
            { 
                is_archived: true,
                archived_by: userId
            },
            { new: true }
        );

        if (!suggestion) {
            return res.status(404).json({
                success: false,
                message: 'الاقتراح غير موجود'
            });
        }

        res.json({
            success: true,
            message: 'تم أرشفة الاقتراح بنجاح',
            data: suggestion
        });
    } catch (error) {
        console.error('Error archiving suggestion:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء أرشفة الاقتراح',
            error: error.message
        });
    }
};

// ==============================================
// للموظفين - تعديل اقتراح (عند طلب التعديل)
// ==============================================
exports.updateSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, correct_answer, category, difficulty, additional_notes, custom_category } = req.body;
        const userId = req.user._id;

        const suggestion = await QuestionSuggestion.findOne({ _id: id, suggested_by: userId });

        if (!suggestion) {
            return res.status(404).json({
                success: false,
                message: 'الاقتراح غير موجود أو ليس لديك صلاحية تعديله'
            });
        }

        if (suggestion.status !== 'needs_revision') {
            return res.status(400).json({
                success: false,
                message: 'يمكن تعديل الاقتراحات التي تحتاج إلى مراجعة فقط'
            });
        }

        // تحديث البيانات
        if (question) suggestion.question = question.trim();
        if (correct_answer) suggestion.correct_answer = correct_answer.trim();
        if (category) suggestion.category = category;
        if (difficulty) suggestion.difficulty = difficulty;
        if (additional_notes !== undefined) suggestion.additional_notes = additional_notes.trim();
        if (custom_category !== undefined) suggestion.custom_category = custom_category.trim();
        
        // إعادة الحالة إلى قيد الانتظار
        suggestion.status = 'pending';
        suggestion.has_new_update = false; // Reset unread flag if any

        await suggestion.save();

        // Notify Super Admins via WebSocket
        try {
            const User = require('../models/User');
            const superAdmins = await User.find({ role: 'super_admin' }).select('_id');
            const onlineClients = req.app.locals.onlineClients;
            if (onlineClients) {
                superAdmins.forEach(admin => {
                    const client = onlineClients.get(admin._id.toString());
                    if (client && client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'suggestion_updated', id: suggestion._id }));
                    }
                });
            }
        } catch (wsError) {
            console.error('⚠️ [WebSocket] Failed to notify super admins:', wsError);
        }

        res.json({
            success: true,
            message: 'تم تحديث الاقتراح وإعادة إرساله بنجاح',
            data: suggestion
        });

    } catch (error) {
        console.error('Error updating suggestion:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تحديث الاقتراح',
            error: error.message
        });
    }
};

