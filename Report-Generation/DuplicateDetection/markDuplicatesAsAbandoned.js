const path = require('path');
const fs = require('fs');
const Module = require('module');

// Store original script directory BEFORE changing directory
const SCRIPT_DIR = __dirname;
const BACKEND_DIR = path.resolve(SCRIPT_DIR, '../../opine/backend');

// Add backend node_modules to module path
if (!process.env.NODE_PATH) {
  process.env.NODE_PATH = path.join(BACKEND_DIR, 'node_modules');
} else {
  process.env.NODE_PATH = process.env.NODE_PATH + path.delimiter + path.join(BACKEND_DIR, 'node_modules');
}
Module._initPaths();

// Load environment variables
require('dotenv').config({ path: path.join(BACKEND_DIR, '.env') });

// Now require modules
const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Load models (use absolute path since we changed directory)
const SurveyResponse = require(path.join(BACKEND_DIR, 'models/SurveyResponse'));

// Output directory - use absolute path since we changed directory
const OUTPUT_DIR = SCRIPT_DIR;

/**
 * Mark duplicate responses as abandoned based on the duplicate report
 */
async function markDuplicatesAsAbandoned() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Find the latest duplicate report JSON file
    const reportFiles = fs.readdirSync(OUTPUT_DIR)
      .filter(file => file.startsWith('duplicate_responses_report_') && file.endsWith('.json'))
      .sort()
      .reverse();

    if (reportFiles.length === 0) {
      throw new Error('No duplicate report found. Please run findDuplicateResponses.js first.');
    }

    const latestReportFile = path.join(OUTPUT_DIR, reportFiles[0]);
    console.log(`📄 Loading duplicate report: ${reportFiles[0]}\n`);

    const report = JSON.parse(fs.readFileSync(latestReportFile, 'utf8'));
    
    console.log('='.repeat(80));
    console.log('MARKING DUPLICATES AS ABANDONED');
    console.log('='.repeat(80));
    console.log(`Total Duplicate Groups: ${report.duplicateGroups}`);
    console.log(`Total Duplicate Entries: ${report.totalDuplicates - report.duplicateGroups}`);
    console.log('='.repeat(80));
    console.log();

    // Prepare tracking data
    const processingLog = {
      timestamp: new Date().toISOString(),
      reportFile: reportFiles[0],
      totalGroups: report.duplicateGroups,
      totalDuplicatesToMark: 0,
      originalResponses: [],
      markedAsAbandoned: [],
      errors: [],
      summary: {
        totalProcessed: 0,
        totalSuccess: 0,
        totalErrors: 0
      }
    };

    let totalMarked = 0;
    let totalErrors = 0;
    const BATCH_SIZE = 20; // Process 20 groups at a time for memory efficiency

    // Process each duplicate group in batches
    for (let i = 0; i < report.groups.length; i += BATCH_SIZE) {
      const batch = report.groups.slice(i, i + BATCH_SIZE);
      const progress = Math.min(i + BATCH_SIZE, report.groups.length);
      
      if ((i / BATCH_SIZE + 1) % 10 === 0 || i === 0) {
        console.log(`\n📦 Processing batch: ${progress}/${report.groups.length} groups... (Memory efficient processing)`);
      }
      
      for (const group of batch) {
        const originalId = group.original.mongoId;
        
        if (i % 50 === 0 || i < 5) { // Log first 5 and every 50th group
          console.log(`\n📦 Processing Group ${group.groupNumber}/${report.groups.length}:`);
          console.log(`   Original: ${group.original.responseId} (${group.original.mongoId})`);
          console.log(`   Duplicates: ${group.duplicates.length}`);
        }

        // Track original response (keep as is)
        processingLog.originalResponses.push({
          groupNumber: group.groupNumber,
          responseId: group.original.responseId,
          mongoId: group.original.mongoId,
          sessionId: group.original.sessionId,
          status: group.original.status,
          interviewer: group.original.interviewer,
          survey: group.original.survey,
          startTime: group.original.startTime,
          createdAt: group.original.createdAt
        });

        // Mark each duplicate as abandoned
        for (const duplicate of group.duplicates) {
          try {
            const duplicateId = duplicate.mongoId;
            if (i % 50 === 0 || i < 5) { // Only log for first 5 and every 50th group
              console.log(`   🔄 Marking duplicate ${duplicate.responseId} (${duplicateId}) as abandoned...`);
            }

            // Find and update the duplicate response
            const duplicateResponse = await SurveyResponse.findById(duplicateId);
            
            if (!duplicateResponse) {
              const errorMsg = `Duplicate response ${duplicateId} not found in database`;
              if (i % 50 === 0 || i < 5) {
                console.log(`   ⚠️  ${errorMsg}`);
              }
              processingLog.errors.push({
                groupNumber: group.groupNumber,
                duplicateId: duplicateId,
                responseId: duplicate.responseId,
                error: errorMsg
              });
              totalErrors++;
              continue;
            }

            // Check if already abandoned
            if (duplicateResponse.status === 'abandoned') {
              if (i % 50 === 0 || i < 5) {
                console.log(`   ℹ️  Already marked as abandoned, skipping...`);
              }
              processingLog.markedAsAbandoned.push({
                groupNumber: group.groupNumber,
                responseId: duplicate.responseId,
                mongoId: duplicateId,
                sessionId: duplicate.sessionId,
                previousStatus: duplicate.status,
                newStatus: 'abandoned',
                note: 'Already abandoned'
              });
              totalMarked++;
              continue;
            }

            // Store previous status
            const previousStatus = duplicateResponse.status;

            // Update status to abandoned
            duplicateResponse.status = 'abandoned';
            
            // Add metadata note about why it was marked as abandoned
            if (!duplicateResponse.metadata) {
              duplicateResponse.metadata = {};
            }
            duplicateResponse.metadata.duplicateMarkedAsAbandoned = {
              markedAt: new Date().toISOString(),
              reason: 'Duplicate response - marked as abandoned',
              originalResponseId: group.original.responseId,
              originalMongoId: originalId,
              groupNumber: group.groupNumber,
              previousStatus: previousStatus
            };

            // Save the updated response
            await duplicateResponse.save();

            if (i % 50 === 0 || i < 5) {
              console.log(`   ✅ Marked as abandoned (previous status: ${previousStatus})`);
            }

            processingLog.markedAsAbandoned.push({
              groupNumber: group.groupNumber,
              responseId: duplicate.responseId,
              mongoId: duplicateId,
              sessionId: duplicate.sessionId,
              previousStatus: previousStatus,
              newStatus: 'abandoned',
              originalResponseId: group.original.responseId,
              originalMongoId: originalId,
              markedAt: new Date().toISOString()
            });

            totalMarked++;
            processingLog.summary.totalSuccess++;

          } catch (error) {
            const errorMsg = `Error marking duplicate ${duplicate.responseId} (${duplicate.mongoId}): ${error.message}`;
            if (i % 50 === 0 || i < 5) { // Only log errors for first 5 and every 50th group
              console.log(`   ❌ ${errorMsg}`);
            }
            processingLog.errors.push({
              groupNumber: group.groupNumber,
              duplicateId: duplicate.mongoId,
              responseId: duplicate.responseId,
              error: errorMsg,
              errorDetails: error.stack
            });
            totalErrors++;
            processingLog.summary.totalErrors++;
          }

          processingLog.summary.totalProcessed++;
        }
      } // End of group loop
      
      // Small delay between batches to prevent overwhelming the server
      if (i + BATCH_SIZE < report.groups.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } // End of batch loop

    // Save processing log
    const logFileName = `duplicate_abandon_log_${new Date().toISOString().split('T')[0]}.json`;
    const logFilePath = path.join(OUTPUT_DIR, logFileName);
    fs.writeFileSync(logFilePath, JSON.stringify(processingLog, null, 2));

    // Generate summary report
    const summaryReport = {
      timestamp: new Date().toISOString(),
      reportFile: reportFiles[0],
      summary: {
        totalGroups: report.duplicateGroups,
        totalDuplicates: report.totalDuplicates - report.duplicateGroups,
        totalProcessed: processingLog.summary.totalProcessed,
        totalMarkedAsAbandoned: totalMarked,
        totalErrors: totalErrors,
        successRate: processingLog.summary.totalProcessed > 0 
          ? ((totalMarked / processingLog.summary.totalProcessed) * 100).toFixed(2) + '%'
          : '0%'
      },
      originalResponsesCount: processingLog.originalResponses.length,
      abandonedResponsesCount: processingLog.markedAsAbandoned.length,
      errorsCount: processingLog.errors.length,
      logFile: logFileName
    };

    const summaryFileName = `duplicate_abandon_summary_${new Date().toISOString().split('T')[0]}.json`;
    const summaryFilePath = path.join(OUTPUT_DIR, summaryFileName);
    fs.writeFileSync(summaryFilePath, JSON.stringify(summaryReport, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Groups Processed: ${report.duplicateGroups}`);
    console.log(`Total Duplicates Marked as Abandoned: ${totalMarked}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Success Rate: ${summaryReport.summary.successRate}`);
    console.log('='.repeat(80));
    console.log(`\n✅ Detailed log saved to: ${logFilePath}`);
    console.log(`✅ Summary report saved to: ${summaryFilePath}`);
    console.log(`\n⚠️  IMPORTANT: Original responses were NOT modified.`);
    console.log(`⚠️  Only duplicate responses were marked as abandoned.`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  markDuplicatesAsAbandoned();
}

module.exports = { markDuplicatesAsAbandoned };

