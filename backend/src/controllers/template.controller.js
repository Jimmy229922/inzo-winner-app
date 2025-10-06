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
        const templates = await CompetitionTemplate.find({ is_archived: false }).sort({ name: 1 });
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