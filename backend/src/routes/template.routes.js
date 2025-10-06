const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');
const { authenticate } = require('../api/middleware/auth.middleware');

router.get('/', authenticate, templateController.getAllTemplates);
router.get('/available', authenticate, templateController.getAvailableTemplates);
router.post('/', authenticate, templateController.createTemplate);

router.get('/:id', authenticate, templateController.getTemplateById);
router.put('/:id', authenticate, templateController.updateTemplate);
router.delete('/:id', authenticate, templateController.deleteTemplate);
router.put('/:id/reactivate', authenticate, templateController.reactivateTemplate);

module.exports = router;