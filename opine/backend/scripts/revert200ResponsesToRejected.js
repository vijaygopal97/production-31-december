/**
 * Revert 200 Responses Back to Rejected Status
 * 
 * This script:
 * 1. Reads response IDs from the two status change reports (100 from each)
 * 2. Changes their status back to "Rejected" (regardless of current status)
 * 3. Creates a report of the changes made
 * 
 * Source Reports:
 * - Status_Change_Report_2026-01-09_1767988107042.json (100 responses)
 * - Status_Change_VERIFICATION_Report_2026-01-09.json (100 responses)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Load models
const SurveyResponse = require('../models/SurveyResponse');

async function revertResponsesToRejected() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Read the two status change reports
    console.log('📋 Step 1: Reading status change reports...');
    const reportsDir = path.join(__dirname, '../../reports');
    
    const report1Path = path.join(reportsDir, 'Status_Change_Report_2026-01-09_1767988107042.json');
    const report2Path = path.join(reportsDir, 'Status_Change_VERIFICATION_Report_2026-01-09.json');
    
    if (!fs.existsSync(report1Path)) {
      console.error(`❌ Report file not found: ${report1Path}`);
      process.exit(1);
    }
    
    if (!fs.existsSync(report2Path)) {
      console.error(`❌ Report file not found: ${report2Path}`);
      process.exit(1);
    }

    const report1Data = JSON.parse(fs.readFileSync(report1Path, 'utf8'));
    const report2Data = JSON.parse(fs.readFileSync(report2Path, 'utf8'));
    
    // Extract response IDs from both reports
    const responseIds1 = (report1Data.changes || []).map(r => r.responseId);
    const responseIds2 = (report2Data.changedResponseIds || []).map(r => r.responseId);
    
    // Combine and deduplicate
    const allResponseIds = [...new Set([...responseIds1, ...responseIds2])];
    
    console.log(`✅ Found ${responseIds1.length} response IDs from first report`);
    console.log(`✅ Found ${responseIds2.length} response IDs from second report`);
    console.log(`✅ Total unique response IDs: ${allResponseIds.length}\n`);

    if (allResponseIds.length === 0) {
      console.log('⚠️  No response IDs found in reports. Nothing to change.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Step 2: Change status back to Rejected
    console.log('📋 Step 2: Changing status back to Rejected...');
    
    const changeReport = {
      metadata: {
        operation: 'Revert 200 Responses Back to Rejected Status',
        criteria: {
          sourceReports: [
            'Status_Change_Report_2026-01-09_1767988107042.json',
            'Status_Change_VERIFICATION_Report_2026-01-09.json'
          ],
          originalOperation: 'Change Auto-Rejected to Pending_Approval',
          originalChangeDate: '2026-01-09'
        },
        executedAt: new Date().toISOString(),
        executedBy: 'Script: revert200ResponsesToRejected.js'
      },
      summary: {
        totalResponseIds: allResponseIds.length,
        successfullyChanged: 0,
        failed: 0,
        notFound: 0,
        skipped: 0
      },
      changes: [],
      errors: []
    };

    let successCount = 0;
    let failCount = 0;
    let notFoundCount = 0;
    let skipCount = 0;

    for (const responseId of allResponseIds) {
      try {
        // Find the response by responseId (regardless of current status)
        const response = await SurveyResponse.findOne({
          responseId: responseId
        });

        if (!response) {
          console.log(`⚠️  Response not found: ${responseId}`);
          changeReport.errors.push({
            responseId: responseId,
            error: 'Response not found in database',
            timestamp: new Date().toISOString()
          });
          notFoundCount++;
          continue;
        }

        const previousStatus = response.status;
        
        // Skip if already Rejected
        if (previousStatus === 'Rejected') {
          console.log(`⚠️  Response ${responseId} is already Rejected - skipping`);
          changeReport.errors.push({
            responseId: responseId,
            previousStatus: previousStatus,
            error: 'Already in Rejected status',
            timestamp: new Date().toISOString()
          });
          skipCount++;
          continue;
        }

        // Use direct MongoDB update to bypass pre-save hooks
        const db = mongoose.connection.db;
        const collection = db.collection('surveyresponses');
        
        const updateResult = await collection.updateOne(
          { _id: response._id },
          {
            $set: {
              status: 'Rejected',
              'metadata.revertedFromStatus': previousStatus,
              'metadata.revertedToRejectedAt': new Date(),
              'metadata.revertedBy': 'Script: revert200ResponsesToRejected.js',
              updatedAt: new Date()
            }
          }
        );

        if (updateResult.modifiedCount === 0) {
          throw new Error('Update did not modify any documents');
        }

        console.log(`✅ Changed: ${responseId} (${previousStatus} → Rejected)`);

        changeReport.changes.push({
          responseId: responseId,
          previousStatus: previousStatus,
          newStatus: 'Rejected',
          questionsAnswered: response.responses ? response.responses.length : 0,
          changedAt: new Date().toISOString()
        });

        successCount++;

      } catch (error) {
        console.error(`❌ Error changing response ${responseId}:`, error.message);
        changeReport.errors.push({
          responseId: responseId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        failCount++;
      }
    }

    // Update summary
    changeReport.summary.successfullyChanged = successCount;
    changeReport.summary.failed = failCount;
    changeReport.summary.notFound = notFoundCount;
    changeReport.summary.skipped = skipCount;

    // Step 3: Save change report
    console.log('\n📋 Step 3: Saving change report...');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFilename = `Revert_200_Responses_To_Rejected_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    const reportFilepath = path.join(reportsDir, reportFilename);
    
    fs.writeFileSync(reportFilepath, JSON.stringify(changeReport, null, 2), 'utf8');
    
    console.log(`✅ Change report saved: ${reportFilepath}\n`);

    // Print summary
    console.log('📊 Revert Summary:');
    console.log('='.repeat(60));
    console.log(`Total Response IDs: ${changeReport.summary.totalResponseIds}`);
    console.log(`✅ Successfully Changed: ${changeReport.summary.successfullyChanged}`);
    console.log(`❌ Failed: ${changeReport.summary.failed}`);
    console.log(`⚠️  Not Found: ${changeReport.summary.notFound}`);
    console.log(`⏭️  Skipped (already Rejected): ${changeReport.summary.skipped}`);
    console.log('='.repeat(60));
    
    console.log('\n📋 Changed Response IDs (first 10):');
    changeReport.changes.slice(0, 10).forEach((change, index) => {
      console.log(`${index + 1}. ${change.responseId} (${change.previousStatus} → Rejected)`);
    });
    if (changeReport.changes.length > 10) {
      console.log(`... and ${changeReport.changes.length - 10} more`);
    }

    // Close connection
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
revertResponsesToRejected();

