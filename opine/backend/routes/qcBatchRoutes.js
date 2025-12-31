const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getBatchesBySurvey,
  getBatchById,
  triggerBatchProcessing,
  sendBatchToQC
} = require('../controllers/qcBatchController');

// All routes require authentication
router.use(protect);

// Get batches for a survey
router.get('/survey/:surveyId', getBatchesBySurvey);

// Get a single batch
router.get('/:batchId', getBatchById);

// Manually send a batch to QC (premature completion)
router.post('/:batchId/send-to-qc', sendBatchToQC);

// Manually trigger batch processing
router.post('/process', triggerBatchProcessing);

module.exports = router;

