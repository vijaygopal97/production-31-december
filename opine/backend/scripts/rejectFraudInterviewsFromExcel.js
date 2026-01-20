/**
 * Reject Fraud Interviews from Excel File
 * 
 * This script:
 * 1. Reads response IDs from Excel file (Sheet1)
 * 2. Finds all responses matching those IDs
 * 3. Rejects them with reason "Fraud Interview"
 * 4. Sets verificationData.feedback = "Fraud Interview"
 * 5. Sets verificationData.reviewedAt
 * 6. Removes from AvailableAssignment if present
 * 7. Generates a detailed report
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config(); // Also try default location
const mongoose = require('mongoose');
const fs = require('fs');
const XLSX = require('xlsx');

// Load models
const SurveyResponse = require('../models/SurveyResponse');
const AvailableAssignment = require('../models/AvailableAssignment');
const User = require('../models/User');

// Excel file path
const EXCEL_FILE_PATH = '/var/www/Report-Generation/Vijay to Reject cases_Fraud Interviews_20th Ints.xlsx';
const REJECTION_REASON = 'Fraud Interview';

async function rejectFraudInterviews() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Read Excel file
    console.log('📋 Step 1: Reading Excel file...');
    console.log(`   File: ${EXCEL_FILE_PATH}`);
    
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      throw new Error(`Excel file not found: ${EXCEL_FILE_PATH}`);
    }

    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    console.log(`   Sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Extract response IDs (skip header row)
    const responseIds = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[0] && typeof row[0] === 'string' && row[0].trim()) {
        responseIds.push(row[0].trim());
      }
    }

    console.log(`   Found ${responseIds.length} response IDs in Excel\n`);

    // Step 2: Find all responses matching these IDs
    console.log('📊 Step 2: Finding responses in database...');
    const responses = await SurveyResponse.find({
      responseId: { $in: responseIds }
    })
    .populate('verificationData.reviewer', 'firstName lastName email memberId')
    .select('responseId status verificationData survey interviewer interviewMode selectedAC createdAt')
    .lean();

    console.log(`   Found ${responses.length} responses matching Excel IDs\n`);

    // Step 3: Process each response
    console.log('🔄 Step 3: Rejecting responses...');
    const results = {
      total: responses.length,
      rejected: 0,
      alreadyRejected: 0,
      failed: 0,
      notFound: responseIds.length - responses.length,
      errors: [],
      responses: []
    };

    const updateTimestamp = new Date();
    const BATCH_SIZE = 100;
    const availableAssignmentIds = [];

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      
      try {
        // Check if already rejected
        if (response.status === 'Rejected') {
          results.alreadyRejected++;
          results.responses.push({
            responseId: response.responseId,
            status: 'Already Rejected',
            previousStatus: 'Rejected',
            newStatus: 'Rejected',
            rejectionReason: response.verificationData?.feedback || null,
            interviewMode: response.interviewMode,
            selectedAC: response.selectedAC,
            createdAt: response.createdAt
          });
          continue;
        }

        // Prepare update document
        const updateDoc = {
          $set: {
            status: 'Rejected',
            'verificationData.feedback': REJECTION_REASON,
            'verificationData.reviewedAt': updateTimestamp,
            updatedAt: updateTimestamp
          },
          $unset: {
            reviewAssignment: 1 // Clear any active review assignment
          }
        };

        // Update response
        const updateResult = await SurveyResponse.collection.updateOne(
          { _id: response._id },
          updateDoc,
          { bypassDocumentValidation: true }
        );

        if (updateResult.modifiedCount === 1) {
          // Track for AvailableAssignment removal
          availableAssignmentIds.push(response._id);

          // Store response details for report
          results.responses.push({
            responseId: response.responseId,
            status: 'Rejected',
            previousStatus: response.status,
            newStatus: 'Rejected',
            rejectionReason: REJECTION_REASON,
            reviewedAt: updateTimestamp.toISOString(),
            hadReviewer: response.verificationData?.reviewer !== null && 
                        response.verificationData?.reviewer !== undefined,
            previousReviewer: response.verificationData?.reviewer ? {
              _id: response.verificationData.reviewer._id?.toString() || response.verificationData.reviewer.toString(),
              name: response.verificationData.reviewer.firstName && response.verificationData.reviewer.lastName 
                ? `${response.verificationData.reviewer.firstName} ${response.verificationData.reviewer.lastName}`.trim()
                : response.verificationData.reviewer.memberId || 'Unknown',
              memberId: response.verificationData.reviewer.memberId || null,
              email: response.verificationData.reviewer.email || null
            } : null,
            interviewMode: response.interviewMode,
            selectedAC: response.selectedAC,
            createdAt: response.createdAt
          });

          results.rejected++;

          if ((i + 1) % 100 === 0) {
            console.log(`   Processed ${i + 1}/${responses.length} responses...`);
          }
        } else {
          results.failed++;
          results.errors.push({
            responseId: response.responseId,
            error: 'Update did not modify document'
          });
        }
      } catch (error) {
        console.error(`   ❌ Error processing response ${response.responseId}:`, error.message);
        results.failed++;
        results.errors.push({
          responseId: response.responseId,
          error: error.message
        });
      }
    }

    // Step 4: Remove from AvailableAssignment
    console.log(`\n🗑️  Step 4: Removing ${availableAssignmentIds.length} responses from AvailableAssignment...`);
    if (availableAssignmentIds.length > 0) {
      const deleteResult = await AvailableAssignment.deleteMany({
        responseId: { $in: availableAssignmentIds }
      });
      console.log(`   ✅ Removed ${deleteResult.deletedCount} entries from AvailableAssignment\n`);
    }

    console.log(`✅ Processing completed!\n`);

    // Step 5: Generate report
    console.log('📄 Step 5: Generating report...');
    const report = {
      generatedAt: new Date().toISOString(),
      sourceFile: EXCEL_FILE_PATH,
      rejectionReason: REJECTION_REASON,
      summary: {
        totalInExcel: responseIds.length,
        totalFound: responses.length,
        totalRejected: results.rejected,
        alreadyRejected: results.alreadyRejected,
        totalFailed: results.failed,
        notFound: results.notFound
      },
      responses: results.responses,
      errors: results.errors
    };

    // Save JSON report
    const reportDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, `reject-fraud-interviews-report-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`   ✅ JSON report saved: ${reportPath}`);

    // Generate CSV report
    const csvPath = path.join(reportDir, `reject-fraud-interviews-report-${new Date().toISOString().split('T')[0]}.csv`);
    const csvHeaders = [
      'Response ID',
      'Status',
      'Previous Status',
      'New Status',
      'Rejection Reason',
      'Reviewed At',
      'Had Previous Reviewer',
      'Previous Reviewer Name',
      'Previous Reviewer Member ID',
      'Previous Reviewer Email',
      'Interview Mode',
      'Selected AC',
      'Created At'
    ];

    let csvContent = csvHeaders.join(',') + '\n';
    for (const resp of results.responses) {
      const row = [
        resp.responseId,
        resp.status,
        resp.previousStatus,
        resp.newStatus,
        resp.rejectionReason || '',
        resp.reviewedAt || '',
        resp.hadReviewer ? 'Yes' : 'No',
        resp.previousReviewer ? `"${resp.previousReviewer.name.replace(/"/g, '""')}"` : '',
        resp.previousReviewer?.memberId || '',
        resp.previousReviewer?.email || '',
        resp.interviewMode || '',
        resp.selectedAC || '',
        resp.createdAt || ''
      ];
      csvContent += row.join(',') + '\n';
    }

    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`   ✅ CSV report saved: ${csvPath}\n`);

    // Print summary
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Response IDs in Excel: ${responseIds.length}`);
    console.log(`Total Responses Found in Database: ${responses.length}`);
    console.log(`✅ Successfully Rejected: ${results.rejected}`);
    console.log(`⏭️  Already Rejected: ${results.alreadyRejected}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⚠️  Not Found: ${results.notFound}`);
    console.log(`🗑️  Removed from AvailableAssignment: ${availableAssignmentIds.length}`);
    console.log('='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
rejectFraudInterviews();

