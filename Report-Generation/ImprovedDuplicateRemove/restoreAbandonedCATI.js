#!/usr/bin/env node

/**
 * Restore Abandoned CATI Responses Script
 * 
 * Restores abandoned CATI interviews from December 30, 2025 (IST)
 * that have null/empty abandonedReason back to "Pending_Approval" status
 */

const path = require('path');
const fs = require('fs');

// Set up module resolution to use backend's node_modules
const backendPath = path.join(__dirname, '../../opine/backend');

// Add backend's node_modules to module path
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      // Try loading from backend's node_modules
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

// Now require modules
require('dotenv').config({ path: path.join(backendPath, '.env') });
const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Load models
const SurveyResponse = require(path.join(backendPath, 'models/SurveyResponse'));

async function restoreAbandonedCATI() {
  try {
    console.log('='.repeat(80));
    console.log('RESTORE ABANDONED CATI RESPONSES - DECEMBER 30, 2025 (IST)');
    console.log('='.repeat(80));
    console.log('');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to database\n');
    
    // Calculate December 30, 2025 IST date range
    // IST is UTC+5:30
    // December 30, 2025 00:00:00 IST = December 29, 2025 18:30:00 UTC
    // December 30, 2025 23:59:59 IST = December 30, 2025 18:29:59 UTC
    
    const startDateIST = new Date('2025-12-30T00:00:00+05:30');
    const endDateIST = new Date('2025-12-30T23:59:59+05:30');
    
    // Convert to UTC for MongoDB query
    const startDateUTC = new Date(startDateIST.toISOString());
    const endDateUTC = new Date(endDateIST.toISOString());
    
    console.log('📅 Date Range (IST):');
    console.log(`   Start: ${startDateIST.toISOString()} (${startDateIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})`);
    console.log(`   End: ${endDateIST.toISOString()} (${endDateIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})`);
    console.log('');
    
    // Query abandoned CATI responses from December 30, 2025 with null/empty abandonedReason
    const query = {
      interviewMode: 'cati',
      status: 'abandoned',
      createdAt: {
        $gte: startDateUTC,
        $lte: endDateUTC
      },
      $or: [
        { abandonedReason: null },
        { abandonedReason: '' },
        { abandonedReason: { $exists: false } }
      ]
    };
    
    console.log('🔍 Finding abandoned CATI responses with null/empty abandonedReason...');
    
    // First, get all matching response IDs
    const matchingResponses = await SurveyResponse.find(query)
      .select('_id responseId sessionId status abandonedReason createdAt startTime interviewer survey call_id')
      .lean();
    
    console.log(`   Found ${matchingResponses.length} responses to restore\n`);
    
    if (matchingResponses.length === 0) {
      console.log('✅ No responses found to restore.');
      await mongoose.disconnect();
      return;
    }
    
    // Display summary
    console.log('📊 Summary:');
    console.log(`   Total responses to restore: ${matchingResponses.length}`);
    console.log(`   New status: Pending_Approval`);
    console.log('');
    
    // Update in batches
    const BATCH_SIZE = 500;
    const responseIds = matchingResponses.map(r => r._id);
    let updated = 0;
    const updateLog = [];
    
    console.log('🔄 Updating responses in batches...');
    
    for (let i = 0; i < responseIds.length; i += BATCH_SIZE) {
      const batch = responseIds.slice(i, i + BATCH_SIZE);
      
      try {
        const result = await SurveyResponse.updateMany(
          { _id: { $in: batch } },
          { 
            $set: { 
              status: 'Pending_Approval'
            },
            $unset: {
              abandonedReason: ''
            }
          }
        );
        
        updated += result.modifiedCount;
        
        // Log this batch
        const batchResponses = matchingResponses.filter(r => batch.includes(r._id));
        batchResponses.forEach(resp => {
          updateLog.push({
            responseId: resp.responseId || resp._id.toString(),
            mongoId: resp._id.toString(),
            sessionId: resp.sessionId,
            oldStatus: 'abandoned',
            newStatus: 'Pending_Approval',
            abandonedReason: resp.abandonedReason || null,
            createdAt: resp.createdAt,
            updatedAt: new Date()
          });
        });
        
        if ((i / BATCH_SIZE + 1) % 5 === 0 || i + BATCH_SIZE >= responseIds.length) {
          console.log(`   Updated ${updated}/${responseIds.length} responses...`);
        }
      } catch (error) {
        console.error(`   ❌ Error updating batch ${i / BATCH_SIZE + 1}:`, error.message);
        throw error;
      }
    }
    
    console.log(`\n✅ Successfully restored ${updated} responses to Pending_Approval status\n`);
    
    // Generate report
    const REPORT_DIR = path.join(__dirname);
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    const report = {
      timestamp: new Date().toISOString(),
      operation: 'Restore Abandoned CATI Responses',
      dateRange: {
        ist: {
          start: startDateIST.toISOString(),
          end: endDateIST.toISOString()
        },
        utc: {
          start: startDateUTC.toISOString(),
          end: endDateUTC.toISOString()
        }
      },
      criteria: {
        interviewMode: 'cati',
        oldStatus: 'abandoned',
        abandonedReason: 'null/empty',
        newStatus: 'Pending_Approval'
      },
      summary: {
        totalFound: matchingResponses.length,
        totalUpdated: updated,
        success: updated === matchingResponses.length
      },
      updates: updateLog
    };
    
    // Save JSON report
    const jsonPath = path.join(REPORT_DIR, `restore_abandoned_cati_${TIMESTAMP}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON report saved: ${jsonPath}`);
    
    // Save CSV report
    const csvRows = [
      'Response ID,Mongo ID,Session ID,Old Status,New Status,Abandoned Reason,Created At,Updated At'
    ];
    
    updateLog.forEach(log => {
      csvRows.push([
        log.responseId,
        log.mongoId,
        log.sessionId,
        log.oldStatus,
        log.newStatus,
        log.abandonedReason || '(null/empty)',
        new Date(log.createdAt).toISOString(),
        new Date(log.updatedAt).toISOString()
      ].join(','));
    });
    
    const csvPath = path.join(REPORT_DIR, `restore_abandoned_cati_${TIMESTAMP}.csv`);
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved: ${csvPath}`);
    
    // Final summary
    console.log('');
    console.log('='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Responses Found: ${matchingResponses.length}`);
    console.log(`Total Responses Updated: ${updated}`);
    console.log(`New Status: Pending_Approval`);
    console.log(`Abandoned Reason: Removed (was null/empty)`);
    console.log('='.repeat(80));
    
    if (updated !== matchingResponses.length) {
      console.log(`\n⚠️  WARNING: Expected to update ${matchingResponses.length} but only updated ${updated}`);
    } else {
      console.log('\n✅ All responses successfully restored!');
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
    const errorPath = path.join(REPORT_DIR, `restore_abandoned_cati_error_${TIMESTAMP}.json`);
    fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
    console.log(`\n❌ Error log saved: ${errorPath}`);
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  restoreAbandonedCATI();
}

module.exports = { restoreAbandonedCATI };






