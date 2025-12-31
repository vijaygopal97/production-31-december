const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const util = require('util');
const execPromise = util.promisify(exec);

// Configure multer for Excel file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/reports');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'excel-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow Excel files
  const allowedTypes = /xlsx|xls/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                   file.mimetype === 'application/vnd.ms-excel' ||
                   file.mimetype === 'application/octet-stream';
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 800 * 1024 * 1024 // 800MB limit for large Excel files
  },
  fileFilter: fileFilter
});

// Paths
const REPORT_UTILS_DIR = path.join(__dirname, '../utils/report-generation');
const TEMPLATE_PPT_PATH = path.join(REPORT_UTILS_DIR, 'template.pptx');
const TEMPLATE_EXCEL_PATH = path.join(REPORT_UTILS_DIR, 'template.xlsx');

// @desc    Upload Excel file and generate report
// @route   POST /api/reports/generate
// @access  Private (Company Admin only)
const generateReport = async (req, res) => {
  // Set timeout for this request to 2 hours for very large files
  req.setTimeout(7200000);
  res.setTimeout(7200000);
  
  try {
    const { referenceDate } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Excel file is required' 
      });
    }
    
    console.log(`📤 Received file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    const excelPath = req.file.path;
    const excelFileName = req.file.filename; // Store the filename for audit trail
    const outputDir = path.join(__dirname, '../../uploads/reports/output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `report_${timestamp}.pptx`);

    // Check if template PPT exists
    if (!fs.existsSync(TEMPLATE_PPT_PATH)) {
      return res.status(500).json({
        success: false,
        message: 'Template PPT file not found. Please ensure template.pptx is in the report-generation directory.'
      });
    }

    // Build Python command
    const pythonScript = path.join(REPORT_UTILS_DIR, 'generate_complete_report.py');
    let command = `python3 "${pythonScript}" "${excelPath}" --template "${TEMPLATE_PPT_PATH}" --output "${outputPath}"`;
    
    if (referenceDate) {
      command += ` --date "${referenceDate}"`;
    }

    console.log(`Executing: ${command}`);
    console.log(`⏱️  Starting report generation for file: ${req.file.originalname}`);

    // Execute Python script with increased buffer and timeout for very large files
    const startTime = Date.now();
    const { stdout, stderr } = await execPromise(command, {
      cwd: REPORT_UTILS_DIR,
      maxBuffer: 500 * 1024 * 1024, // 500MB buffer for very large file processing
      timeout: 7200000 // 2 hours timeout for very large files
    });
    
    const executionTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`✅ Report generation completed in ${executionTime} minutes`);

    if (stderr && !stderr.includes('Warning')) {
      console.error('Python script stderr:', stderr);
    }

    console.log('Python script stdout:', stdout);

    // Check if output file was created
    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({
        success: false,
        message: 'Report generation failed. Output file was not created.',
        error: stderr || 'Unknown error'
      });
    }

    // Upload report to S3 if configured
    const { uploadToS3, isS3Configured, generateReportKey, getSignedUrl } = require('../utils/cloudStorage');
    let reportUrl = `/api/reports/download/${path.basename(outputPath)}`;
    let reportKey = null;

    if (isS3Configured()) {
      try {
        // Generate S3 key for report
        const s3Key = generateReportKey('survey-reports', path.basename(outputPath));
        
        // Upload to S3
        const uploadResult = await uploadToS3(outputPath, s3Key, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          metadata: {
            reportType: 'survey-report',
            generatedAt: new Date().toISOString(),
            excelSource: excelFileName
          }
        });
        
        reportKey = uploadResult.key;
        
        // Generate signed URL for immediate download
        reportUrl = await getSignedUrl(reportKey, 3600); // 1 hour expiry
        
        console.log('✅ Report uploaded to S3:', reportKey);
        
        // Optionally delete local file after upload (or keep as backup)
        // fs.unlinkSync(outputPath);
      } catch (s3Error) {
        console.error('❌ S3 upload failed for report, using local storage:', s3Error.message);
        // Continue with local file path
      }
    }

    // Return success with file path
    res.json({
      success: true,
      message: 'Report generated successfully',
      filePath: reportUrl, // S3 signed URL or local path
      fileName: path.basename(outputPath),
      excelPath: excelFileName, // Return the uploaded Excel filename for audit trail
      s3Key: reportKey // Include S3 key if uploaded
    });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating report',
      error: error.message
    });
  }
};

// @desc    Generate calculation audit trail
// @route   POST /api/reports/audit
// @access  Private (Company Admin only)
const generateAuditTrail = async (req, res) => {
  try {
    const { excelPath, referenceDate } = req.body;
    
    if (!excelPath) {
      return res.status(400).json({
        success: false,
        message: 'Excel file path is required'
      });
    }

    // Validate that the file exists - check both uploads/reports and uploads/reports/output
    let fullExcelPath = path.join(__dirname, '../../uploads/reports', excelPath);
    if (!fs.existsSync(fullExcelPath)) {
      // Try in the output directory
      fullExcelPath = path.join(__dirname, '../../uploads/reports/output', excelPath);
      if (!fs.existsSync(fullExcelPath)) {
        // Try just the filename in uploads/reports
        const justFilename = path.basename(excelPath);
        fullExcelPath = path.join(__dirname, '../../uploads/reports', justFilename);
        if (!fs.existsSync(fullExcelPath)) {
          return res.status(404).json({
            success: false,
            message: 'Excel file not found'
          });
        }
      }
    }

    const outputDir = path.join(__dirname, '../../uploads/reports/output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `audit_trail_${timestamp}.txt`);

    // Build Python command
    const pythonScript = path.join(REPORT_UTILS_DIR, 'calculation_audit_trail.py');
    let command = `python3 "${pythonScript}" --excel "${fullExcelPath}" --output "${outputPath}"`;
    
    if (referenceDate) {
      command += ` --date "${referenceDate}"`;
    }

    console.log(`Executing: ${command}`);
    console.log(`⏱️  Starting audit trail generation for file: ${excelPath}`);

    // Execute Python script with increased buffer and timeout for very large files
    const startTime = Date.now();
    const { stdout, stderr } = await execPromise(command, {
      cwd: REPORT_UTILS_DIR,
      maxBuffer: 500 * 1024 * 1024, // 500MB buffer for very large file processing
      timeout: 7200000 // 2 hours timeout for very large files
    });
    
    const executionTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`✅ Audit trail generation completed in ${executionTime} minutes`);

    if (stderr && !stderr.includes('Warning')) {
      console.error('Python script stderr:', stderr);
    }

    console.log('Python script stdout:', stdout);

    // Check if output file was created
    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({
        success: false,
        message: 'Audit trail generation failed. Output file was not created.',
        error: stderr || 'Unknown error'
      });
    }

    // Upload audit trail to S3 if configured
    const { uploadToS3: uploadAuditToS3, isS3Configured: isS3ConfiguredAudit, generateReportKey: generateAuditKey, getSignedUrl: getAuditSignedUrl } = require('../utils/cloudStorage');
    let auditUrl = `/api/reports/download/${path.basename(outputPath)}`;
    let auditKey = null;

    if (isS3ConfiguredAudit()) {
      try {
        const s3Key = generateAuditKey('audit-trails', path.basename(outputPath));
        const uploadResult = await uploadAuditToS3(outputPath, s3Key, {
          contentType: 'text/plain',
          metadata: {
            reportType: 'audit-trail',
            generatedAt: new Date().toISOString()
          }
        });
        auditKey = uploadResult.key;
        auditUrl = await getAuditSignedUrl(auditKey, 3600);
        console.log('✅ Audit trail uploaded to S3:', auditKey);
      } catch (s3Error) {
        console.error('❌ S3 upload failed for audit trail:', s3Error.message);
      }
    }

    // Return success with file path
    res.json({
      success: true,
      message: 'Audit trail generated successfully',
      filePath: auditUrl,
      fileName: path.basename(outputPath),
      s3Key: auditKey
    });

  } catch (error) {
    console.error('Error generating audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating audit trail',
      error: error.message
    });
  }
};

// @desc    Download generated report or audit trail
// @route   GET /api/reports/download/:filename
// @access  Private (Company Admin only)
const downloadReport = async (req, res) => {
  try {
    const { filename } = req.params;
    const { s3Key } = req.query; // Optional S3 key parameter
    
    // If S3 key is provided, generate signed URL and redirect
    if (s3Key) {
      const { getSignedUrl, isS3Configured } = require('../utils/cloudStorage');
      if (isS3Configured()) {
        try {
          const signedUrl = await getSignedUrl(s3Key, 3600);
          return res.redirect(signedUrl);
        } catch (error) {
          console.error('Error generating S3 signed URL:', error);
          return res.status(500).json({
            success: false,
            message: 'Error generating download URL',
            error: error.message
          });
        }
      }
    }

    // Fallback to local file
    const filePath = path.join(__dirname, '../../uploads/reports/output', filename);

    // Security check: prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, '../../uploads/reports/output'))) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Determine content type
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.pptx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (filename.endsWith('.txt')) {
      contentType = 'text/plain';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file',
      error: error.message
    });
  }
};

// @desc    Download Excel template
// @route   GET /api/reports/template
// @access  Private (Company Admin only)
const downloadTemplate = async (req, res) => {
  try {
    // Check if template exists, if not create it from sample file
    let templatePath = TEMPLATE_EXCEL_PATH;
    
    // If template doesn't exist, create it from sample file
    if (!fs.existsSync(templatePath)) {
      const sampleExcelPath = '/var/www/West_Bengal_31st_Oct_2025_With_Weights.xlsx';
      
      if (!fs.existsSync(sampleExcelPath)) {
        return res.status(404).json({
          success: false,
          message: 'Source Excel file not found. Please ensure a sample Excel file exists.'
        });
      }

      // Create template directory if it doesn't exist
      const templateDir = path.dirname(templatePath);
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }

      // Use Python script to create template with only first 3 rows
      const createTemplateScript = path.join(REPORT_UTILS_DIR, 'create_template.py');
      const command = `python3 "${createTemplateScript}" "${sampleExcelPath}" "${templatePath}"`;

      console.log(`Creating template: ${command}`);

      try {
        const { stdout, stderr } = await execPromise(command, {
          cwd: REPORT_UTILS_DIR,
          maxBuffer: 100 * 1024 * 1024, // 100MB buffer for template creation
          timeout: 300000 // 5 minutes timeout for template creation
        });

        if (stderr && !stderr.includes('Warning')) {
          console.error('Python script stderr:', stderr);
        }

        console.log('Template creation stdout:', stdout);

        // Check if template was created
        if (!fs.existsSync(templatePath)) {
          return res.status(500).json({
            success: false,
            message: 'Template creation failed. Output file was not created.',
            error: stderr || 'Unknown error'
          });
        }
      } catch (error) {
        console.error('Error creating template:', error);
        return res.status(500).json({
          success: false,
          message: 'Error creating template',
          error: error.message
        });
      }
    }

    // Check if template exists now
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        success: false,
        message: 'Template Excel file not found.'
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="report_template.xlsx"');
    
    const fileStream = fs.createReadStream(templatePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading template:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading template',
      error: error.message
    });
  }
};

module.exports = {
  generateReport,
  generateAuditTrail,
  downloadReport,
  downloadTemplate,
  upload
};


