const express = require('express');
const router = express.Router();
const {
  startCatiInterview,
  makeCallToRespondent,
  abandonInterview,
  completeCatiInterview
} = require('../controllers/catiInterviewController');
const { protect, authorize } = require('../middleware/auth');

// Debug middleware
router.use((req, res, next) => {
  console.log('🔍 CATI Interview Routes - Request:', req.method, req.path, req.params);
  next();
});

// All routes require authentication and interviewer role
router.use(protect);
router.use(authorize('interviewer'));

// Start CATI interview
router.post('/start/:surveyId', (req, res, next) => {
  console.log('🔍 startCatiInterview route handler called');
  next();
}, startCatiInterview);

// Make call to respondent
router.post('/make-call/:queueId', makeCallToRespondent);

// Abandon interview
router.post('/abandon/:queueId', abandonInterview);

// Complete interview
router.post('/complete/:queueId', completeCatiInterview);

module.exports = router;


