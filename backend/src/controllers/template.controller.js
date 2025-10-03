const Template = require('../models/Template');

exports.getAllTemplates = async (req, res) => {
    try {
        const { archived } = req.query;
        const isArchived = archived === 'true';
        const templates = await Template.find({ is_archived: isArchived }).lean();
        const formattedTemplates = templates.map(t => ({ ...t, id: t._id }));
        res.json({ data: formattedTemplates });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching templates.', error: error.message });
    }
};

exports.getAvailableTemplates = async (req, res) => {
    try {
        const { classification } = req.query;
        const templates = await Template.find({
            is_archived: false,
            classification: { $in: [classification, 'All'] },
            $or: [
                { usage_limit: null },
                { $expr: { $lt: ["$usage_count", "$usage_limit"] } }
            ]
        }).lean();
        const formattedTemplates = templates.map(t => ({ ...t, id: t._id }));
        res.json({ data: formattedTemplates });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching available templates.', error: error.message });
    }
};

exports.getTemplateById = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id).lean();
        if (!template) return res.status(404).json({ message: 'Template not found.' });
        res.json({ data: { ...template, id: template._id } });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching template.', error: error.message });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const newTemplate = new Template(req.body);
        await newTemplate.save();
        res.status(201).json({ data: newTemplate });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create template.', error: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const updatedTemplate = await Template.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedTemplate) return res.status(404).json({ message: 'Template not found.' });
        res.json({ data: updatedTemplate });
    } catch (error) {
        res.status(400).json({ message: 'Failed to update template.', error: error.message });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const template = await Template.findByIdAndDelete(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template not found.' });
        res.json({ message: 'Template deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete template.', error: error.message });
    }
};

exports.reactivateTemplate = async (req, res) => {
    try {
        const updatedTemplate = await Template.findByIdAndUpdate(req.params.id, { is_archived: false, usage_count: 0 }, { new: true });
        if (!updatedTemplate) return res.status(404).json({ message: 'Template not found.' });
        res.json({ message: 'Template reactivated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to reactivate template.', error: error.message });
    }
};