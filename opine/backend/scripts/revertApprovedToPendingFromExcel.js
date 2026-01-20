/**
 * Revert Approved Responses to Pending_Approval from Excel File
 * 
 * This script:
 * 1. Reads response IDs from Excel file (first tab)
 * 2. Finds all Approved responses matching those IDs
 * 3. Tracks which ones had reviewers (and who reviewed them)
 * 4. Changes status from Approved to Pending_Approval
 * 5. Adds them to AvailableAssignment materialized view for QC
 * 6. Generates a detailed report
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
const EXCEL_FILE_PATH = '/var/www/Report-Generation/Server IDs_ To Accept and Reject_Till 17th Jan.xlsx';

async function revertApprovedToPending() {
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

    // Step 2: Find all Approved responses matching these IDs
    console.log('📊 Step 2: Finding Approved responses in database...');
    const approvedResponses = await SurveyResponse.find({
      responseId: { $in: responseIds },
      status: 'Approved'
    })
    .populate('verificationData.reviewer', 'firstName lastName email memberId')
    .select('responseId status verificationData survey interviewer interviewMode selectedAC createdAt lastSkippedAt')
    .lean();

    console.log(`   Found ${approvedResponses.length} Approved responses matching Excel IDs\n`);

    // Step 3: Process each response
    console.log('🔄 Step 3: Processing responses...');
    const results = {
      total: approvedResponses.length,
      updated: 0,
      failed: 0,
      skipped: 0,
      withReviewer: 0,
      withoutReviewer: 0,
      errors: [],
      responses: []
    };

    const now = new Date();
    const BATCH_SIZE = 100;
    const bulkOps = [];

    for (let i = 0; i < approvedResponses.length; i++) {
      const response = approvedResponses[i];
      
      try {
        // Check if response had a reviewer
        const hadReviewer = response.verificationData?.reviewer !== null && 
                           response.verificationData?.reviewer !== undefined;
        const reviewer = hadReviewer ? response.verificationData.reviewer : null;
        
        if (hadReviewer) {
          results.withReviewer++;
        } else {
          results.withoutReviewer++;
        }

        // Update response status to Pending_Approval
        // Clear reviewAssignment if exists (so it can be reassigned)
        await SurveyResponse.updateOne(
          { _id: response._id },
          {
            $set: {
              status: 'Pending_Approval',
              updatedAt: now
            },
            $unset: {
              reviewAssignment: 1
            }
          }
        );

        // Prepare data for AvailableAssignment
        const surveyId = response.survey?.toString() || response.survey;
        const interviewerId = response.interviewer?.toString() || response.interviewer;
        const selectedAC = response.selectedAC || null;
        const interviewMode = response.interviewMode || 'capi';
        
        // Priority: lower number = higher priority
        // Never skipped = priority 1, recently skipped = priority 2
        const priority = response.lastSkippedAt ? 2 : 1;

        bulkOps.push({
          updateOne: {
            filter: { responseId: response._id },
            update: {
              $set: {
                responseId: response._id,
                surveyId: new mongoose.Types.ObjectId(surveyId),
                interviewerId: interviewerId ? new mongoose.Types.ObjectId(interviewerId) : null,
                status: 'available',
                interviewMode: interviewMode,
                selectedAC: selectedAC,
                priority: priority,
                lastSkippedAt: response.lastSkippedAt || null,
                createdAt: response.createdAt || new Date(),
                updatedAt: now
              }
            },
            upsert: true
          }
        });

        // Execute batch to prevent memory buildup
        if (bulkOps.length >= BATCH_SIZE) {
          await AvailableAssignment.bulkWrite(bulkOps, { ordered: false });
          bulkOps.length = 0;
        }

        // Store response details for report
        results.responses.push({
          responseId: response.responseId,
          status: 'Updated',
          hadReviewer: hadReviewer,
          reviewer: reviewer ? {
            _id: reviewer._id?.toString() || reviewer.toString(),
            name: reviewer.firstName && reviewer.lastName 
              ? `${reviewer.firstName} ${reviewer.lastName}`.trim()
              : reviewer.memberId || 'Unknown',
            memberId: reviewer.memberId || null,
            email: reviewer.email || null
          } : null,
          reviewedAt: response.verificationData?.reviewedAt || null,
          previousStatus: 'Approved',
          newStatus: 'Pending_Approval',
          interviewMode: interviewMode,
          selectedAC: selectedAC,
          createdAt: response.createdAt
        });

        results.updated++;

        if ((i + 1) % 100 === 0) {
          console.log(`   Processed ${i + 1}/${approvedResponses.length} responses...`);
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

    // Execute remaining bulk operations
    if (bulkOps.length > 0) {
      await AvailableAssignment.bulkWrite(bulkOps, { ordered: false });
    }

    console.log(`\n✅ Processing completed!\n`);

    // Step 4: Generate report
    console.log('📄 Step 4: Generating report...');
    const report = {
      generatedAt: new Date().toISOString(),
      sourceFile: EXCEL_FILE_PATH,
      summary: {
        totalInExcel: responseIds.length,
        totalApprovedFound: approvedResponses.length,
        totalUpdated: results.updated,
        totalFailed: results.failed,
        totalSkipped: results.skipped,
        withReviewer: results.withReviewer,
        withoutReviewer: results.withoutReviewer
      },
      responses: results.responses,
      errors: results.errors
    };

    // Save JSON report
    const reportDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, `revert-approved-to-pending-report-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`   ✅ JSON report saved: ${reportPath}`);

    // Generate CSV report
    const csvPath = path.join(reportDir, `revert-approved-to-pending-report-${new Date().toISOString().split('T')[0]}.csv`);
    const csvHeaders = [
      'Response ID',
      'Status',
      'Had Reviewer',
      'Reviewer Name',
      'Reviewer Member ID',
      'Reviewer Email',
      'Reviewed At',
      'Previous Status',
      'New Status',
      'Interview Mode',
      'Selected AC',
      'Created At'
    ];

    let csvContent = csvHeaders.join(',') + '\n';
    for (const resp of results.responses) {
      const row = [
        resp.responseId,
        resp.status,
        resp.hadReviewer ? 'Yes' : 'No',
        resp.reviewer ? `"${resp.reviewer.name.replace(/"/g, '""')}"` : '',
        resp.reviewer?.memberId || '',
        resp.reviewer?.email || '',
        resp.reviewedAt || '',
        resp.previousStatus,
        resp.newStatus,
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
    console.log(`Total Approved Responses Found: ${approvedResponses.length}`);
    console.log(`✅ Successfully Updated: ${results.updated}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`👤 Responses with Reviewer: ${results.withReviewer}`);
    console.log(`👤 Responses without Reviewer: ${results.withoutReviewer}`);
    console.log('='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
revertApprovedToPending();

