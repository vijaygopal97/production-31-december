const express = require('express');
const router = express.Router();
const {
  receiveAppLogs,
  getAppLogs
} = require('../controllers/appLogController');
const { protect, authorize } = require('../middleware/auth');

// Receive logs from mobile app (authenticated users)
router.post('/', protect, receiveAppLogs);

// Get logs (admin only)
router.get('/', protect, authorize('company_admin', 'super_admin'), getAppLogs);

module.exports = router;





