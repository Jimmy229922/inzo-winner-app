const CompetitionTemplate = require('../models/CompetitionTemplate');
const { logActivity } = require('../utils/logActivity');

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
        let query = {
            is_archived: false,
            $or: [
                { usage_limit: null },
                { $expr: { $lt: ["$usage_count", "$usage_limit"] } }
            ]
        };

        if (classification && classification !== 'all') {
            query.classification = { $in: [classification, 'All'] }; // Correctly filter by agent's classification and 'All'
        }

        const templates = await CompetitionTemplate.find(query).sort({ name: 1 });
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
    console.log('DEBUG (Backend): Content-Type header:', req.headers['content-type']);
    console.log('DEBUG (Backend): Raw req.body:', req.body);
    try {
        // FIX: Ensure the 'question' field is populated from 'name' if it's missing.
        const templateData = { ...req.body };
        if (templateData.name && !templateData.question) {
            templateData.question = templateData.name;
        }
        const template = new CompetitionTemplate(templateData);
        await template.save();
        // FIX: Ensure req.user._id is passed for logging
        if (req.user && req.user._id) {
            await logActivity(req.user._id, null, 'TEMPLATE_CREATED', `تم إنشاء قالب جديد: ${template.question}`);
        }
        res.status(201).json({ data: template });
    } catch (error) {
        // --- IMPROVEMENT: Provide more detailed error messages ---
        console.error('[CREATE TEMPLATE ERROR]', error); // Log the full error on the server
        // Check for Mongoose validation error
        const errorMessage = error.name === 'ValidationError' ? Object.values(error.errors).map(e => e.message).join(', ') : error.message;
        
        res.status(400).json({ message: `فشل إنشاء القالب: ${errorMessage}`, error: error });
    }
};

// Update template
exports.updateTemplate = async (req, res) => {
    try {
        const template = await CompetitionTemplate.findByIdAndUpdate(
            req.params.id,
            req.body,
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
        const template = await CompetitionTemplate.findByIdAndUpdate(
            req.params.id,
            { is_archived: false },
            { new: true }
        );
        if (!template) {
            return res.status(404).json({ message: 'Template not found.' });
        }
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