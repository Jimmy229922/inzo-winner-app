exports.getAllSuggestions = async (req, res) => {
    try {
        const { status, page = 1, limit = 50, category } = req.query;
        const userRole = req.user.role;
        const isEmployee = req.isEmployee;

        console.log('📊 [Get All Suggestions] Request from:', req.user.full_name, 'Role:', userRole);
        console.log('📊 [Get All Suggestions] Filters:', { status, page, limit, category, isEmployee });

        const query = {};
        if (status) {
            query.status = status;
        }
        if (category) {
            query.category = category;
        }

        console.log('📊 [Get All Suggestions] Database query:', query);

        const suggestions = await QuestionSuggestion.find(query)
            .populate('suggested_by', 'full_name email')
            .populate('evaluation.reviewed_by', 'full_name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        console.log('✅ [Get All Suggestions] Found', suggestions.length, 'suggestions in database');
        
        if (suggestions.length > 0) {
            console.log('✅ [Get All Suggestions] First suggestion:', {
                id: suggestions[0]._id,
                question: suggestions[0].question?.substring(0, 50) + '...',
                suggested_by: suggestions[0].suggested_by_name,
                status: suggestions[0].status,
                created: suggestions[0].createdAt
            });
        } else {
            console.log('⚠️ [Get All Suggestions] No suggestions found with filters:', query);
        }

        const count = await QuestionSuggestion.countDocuments(query);

        // إحصائيات سريعة
        const stats = {
            total: count,
            pending: await QuestionSuggestion.countDocuments({ status: 'pending' }),
            approved: await QuestionSuggestion.countDocuments({ status: 'approved' }),
            rejected: await QuestionSuggestion.countDocuments({ status: 'rejected' }),
            needs_revision: await QuestionSuggestion.countDocuments({ status: 'needs_revision' })
        };

        console.log('✅ [Get All Suggestions] Sending response with stats:', stats);

        res.json({
            success: true,
            data: suggestions,
            stats,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalSuggestions: count
        });

    } catch (error) {
        console.error('❌ [Get All Suggestions] Error fetching all suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب الاقتراحات',
            error: error.message
        });
    }
};
