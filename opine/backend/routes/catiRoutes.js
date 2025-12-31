const express = require('express');
const router = express.Router();
const {
  makeCall,
  receiveWebhook,
  getCalls,
  getCallById,
  getCallStats,
  checkCallStatus,
  getRecording
} = require('../controllers/catiController');
const { protect, authorize } = require('../middleware/auth');

// Middleware to capture raw body for webhook (before body parser)
const rawBodyMiddleware = (req, res, next) => {
  if (req.path === '/webhook' && req.method === 'POST') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
};

// Webhook endpoint (public, no authentication required)
// GET handler for testing/verification
router.get('/webhook', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook endpoint is active and ready to receive POST requests',
    endpoint: '/api/cati/webhook',
    method: 'POST',
    note: 'This endpoint accepts POST requests from DeepCall webhook service'
  });
});

// POST handler for actual webhook data
// According to DeepCall docs, webhook receives JSON directly
// But DeepCall may also send as form-encoded, so we handle both
router.post('/webhook', receiveWebhook);

// All other routes require authentication
router.use(protect);

// Make a call (company_admin only)
router.post('/make-call', authorize('company_admin'), makeCall);

// Get all calls (company_admin only)
router.get('/calls', authorize('company_admin'), getCalls);

// Get call statistics (company_admin only)
router.get('/stats', authorize('company_admin'), getCallStats);

// Get single call by ID (company_admin, quality_agent, or interviewer - with ownership check in controller)
router.get('/calls/:id', getCallById);

// Get recording (proxy with authentication) - company_admin, quality_agent, or interviewer (with ownership check)
router.get('/recording/:callId', getRecording);

// Manually check call status
router.post('/calls/:id/check-status', checkCallStatus);

module.exports = router;

