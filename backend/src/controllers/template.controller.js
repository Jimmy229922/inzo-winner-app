const CompetitionTemplate = require('../models/CompetitionTemplate');
const { logActivity } = require('../utils/logActivity');

// Helper function to normalize type values - shared across all functions
const normalizeType = (val) => {
    if (!val) return undefined;
    // Normalize Unicode and trim to handle any hidden characters
    const v = String(val).trim().normalize('NFC');
    console.log('🔍 [NORMALIZE TYPE] Input:', val, 'Normalized:', v, 'Length:', v.length, 'Char codes:', Array.from(v).map(c => c.charCodeAt(0)));
    
    // Check for exact matches with normalized Arabic text
    if (v === 'مميزات') return 'مميزات';
    if (v === 'تفاعلية') return 'تفاعلية';
    
    // Legacy English support
    if (v === 'standard' || v === 'general') return 'مميزات';
    if (v === 'special' || v === 'trading') return 'تفاعلية';
    
    // أي قيمة أخرى تُهمل وتُترك الافتراضي
    console.warn('⚠️ [NORMALIZE TYPE] Unrecognized type value:', val);
    return undefined;
};

// Get all templates
exports.getAllTemplates = async (req, res) => {
    try {
        const { archived = 'false' } = req.query;
        const query = { is_archived: archived === 'true' };
        const templates = await CompetitionTemplate.find(query).sort({ createdAt: -1 });
        res.json({ data: templates });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching templates.', error: error.message });
    }
};

// Get available templates (non-archived)
exports.getAvailableTemplates = async (req, res) => {
    try {
        const { classification } = req.query;

        // Build the query:
        // 1. Always fetch non-archived templates.
        // 2. The usage limit must not be reached (usage_count < usage_limit OR usage_limit is null).
        // 3. If a classification is provided, fetch templates matching that classification OR 'All'.
        // 4. A template should be active OR scheduled for the future.
        let query = {
            is_archived: false,
            $or: [
                { usage_limit: null },
                { $expr: { $lt: ["$usage_count", "$usage_limit"] } }
            ],
            // This is the key change: include templates that are active now, or scheduled to be active.
            // We assume a template is available for selection if it's not explicitly inactive.
            // The previous logic might have been too strict.
            // 'status' is not a reliable field here, so we check is_active.
            // A template is either active or it's not. We should show all non-archived, usable templates.
            // The logic for "scheduled" is not explicitly in the model via a date field being checked here.
            // So we will rely on `is_archived` and usage limits.
            // Let's simplify the query to just check for not archived and usage limit.
            // The concept of "scheduled" might be handled by another field or not at all.
            // The user says "new or scheduled" templates are not appearing.
            // New templates should have usage_count=0, so they should appear.
            // Let's remove any status/active check to make it less restrictive.
        };

        if (classification && classification !== 'all') {
            query.classification = { $in: [classification, 'All'] }; // Correctly filter by agent's classification and 'All'
        }

        const templates = await CompetitionTemplate.find(query).sort({ question: 1 });
        res.json({ data: templates });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching available templates', error: error.message });
    }
};

// Get template by ID
exports.getTemplateById = async (req, res) => {
    try {
        const template = await CompetitionTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found.' });
        }
        res.json({ data: template });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching template', error: error.message });
    }
};

// Create new template
exports.createTemplate = async (req, res) => {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('📝 [CREATE TEMPLATE] Incoming Request');
        console.log('='.repeat(70));
        console.log('📌 Headers:', {
            'content-type': req.headers['content-type'],
            'content-length': req.headers['content-length']
        });
        console.log('📦 req.body:', JSON.stringify(req.body, null, 2));
        console.log('� Type field details:', {
            value: req.body.type,
            length: req.body.type?.length,
            charCodes: req.body.type ? Array.from(req.body.type).map(c => c.charCodeAt(0)) : [],
            normalized: req.body.type ? req.body.type.normalize('NFC') : null
        });
        console.log('�👤 User ID:', req.user?._id);
        console.log('='.repeat(70) + '\n');

        if (!req.user || !req.user._id) {
            throw new Error('User context is required for template creation');
        }

        // تحضير بيانات القالب مع تضمين كل الحقول المطلوبة
        let templateData = {
            ...req.body,
            created_by: req.user._id,
            last_modified_by: req.user._id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // القيم الافتراضية الأساسية
        const defaults = {
            // نخزن النوع بالعربية مباشرة حسب طلب المستخدم
            type: 'مميزات',
            status: 'active',
            classification: 'All',
            is_archived: false,
            usage_count: 0,
            competition_type: 'standard'
        };

        // دمج القيم الافتراضية مع البيانات المقدمة
        templateData = { ...defaults, ...templateData };
        
        console.log('✓ Template data prepared with defaults');
        
        // معالجة النصوص المضمنة في المحتوى
        if (templateData.type) {
            const t = normalizeType(templateData.type);
            if (t) templateData.type = t; else templateData.type = 'مميزات';
        }

        if (templateData.content) {
            const contentMatches = {
                prize: /الجائزة:([^\n]+)/,
                duration: /مدة المسابقة:([^\n]+)/,
                description: /الوصف:([^\n]+)/,
                type: /النوع:([^\n]+)/
            };

            for (const [key, regex] of Object.entries(contentMatches)) {
                const match = templateData.content.match(regex);
                if (match) {
                    switch(key) {
                        case 'prize':
                            templateData.prize_details = match[1].trim();
                            break;
                        case 'duration':
                            templateData.competition_duration = match[1].trim();
                            break;
                        case 'description':
                            templateData.description = templateData.description || match[1].trim();
                            break;
                        case 'type': {
                            const typeValue = match[1].trim();
                            const t = normalizeType(typeValue);
                            if (t) templateData.type = t;
                            break;
                        }
                    }
                }
            }
        }

        // تنظيف وتحقق من صحة البيانات الأساسية
        if (templateData.question) {
            templateData.question = templateData.question.trim();
        }
        // Backwards-compatibility: some older code/indices expect `name` field.
        // Ensure `name` is populated from `question` when not provided to avoid duplicate-null index errors.
        if (!templateData.name && templateData.question) {
            templateData.name = templateData.question;
        }
        if (templateData.correct_answer) {
            templateData.correct_answer = templateData.correct_answer.trim();
        }

        // التحقق من البيانات الإلزامية قبل الحفظ
        if (!templateData.question || !templateData.content || !templateData.correct_answer) {
            throw new Error('جميع الحقول الإلزامية مطلوبة: السؤال، المحتوى، والإجابة الصحيحة');
        }

        // إنشاء القالب مع البيانات الكاملة
        console.log('🎯 [CREATE TEMPLATE] Final templateData before creating instance:', {
            type: templateData.type,
            typeLength: templateData.type?.length,
            typeCharCodes: templateData.type ? Array.from(templateData.type).map(c => c.charCodeAt(0)) : [],
            classification: templateData.classification,
            question: templateData.question?.substring(0, 50)
        });
        
        const template = new CompetitionTemplate(templateData);

        // التحقق من صحة البيانات قبل الحفظ
        const validationError = template.validateSync();
        if (validationError) {
            console.error('❌ [VALIDATION ERROR]:', validationError);
            throw validationError;
        }

        // حفظ القالب في قاعدة البيانات
        await template.save();

        console.log('✅ [CREATE TEMPLATE] Successfully created template:', {
            id: template._id,
            question: template.question,
            classification: template.classification,
            type: template.type
        });

        // تسجيل النشاط بعد النجاح في إنشاء القالب
        if (req.user && req.user._id) {
            await logActivity(req.user._id, template._id, 'TEMPLATE_CREATED', 
                `تم إنشاء قالب جديد: ${template.question}`,
                { templateId: template._id, templateType: template.type }
            );
        }

        res.status(201).json({
            success: true,
            message: 'تم إنشاء القالب بنجاح',
            data: template
        });
    } catch (error) {
        // --- IMPROVEMENT: Provide more detailed error messages ---
        console.error('\n' + '='.repeat(70));
        console.error('❌ [CREATE TEMPLATE] Failed to create template');
        console.error('='.repeat(70));
        console.error('🐛 Error Type:', error.constructor.name);
        console.error('💬 Error Message:', error.message);
        if (error.errors) {
            console.error('📋 Validation Errors:', Object.keys(error.errors).map(key => 
                `${key}: ${error.errors[key].message}`
            ));
        }
        console.error('📦 Request Body:', req.body);
        console.error('🔗 Full Stack:', error.stack);
        console.error('='.repeat(70) + '\n');
        
        // Check for Mongoose validation error
        const errorMessage = error.name === 'ValidationError' ? Object.values(error.errors).map(e => e.message).join(', ') : error.message;
        
        res.status(400).json({ message: `فشل إنشاء القالب: ${errorMessage}`, error: error });
    }
};

// Update template
exports.updateTemplate = async (req, res) => {
    try {
        // Ensure legacy `name` field is kept in sync with `question` if present
        const updateData = { ...req.body };
        // Normalize type if provided in Arabic or other forms
        if (updateData.type) {
            const t = normalizeType(updateData.type);
            if (t) updateData.type = t; else delete updateData.type; // لا نغير إن غير صالح
        }
        if (updateData.question && !updateData.name) updateData.name = updateData.question;

        const template = await CompetitionTemplate.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        if (!template) {
            return res.status(404).json({ message: 'Template not found.' });
        }
        // FIX: Ensure req.user._id is passed for logging
        if (req.user && req.user._id) {
            await logActivity(req.user._id, null, 'TEMPLATE_UPDATED', `تم تحديث القالب: ${template.question}`);
        }
        res.json({ data: template });
    } catch (error) {
        // --- IMPROVEMENT: Provide more detailed error messages ---
        console.error('[CREATE TEMPLATE ERROR]', error); // Log the full error on the server
        // Check for Mongoose validation error
        const errorMessage = error.name === 'ValidationError' ? Object.values(error.errors).map(e => e.message).join(', ') : error.message;
        
        res.status(400).json({ message: `فشل إنشاء القالب: ${errorMessage}`, error: error });
    }
};

// Delete (archive) template
exports.deleteTemplate = async (req, res) => {
    try {
        const template = await CompetitionTemplate.findByIdAndUpdate(
            req.params.id,
            { is_archived: true },
            { new: true }
        );
        if (!template) {
            return res.status(404).json({ message: 'Template not found.' });
        }
        // FIX: Ensure req.user._id is passed for logging
        if (req.user && req.user._id) {
            await logActivity(req.user._id, null, 'TEMPLATE_DELETED', `تم حذف القالب: ${template.question}`);
        }
        res.json({ message: 'Template archived successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete template.', error: error.message });
    }
};

// --- NEW: Permanently delete a template ---
exports.permanentlyDeleteTemplate = async (req, res) => {
    try {
        const template = await CompetitionTemplate.findByIdAndDelete(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found.' });
        }
        // FIX: Ensure req.user._id is passed for logging
        if (req.user && req.user._id) {
            await logActivity(req.user._id, null, 'TEMPLATE_PERMANENTLY_DELETED', `تم حذف القالب نهائياً: ${template.question}`);
        }
        res.json({ message: 'Template permanently deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to permanently delete template.', error: error.message });
    }
};

// Reactivate template
exports.reactivateTemplate = async (req, res) => {
    try {
        // When reactivating a template that was archived due to hitting its usage limit,
        // reset the usage counter so it becomes available again to agents.
        const template = await CompetitionTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found.' });
        }

    template.is_archived = false;
    // Reset the usage counter (current cycle) but keep lifetime total
    template.usage_count = 0;
    // Ensure status is active for safety (in case it was marked inactive by other flows)
    template.status = 'active';
    // Do NOT reset usage_total so historical count remains accurate
        await template.save();

        // FIX: Ensure req.user._id is passed for logging
        if (req.user && req.user._id) {
            await logActivity(req.user._id, null, 'TEMPLATE_REACTIVATED', `تمت إعادة تفعيل القالب: ${template.question}`);
        }
        res.json({ data: template });
    } catch (error) {
        res.status(500).json({ message: 'Failed to reactivate template.', error: error.message });
    }
};

// Check if a template with the same question exists
exports.checkTemplateExistence = async (req, res) => {
    try {
        const { question } = req.query;
        if (!question) {
            return res.status(400).json({ exists: false, message: 'Question parameter is required.' });
        }

        // Find a template with the exact same question text, regardless of archive status
        const template = await CompetitionTemplate.findOne({ question: question });

        if (template) {
            // If found, indicate if it's archived or active
            if (template.is_archived) {
                res.json({ exists: true, archived: true, message: 'A template with this question exists in the archive.' });
            } else {
                res.json({ exists: true, archived: false, message: 'A template with this question already exists.' });
            }
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error while checking template existence.', error: error.message });
    }
};