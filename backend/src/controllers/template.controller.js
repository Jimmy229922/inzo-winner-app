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
        const template = new CompetitionTemplate(req.body);
        await template.save();
        await logActivity(req.user._id, null, 'TEMPLATE_CREATED', `تم إنشاء قالب جديد: ${template.name}`);
        res.status(201).json({ data: template });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create template.', error: error.message });
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
        await logActivity(req.user._id, null, 'TEMPLATE_UPDATED', `تم تحديث القالب: ${template.name}`);
        res.json({ data: template });
    } catch (error) {
        res.status(400).json({ message: 'Failed to update template.', error: error.message });
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
        await logActivity(req.user._id, null, 'TEMPLATE_DELETED', `تم حذف القالب: ${template.name}`);
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
        await logActivity(req.user._id, null, 'TEMPLATE_REACTIVATED', `تمت إعادة تفعيل القالب: ${template.name}`);
        res.json({ data: template });
    } catch (error) {
        res.status(500).json({ message: 'Failed to reactivate template.', error: error.message });
    }
};