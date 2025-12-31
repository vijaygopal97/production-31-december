#!/usr/bin/env node

/**
 * Mark CATI Responses Without AC as Abandoned
 * 
 * Finds all Pending_Approval CATI responses from December 29-30, 2025 (IST)
 * that have empty or missing selectedAC field and marks them as abandoned
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

async function markCATIWithoutACAsAbandoned() {
  try {
    console.log('='.repeat(80));
    console.log('MARK CATI RESPONSES WITHOUT AC AS ABANDONED');
    console.log('='.repeat(80));
    console.log('');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to database\n');
    
    // Calculate date ranges for December 29 and 30, 2025 (IST)
    // IST is UTC+5:30
    
    // December 29, 2025 IST
    const startDate29IST = new Date('2025-12-29T00:00:00+05:30');
    const endDate29IST = new Date('2025-12-29T23:59:59+05:30');
    const startDate29UTC = new Date(startDate29IST.toISOString());
    const endDate29UTC = new Date(endDate29IST.toISOString());
    
    // December 30, 2025 IST
    const startDate30IST = new Date('2025-12-30T00:00:00+05:30');
    const endDate30IST = new Date('2025-12-30T23:59:59+05:30');
    const startDate30UTC = new Date(startDate30IST.toISOString());
    const endDate30UTC = new Date(endDate30IST.toISOString());
    
    console.log('📅 Date Ranges (IST):');
    console.log(`   December 29: ${startDate29IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} to ${endDate29IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   December 30: ${startDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} to ${endDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log('');
    
    const allUpdates = [];
    
    // Process December 29, 2025
    console.log('🔍 Checking December 29, 2025 CATI responses...');
    const query29 = {
      interviewMode: 'cati',
      status: 'Pending_Approval',
      createdAt: {
        $gte: startDate29UTC,
        $lte: endDate29UTC
      },
      $or: [
        { selectedAC: null },
        { selectedAC: '' },
        { selectedAC: { $exists: false } }
      ]
    };
    
    const responses29 = await SurveyResponse.find(query29)
      .select('_id responseId sessionId status selectedAC createdAt startTime interviewer survey call_id')
      .lean();
    
    console.log(`   Found ${responses29.length} responses without selectedAC on December 29\n`);
    
    // Process December 30, 2025
    console.log('🔍 Checking December 30, 2025 CATI responses...');
    const query30 = {
      interviewMode: 'cati',
      status: 'Pending_Approval',
      createdAt: {
        $gte: startDate30UTC,
        $lte: endDate30UTC
      },
      $or: [
        { selectedAC: null },
        { selectedAC: '' },
        { selectedAC: { $exists: false } }
      ]
    };
    
    const responses30 = await SurveyResponse.find(query30)
      .select('_id responseId sessionId status selectedAC createdAt startTime interviewer survey call_id')
      .lean();
    
    console.log(`   Found ${responses30.length} responses without selectedAC on December 30\n`);
    
    const allResponses = [...responses29, ...responses30];
    
    if (allResponses.length === 0) {
      console.log('✅ No responses found to update.');
      await mongoose.disconnect();
      return;
    }
    
    console.log('='.repeat(80));
    console.log('SUMMARY BEFORE UPDATE');
    console.log('='.repeat(80));
    console.log(`Total responses to update: ${allResponses.length}`);
    console.log(`  - December 29: ${responses29.length}`);
    console.log(`  - December 30: ${responses30.length}`);
    console.log(`New status: abandoned`);
    console.log(`Reason: Missing or empty selectedAC field`);
    console.log('');
    
    // Update in batches
    const BATCH_SIZE = 500;
    const responseIds = allResponses.map(r => r._id);
    let updated = 0;
    
    console.log('🔄 Updating responses in batches...');
    
    for (let i = 0; i < responseIds.length; i += BATCH_SIZE) {
      const batch = responseIds.slice(i, i + BATCH_SIZE);
      
      try {
        const result = await SurveyResponse.updateMany(
          { _id: { $in: batch } },
          { 
            $set: { 
              status: 'abandoned',
              abandonedReason: 'Missing or empty selectedAC field'
            }
          }
        );
        
        updated += result.modifiedCount;
        
        // Log this batch
        const batchResponses = allResponses.filter(r => batch.includes(r._id));
        batchResponses.forEach(resp => {
          const date = new Date(resp.createdAt);
          const isDec29 = date >= startDate29UTC && date <= endDate29UTC;
          const isDec30 = date >= startDate30UTC && date <= endDate30UTC;
          const dateLabel = isDec29 ? 'December 29, 2025' : (isDec30 ? 'December 30, 2025' : 'Unknown');
          
          allUpdates.push({
            responseId: resp.responseId || resp._id.toString(),
            mongoId: resp._id.toString(),
            sessionId: resp.sessionId,
            oldStatus: 'Pending_Approval',
            newStatus: 'abandoned',
            abandonedReason: 'Missing or empty selectedAC field',
            selectedAC: resp.selectedAC || null,
            date: dateLabel,
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
    
    console.log(`\n✅ Successfully updated ${updated} responses to abandoned status\n`);
    
    // Generate report
    const REPORT_DIR = path.join(__dirname);
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    const report = {
      timestamp: new Date().toISOString(),
      operation: 'Mark CATI Responses Without AC as Abandoned',
      dateRanges: {
        december29: {
          ist: {
            start: startDate29IST.toISOString(),
            end: endDate29IST.toISOString()
          },
          utc: {
            start: startDate29UTC.toISOString(),
            end: endDate29UTC.toISOString()
          }
        },
        december30: {
          ist: {
            start: startDate30IST.toISOString(),
            end: endDate30IST.toISOString()
          },
          utc: {
            start: startDate30UTC.toISOString(),
            end: endDate30UTC.toISOString()
          }
        }
      },
      criteria: {
        interviewMode: 'cati',
        oldStatus: 'Pending_Approval',
        selectedAC: 'null/empty/missing',
        newStatus: 'abandoned',
        abandonedReason: 'Missing or empty selectedAC field'
      },
      summary: {
        totalFound: allResponses.length,
        december29: responses29.length,
        december30: responses30.length,
        totalUpdated: updated,
        success: updated === allResponses.length
      },
      updates: allUpdates
    };
    
    // Save JSON report
    const jsonPath = path.join(REPORT_DIR, `mark_cati_without_ac_abandoned_${TIMESTAMP}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON report saved: ${jsonPath}`);
    
    // Save CSV report
    const csvRows = [
      'Response ID,Mongo ID,Session ID,Date,Old Status,New Status,Abandoned Reason,Selected AC,Created At,Updated At'
    ];
    
    allUpdates.forEach(log => {
      csvRows.push([
        log.responseId,
        log.mongoId,
        log.sessionId,
        log.date,
        log.oldStatus,
        log.newStatus,
        log.abandonedReason,
        log.selectedAC || '(null/empty)',
        new Date(log.createdAt).toISOString(),
        new Date(log.updatedAt).toISOString()
      ].join(','));
    });
    
    const csvPath = path.join(REPORT_DIR, `mark_cati_without_ac_abandoned_${TIMESTAMP}.csv`);
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved: ${csvPath}`);
    
    // Save simple response IDs list
    const responseIdsList = allUpdates.map(u => u.responseId).join('\n');
    const idsPath = path.join(REPORT_DIR, `response_ids_changed_${TIMESTAMP}.txt`);
    fs.writeFileSync(idsPath, responseIdsList);
    console.log(`✅ Response IDs list saved: ${idsPath}`);
    
    // Final summary
    console.log('');
    console.log('='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Responses Found: ${allResponses.length}`);
    console.log(`  - December 29, 2025: ${responses29.length}`);
    console.log(`  - December 30, 2025: ${responses30.length}`);
    console.log(`Total Responses Updated: ${updated}`);
    console.log(`New Status: abandoned`);
    console.log(`Abandoned Reason: Missing or empty selectedAC field`);
    console.log('='.repeat(80));
    
    if (updated !== allResponses.length) {
      console.log(`\n⚠️  WARNING: Expected to update ${allResponses.length} but only updated ${updated}`);
    } else {
      console.log('\n✅ All responses successfully updated!');
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
    const errorPath = path.join(REPORT_DIR, `mark_cati_without_ac_error_${TIMESTAMP}.json`);
    fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
    console.log(`\n❌ Error log saved: ${errorPath}`);
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  markCATIWithoutACAsAbandoned();
}

module.exports = { markCATIWithoutACAsAbandoned };






