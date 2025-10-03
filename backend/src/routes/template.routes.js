const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');

router.get('/', templateController.getAllTemplates);
router.get('/available', templateController.getAvailableTemplates);
router.post('/', templateController.createTemplate);

router.get('/:id', templateController.getTemplateById);
router.put('/:id', templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);
router.put('/:id/reactivate', templateController.reactivateTemplate);

module.exports = router;