const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getConfigBySurvey,
  createOrUpdateConfig,
  getConfigsByCompany
} = require('../controllers/qcBatchConfigController');

// All routes require authentication
router.use(protect);

// Get active config for a survey
router.get('/survey/:surveyId', getConfigBySurvey);

// Get all configs for company
router.get('/company', getConfigsByCompany);

// Create or update config
router.post('/', createOrUpdateConfig);

module.exports = router;

