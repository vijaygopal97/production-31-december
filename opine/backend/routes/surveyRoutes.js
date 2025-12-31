const express = require('express');
const router = express.Router();
const {
  createSurvey,
  getSurveys,
  getSurvey,
  getSurveyFull,
  updateSurvey,
  deleteSurvey,
  publishSurvey,
  assignInterviewers,
  assignQualityAgents,
  getSurveyStats,
  getOverallStats,
  getCatiStats,
  getSurveyAnalytics,
  getSurveyAnalyticsV2,
  getACWiseStatsV2,
  getInterviewerWiseStatsV2,
  getChartDataV2,
  getAvailableSurveys,
  rejectInterview,
  debugSurveyResponses,
  downloadRespondentTemplate,
  uploadRespondentContacts,
  uploadRespondentContactsMiddleware,
  getRespondentContacts,
  saveRespondentContacts
} = require('../controllers/surveyController');
const { protect, authorize } = require('../middleware/auth');

// Survey routes
router.route('/')
  .post(protect, authorize('company_admin', 'project_manager'), createSurvey)
  .get(protect, authorize('company_admin', 'project_manager', 'interviewer'), getSurveys);

router.route('/stats')
  .get(protect, authorize('company_admin', 'project_manager'), getSurveyStats);

// Overall stats route (must be before /:id route to avoid route conflict)
router.route('/overall-stats')
  .get(protect, authorize('company_admin', 'project_manager'), getOverallStats);

// Respondent contacts routes
router.route('/respondent-contacts/template')
  .get(protect, authorize('company_admin', 'project_manager'), downloadRespondentTemplate);

router.route('/respondent-contacts/upload')
  .post(protect, authorize('company_admin', 'project_manager'), uploadRespondentContactsMiddleware, uploadRespondentContacts);

// Interviewer and Quality Agent routes (must come before /:id routes)
router.route('/available')
  .get(protect, authorize('interviewer', 'quality_agent'), getAvailableSurveys);

// Specific routes must come before /:id routes
router.route('/:id/assign-interviewers')
  .post(protect, authorize('company_admin', 'project_manager'), assignInterviewers);

router.route('/:id/assign-quality-agents')
  .post(protect, authorize('company_admin', 'project_manager'), assignQualityAgents);

router.route('/:id/publish')
  .post(protect, authorize('company_admin', 'project_manager'), publishSurvey);

// Specific routes must come before /:id routes
router.route('/:id/reject-interview')
  .post(protect, authorize('interviewer'), rejectInterview);

// Debug route
router.route('/:surveyId/debug-responses')
  .get(protect, authorize('company_admin', 'project_manager'), debugSurveyResponses);

// Analytics route (must come before /:id route)
router.route('/:id/analytics')
  .get(protect, authorize('company_admin', 'project_manager'), getSurveyAnalytics);

// Analytics V2 route (optimized for big data)
router.route('/:id/analytics-v2')
  .get(protect, authorize('company_admin', 'project_manager'), getSurveyAnalyticsV2);

// AC-wise stats V2 route (optimized for big data)
router.route('/:id/ac-wise-stats-v2')
  .get(protect, authorize('company_admin', 'project_manager'), getACWiseStatsV2);

// Interviewer-wise stats V2 route (optimized for big data)
router.route('/:id/interviewer-wise-stats-v2')
  .get(protect, authorize('company_admin', 'project_manager'), getInterviewerWiseStatsV2);

// Chart data V2 route (optimized for big data)
router.route('/:id/chart-data-v2')
  .get(protect, authorize('company_admin', 'project_manager'), getChartDataV2);

// CATI stats route (must come before /:id route)
router.route('/:id/cati-stats')
  .get(protect, authorize('company_admin', 'project_manager'), getCatiStats);

// Respondent contacts route (must come before /:id route)
router.route('/:id/respondent-contacts')
  .get(protect, authorize('company_admin', 'project_manager'), getRespondentContacts)
  .put(protect, authorize('company_admin', 'project_manager'), saveRespondentContacts);

// Full survey data endpoint (with sections and questions) - must come before /:id route
router.route('/:id/full')
  .get(protect, authorize('company_admin', 'project_manager', 'interviewer'), getSurveyFull);

// Generic /:id route must be LAST to avoid matching specific routes like /overall-stats
router.route('/:id')
  .get(protect, authorize('company_admin', 'project_manager', 'interviewer'), getSurvey)
  .put(protect, authorize('company_admin', 'project_manager'), updateSurvey)
  .delete(protect, authorize('company_admin', 'project_manager'), deleteSurvey);

module.exports = router;









