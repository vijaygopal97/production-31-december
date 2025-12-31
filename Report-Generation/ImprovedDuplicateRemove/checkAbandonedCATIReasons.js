#!/usr/bin/env node

/**
 * Check Abandoned CATI Reasons Script
 * 
 * Finds all abandoned CATI interviews from December 30, 2025 (IST)
 * and lists unique values in the abandonedReason field
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

async function checkAbandonedReasons() {
  try {
    console.log('='.repeat(80));
    console.log('CHECKING ABANDONED CATI REASONS - DECEMBER 30, 2025 (IST)');
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
    console.log('📅 Date Range (UTC for MongoDB query):');
    console.log(`   Start: ${startDateUTC.toISOString()}`);
    console.log(`   End: ${endDateUTC.toISOString()}`);
    console.log('');
    
    // Query abandoned CATI responses from December 30, 2025
    const query = {
      interviewMode: 'cati',
      status: 'abandoned',
      createdAt: {
        $gte: startDateUTC,
        $lte: endDateUTC
      }
    };
    
    console.log('🔍 Querying abandoned CATI responses...');
    const abandonedResponses = await SurveyResponse.find(query)
      .select('_id responseId sessionId status abandonedReason createdAt startTime interviewer survey call_id')
      .lean();
    
    console.log(`   Found ${abandonedResponses.length} abandoned CATI responses from December 30, 2025\n`);
    
    if (abandonedResponses.length === 0) {
      console.log('✅ No abandoned CATI responses found for this date.');
      await mongoose.disconnect();
      return;
    }
    
    // Get unique abandonedReason values
    const reasonsMap = {};
    const responsesByReason = {};
    
    abandonedResponses.forEach(resp => {
      const reason = resp.abandonedReason || null;
      const reasonKey = reason ? reason.toString() : 'null';
      
      if (!reasonsMap[reasonKey]) {
        reasonsMap[reasonKey] = {
          value: reason,
          count: 0,
          responseIds: []
        };
        responsesByReason[reasonKey] = [];
      }
      
      reasonsMap[reasonKey].count++;
      reasonsMap[reasonKey].responseIds.push({
        responseId: resp.responseId || resp._id.toString(),
        mongoId: resp._id.toString(),
        sessionId: resp.sessionId,
        createdAt: resp.createdAt
      });
      responsesByReason[reasonKey].push(resp);
    });
    
    // Display results
    console.log('='.repeat(80));
    console.log('UNIQUE ABANDONED REASONS FOUND');
    console.log('='.repeat(80));
    console.log('');
    
    const uniqueReasons = Object.keys(reasonsMap).sort((a, b) => {
      return reasonsMap[b].count - reasonsMap[a].count; // Sort by count descending
    });
    
    console.log(`Total Unique Reasons: ${uniqueReasons.length}\n`);
    
    uniqueReasons.forEach((reasonKey, index) => {
      const reasonData = reasonsMap[reasonKey];
      const displayValue = reasonData.value === null ? '(null/empty)' : reasonData.value;
      console.log(`${index + 1}. "${displayValue}"`);
      console.log(`   Count: ${reasonData.count} responses`);
      console.log(`   Percentage: ${((reasonData.count / abandonedResponses.length) * 100).toFixed(2)}%`);
      console.log('');
    });
    
    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
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
      totalAbandonedResponses: abandonedResponses.length,
      uniqueReasons: uniqueReasons.map(reasonKey => ({
        reason: reasonsMap[reasonKey].value,
        count: reasonsMap[reasonKey].count,
        percentage: ((reasonsMap[reasonKey].count / abandonedResponses.length) * 100).toFixed(2),
        responseIds: reasonsMap[reasonKey].responseIds
      })),
      summary: {
        withReason: abandonedResponses.filter(r => r.abandonedReason).length,
        withoutReason: abandonedResponses.filter(r => !r.abandonedReason).length
      }
    };
    
    // Save report
    const REPORT_DIR = path.join(__dirname);
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportPath = path.join(REPORT_DIR, `abandoned_cati_reasons_${TIMESTAMP}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Detailed report saved: ${reportPath}`);
    
    // Save CSV
    const csvRows = ['Reason,Count,Percentage,Response ID,Mongo ID,Session ID,Created At'];
    uniqueReasons.forEach(reasonKey => {
      const reasonData = reasonsMap[reasonKey];
      const displayValue = reasonData.value === null ? '(null/empty)' : reasonData.value;
      reasonData.responseIds.forEach((resp, idx) => {
        csvRows.push([
          idx === 0 ? `"${displayValue}"` : '', // Only show reason in first row
          idx === 0 ? reasonData.count : '',
          idx === 0 ? `${((reasonData.count / abandonedResponses.length) * 100).toFixed(2)}%` : '',
          resp.responseId,
          resp.mongoId,
          resp.sessionId,
          new Date(resp.createdAt).toISOString()
        ].join(','));
      });
    });
    
    const csvPath = path.join(REPORT_DIR, `abandoned_cati_reasons_${TIMESTAMP}.csv`);
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved: ${csvPath}`);
    
    console.log('');
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Abandoned CATI Responses: ${abandonedResponses.length}`);
    console.log(`Unique Reasons: ${uniqueReasons.length}`);
    console.log(`With Reason: ${report.summary.withReason}`);
    console.log(`Without Reason (null/empty): ${report.summary.withoutReason}`);
    console.log('='.repeat(80));
    
    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  checkAbandonedReasons();
}

module.exports = { checkAbandonedReasons };






