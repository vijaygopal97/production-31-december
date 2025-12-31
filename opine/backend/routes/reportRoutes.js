const express = require('express');
const router = express.Router();
const {
  generateReport,
  generateAuditTrail,
  downloadReport,
  downloadTemplate,
  upload
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and company_admin role
router.use(protect);
router.use(authorize('company_admin'));

// Upload Excel and generate report
router.post('/generate', upload.single('excelFile'), generateReport);

// Generate audit trail
router.post('/audit', generateAuditTrail);

// Download generated files
router.get('/download/:filename', downloadReport);

// Download Excel template
router.get('/template', downloadTemplate);

module.exports = router;


