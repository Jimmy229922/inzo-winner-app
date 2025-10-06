const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');

// Note: The main authentication middleware is already applied in app.js

router.get('/', templateController.getAllTemplates);
router.get('/available', templateController.getAvailableTemplates);
router.post('/', templateController.createTemplate);
router.get('/:id', templateController.getTemplateById);
router.put('/:id', templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate); // This archives the template
router.put('/:id/reactivate', templateController.reactivateTemplate);

module.exports = router;