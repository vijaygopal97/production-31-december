#!/usr/bin/env node

/**
 * Auto-Reject Short CATI Responses
 * 
 * For survey "68fd1915d41841da463f0d46", finds all Pending_Approval CATI responses
 * from December 30, 2025 (IST) that have duration under 90 seconds and applies
 * auto-rejection using the same logic as when responses are submitted
 */

const path = require('path');
const fs = require('fs');

// Set up module resolution to use backend's node_modules
const backendPath = path.join(__dirname, '../../opine/backend');

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      const backendNodeModules = path.join(backendPath, 'node_modules');
      try {
        return originalRequire.apply(this, [path.join(backendNodeModules, id)]);
      } catch (e) {
        throw err;
      }
    }
    throw err;
  }
};

require('dotenv').config({ path: path.join(backendPath, '.env') });
const mongoose = require('mongoose');
const SurveyResponse = require(path.join(backendPath, 'models/SurveyResponse'));
const Survey = require(path.join(backendPath, 'models/Survey'));
const { checkAutoRejection, applyAutoRejection } = require(path.join(backendPath, 'utils/autoRejectionHelper'));

const SURVEY_ID = '68fd1915d41841da463f0d46';
const MIN_DURATION_SECONDS = 90; // CATI minimum duration

async function autoRejectShortCATI() {
  try {
    console.log('='.repeat(80));
    console.log('AUTO-REJECT SHORT CATI RESPONSES');
    console.log('='.repeat(80));
    console.log(`Survey ID: ${SURVEY_ID}`);
    console.log(`Minimum Duration: ${MIN_DURATION_SECONDS} seconds`);
    console.log('');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to database\n');
    
    // Get survey
    const survey = await Survey.findById(SURVEY_ID).lean();
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName || 'Unknown'}\n`);
    
    // Calculate December 30, 2025 IST date range
    const startDate30IST = new Date('2025-12-30T00:00:00+05:30');
    const endDate30IST = new Date('2025-12-30T23:59:59+05:30');
    const startDate30UTC = new Date(startDate30IST.toISOString());
    const endDate30UTC = new Date(endDate30IST.toISOString());
    
    console.log('📅 Date Range (IST):');
    console.log(`   Start: ${startDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   End: ${endDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log('');
    
    // Query Pending_Approval CATI responses from December 30, 2025
    const query = {
      survey: SURVEY_ID,
      interviewMode: 'cati',
      status: 'Pending_Approval',
      createdAt: {
        $gte: startDate30UTC,
        $lte: endDate30UTC
      }
    };
    
    console.log('🔍 Finding Pending_Approval CATI responses...');
    const allResponses = await SurveyResponse.find(query)
      .select('_id responseId sessionId status totalTimeSpent responses interviewMode createdAt abandonedReason metadata')
      .lean();
    
    console.log(`   Found ${allResponses.length} Pending_Approval CATI responses\n`);
    
    if (allResponses.length === 0) {
      console.log('✅ No responses found to check.');
      await mongoose.disconnect();
      return;
    }
    
    // Filter responses with duration < 90 seconds
    const shortResponses = allResponses.filter(response => {
      const duration = response.totalTimeSpent || 0;
      return duration < MIN_DURATION_SECONDS;
    });
    
    console.log(`   Found ${shortResponses.length} responses with duration < ${MIN_DURATION_SECONDS} seconds\n`);
    
    if (shortResponses.length === 0) {
      console.log('✅ No short responses found to auto-reject.');
      await mongoose.disconnect();
      return;
    }
    
    // Display summary
    console.log('='.repeat(80));
    console.log('SUMMARY BEFORE AUTO-REJECTION');
    console.log('='.repeat(80));
    console.log(`Total Pending_Approval CATI responses: ${allResponses.length}`);
    console.log(`Responses with duration < ${MIN_DURATION_SECONDS} seconds: ${shortResponses.length}`);
    console.log(`New status: Rejected (auto-rejected)`);
    console.log(`Rejection reason: Interview Too Short`);
    console.log('');
    
    // Process each response and apply auto-rejection
    const processedResponses = [];
    let autoRejected = 0;
    let skipped = 0;
    let errors = 0;
    
    console.log('🔄 Processing responses and applying auto-rejection...');
    
    for (let i = 0; i < shortResponses.length; i++) {
      const response = shortResponses[i];
      
      if ((i + 1) % 50 === 0 || i === shortResponses.length - 1) {
        console.log(`   Processing ${i + 1}/${shortResponses.length} responses... (Auto-rejected: ${autoRejected}, Skipped: ${skipped}, Errors: ${errors})`);
      }
      
      try {
        // Load full response document (not lean) for modification
        const surveyResponse = await SurveyResponse.findById(response._id);
        
        if (!surveyResponse) {
          console.log(`   ⚠️  Response ${response.responseId} not found, skipping...`);
          skipped++;
          continue;
        }
        
        // Check if already rejected or abandoned
        if (surveyResponse.status === 'Rejected' || surveyResponse.status === 'abandoned') {
          console.log(`   ⏭️  Response ${response.responseId} already ${surveyResponse.status}, skipping...`);
          skipped++;
          continue;
        }
        
        // Check if already auto-rejected
        if (surveyResponse.verificationData?.autoRejected === true) {
          console.log(`   ⏭️  Response ${response.responseId} already auto-rejected, skipping...`);
          skipped++;
          continue;
        }
        
        // Check if abandoned (should not auto-reject abandoned responses)
        const hasAbandonReason = surveyResponse.abandonedReason !== null && 
                                 surveyResponse.abandonedReason !== undefined && 
                                 surveyResponse.abandonedReason !== '';
        const isAbandoned = surveyResponse.status === 'abandoned' ||
                           surveyResponse.metadata?.abandoned === true ||
                           hasAbandonReason;
        
        if (isAbandoned) {
          console.log(`   ⏭️  Response ${response.responseId} is abandoned, skipping auto-rejection...`);
          skipped++;
          continue;
        }
        
        // Use the actual auto-rejection helper to check
        // This ensures we use the same logic as when responses are submitted
        const responses = surveyResponse.responses || [];
        const rejectionInfo = await checkAutoRejection(surveyResponse, responses, SURVEY_ID);
        
        if (rejectionInfo && rejectionInfo.shouldReject) {
          // Apply auto-rejection using the same helper function
          await applyAutoRejection(surveyResponse, rejectionInfo);
          
          // Reload to get updated status
          await surveyResponse.constructor.findById(surveyResponse._id);
          
          autoRejected++;
          
          processedResponses.push({
            responseId: surveyResponse.responseId || surveyResponse._id.toString(),
            mongoId: surveyResponse._id.toString(),
            sessionId: surveyResponse.sessionId,
            oldStatus: 'Pending_Approval',
            newStatus: 'Rejected',
            duration: surveyResponse.totalTimeSpent || 0,
            rejectionReasons: rejectionInfo.reasons || [],
            rejectionFeedback: rejectionInfo.feedback || 'Interview Too Short',
            autoRejected: true,
            createdAt: surveyResponse.createdAt,
            updatedAt: new Date()
          });
        } else {
          // Should not happen if duration < 90, but log it
          console.log(`   ⚠️  Response ${response.responseId} duration ${response.totalTimeSpent}s but auto-rejection check returned null`);
          skipped++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing response ${response.responseId}:`, error.message);
        errors++;
        processedResponses.push({
          responseId: response.responseId || response._id.toString(),
          mongoId: response._id.toString(),
          sessionId: response.sessionId,
          oldStatus: 'Pending_Approval',
          newStatus: 'ERROR',
          duration: response.totalTimeSpent || 0,
          error: error.message,
          createdAt: response.createdAt,
          updatedAt: new Date()
        });
      }
    }
    
    console.log(`\n✅ Processing complete:`);
    console.log(`   Auto-rejected: ${autoRejected}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}\n`);
    
    // Generate report
    const REPORT_DIR = path.join(__dirname);
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    const report = {
      timestamp: new Date().toISOString(),
      operation: 'Auto-Reject Short CATI Responses',
      surveyId: SURVEY_ID,
      surveyName: survey.surveyName || 'Unknown',
      dateRange: {
        ist: {
          start: startDate30IST.toISOString(),
          end: endDate30IST.toISOString()
        },
        utc: {
          start: startDate30UTC.toISOString(),
          end: endDate30UTC.toISOString()
        }
      },
      criteria: {
        interviewMode: 'cati',
        oldStatus: 'Pending_Approval',
        minDurationSeconds: MIN_DURATION_SECONDS,
        condition: 'duration < 90 seconds',
        newStatus: 'Rejected',
        autoRejected: true
      },
      summary: {
        totalPendingApproval: allResponses.length,
        totalShortResponses: shortResponses.length,
        totalAutoRejected: autoRejected,
        totalSkipped: skipped,
        totalErrors: errors,
        success: errors === 0
      },
      updates: processedResponses
    };
    
    // Save JSON report
    const jsonPath = path.join(REPORT_DIR, `auto_reject_short_cati_${TIMESTAMP}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON report saved: ${jsonPath}`);
    
    // Save CSV report
    const csvRows = [
      'Response ID,Mongo ID,Session ID,Old Status,New Status,Duration (seconds),Rejection Reasons,Rejection Feedback,Auto Rejected,Created At,Updated At'
    ];
    
    processedResponses.forEach(log => {
      csvRows.push([
        log.responseId,
        log.mongoId,
        log.sessionId,
        log.oldStatus,
        log.newStatus,
        log.duration,
        log.rejectionReasons ? log.rejectionReasons.map(r => r.condition || r.reason).join('; ') : '',
        log.rejectionFeedback || log.error || '',
        log.autoRejected ? 'Yes' : 'No',
        new Date(log.createdAt).toISOString(),
        new Date(log.updatedAt).toISOString()
      ].join(','));
    });
    
    const csvPath = path.join(REPORT_DIR, `auto_reject_short_cati_${TIMESTAMP}.csv`);
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved: ${csvPath}`);
    
    // Save simple response IDs list
    const responseIdsList = processedResponses
      .filter(r => r.newStatus === 'Rejected')
      .map(u => u.responseId)
      .join('\n');
    const idsPath = path.join(REPORT_DIR, `response_ids_auto_rejected_${TIMESTAMP}.txt`);
    fs.writeFileSync(idsPath, responseIdsList);
    console.log(`✅ Response IDs list saved: ${idsPath}`);
    
    // Final summary
    console.log('');
    console.log('='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Pending_Approval CATI Responses: ${allResponses.length}`);
    console.log(`Responses with Duration < ${MIN_DURATION_SECONDS} seconds: ${shortResponses.length}`);
    console.log(`Total Auto-Rejected: ${autoRejected}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`New Status: Rejected (auto-rejected)`);
    console.log(`Rejection Reason: Interview Too Short`);
    console.log('='.repeat(80));
    
    if (errors > 0) {
      console.log(`\n⚠️  WARNING: ${errors} errors occurred during processing`);
    } else {
      console.log('\n✅ All responses successfully processed!');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error.stack) console.error(error.stack);
    
    // Save error log
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const REPORT_DIR = path.join(__dirname);
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const errorPath = path.join(REPORT_DIR, `auto_reject_short_cati_error_${TIMESTAMP}.json`);
    fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
    console.log(`\n❌ Error log saved: ${errorPath}`);
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  autoRejectShortCATI();
}

module.exports = { autoRejectShortCATI };






