/**
 * Script to clean CATI duplicates and fix abandoned status issues
 * 
 * 1. Finds duplicate CATI responses (same call_id) and marks duplicates as abandoned
 * 2. Fixes CATI responses with abandonedReason but wrong status
 * 
 * Usage: node scripts/cleanCatiDuplicatesAndAbandoned.js [--production]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');

const isProduction = process.argv.includes('--production');

const MONGODB_URI = isProduction 
  ? process.env.PRODUCTION_MONGO_URI || process.env.MONGODB_URI
  : process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function cleanCatiDuplicatesAndAbandoned() {
  try {
    console.log(`🔌 Connecting to ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} database...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const results = {
      duplicates: {
        found: [],
        marked: [],
        responseIds: []
      },
      abandonedStatus: {
        found: [],
        fixed: [],
        responseIds: []
      }
    };

    // ============================================
    // PART 1: Find and mark duplicate CATI responses
    // ============================================
    console.log('\n📊 PART 1: Finding duplicate CATI responses...');
    
    // Find all CATI responses with call_id
    const catiResponses = await SurveyResponse.find({
      interviewMode: 'cati',
      call_id: { $exists: true, $ne: null, $ne: '' }
    }).sort({ createdAt: 1 }).lean(); // Sort by creation time to keep earliest

    console.log(`   Found ${catiResponses.length} CATI responses with call_id`);

    // Group by call_id to find duplicates
    const callIdGroups = {};
    catiResponses.forEach(response => {
      const callId = response.call_id;
      if (!callIdGroups[callId]) {
        callIdGroups[callId] = [];
      }
      callIdGroups[callId].push(response);
    });

    // Find duplicates (groups with more than 1 response)
    const duplicateGroups = Object.entries(callIdGroups).filter(([callId, responses]) => responses.length > 1);
    console.log(`   Found ${duplicateGroups.length} call_ids with duplicates`);

    // Mark duplicates as abandoned (keep the first/earliest one)
    for (const [callId, responses] of duplicateGroups) {
      // Sort by createdAt to keep the earliest
      const sortedResponses = responses.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const original = sortedResponses[0]; // Keep the first one
      const duplicates = sortedResponses.slice(1); // Mark the rest as abandoned

      results.duplicates.found.push({
        call_id: callId,
        original: original.responseId,
        originalMongoId: original._id.toString(),
        duplicates: duplicates.map(r => ({
          responseId: r.responseId,
          mongoId: r._id.toString(),
          status: r.status,
          createdAt: r.createdAt
        }))
      });

      // Mark duplicates as abandoned
      for (const duplicate of duplicates) {
        if (duplicate.status !== 'abandoned') {
          const updateResult = await SurveyResponse.updateOne(
            { _id: duplicate._id },
            {
              $set: {
                status: 'abandoned',
                abandonedReason: duplicate.abandonedReason || 'Duplicate_CATI_Response',
                'metadata.duplicateCleanup': {
                  originalResponseId: original.responseId,
                  originalMongoId: original._id.toString(),
                  cleanedAt: new Date(),
                  reason: 'Duplicate CATI response with same call_id'
                }
              }
            }
          );

          if (updateResult.modifiedCount > 0) {
            results.duplicates.marked.push({
              responseId: duplicate.responseId,
              mongoId: duplicate._id.toString(),
              call_id: callId,
              oldStatus: duplicate.status,
              originalResponseId: original.responseId
            });
            results.duplicates.responseIds.push(duplicate.responseId);
            console.log(`   ✅ Marked duplicate as abandoned: ${duplicate.responseId} (original: ${original.responseId}, call_id: ${callId})`);
          }
        }
      }
    }

    console.log(`\n✅ PART 1 Complete: Marked ${results.duplicates.marked.length} duplicate CATI responses as abandoned`);

    // ============================================
    // PART 2: Fix abandoned status issues
    // ============================================
    console.log('\n📊 PART 2: Fixing CATI responses with abandonedReason but wrong status...');

    // Find CATI responses with abandonedReason but status is not 'abandoned'
    const responsesToFix = await SurveyResponse.find({
      interviewMode: 'cati',
      abandonedReason: { $exists: true, $ne: null, $ne: '' },
      status: { $ne: 'abandoned' }
    }).lean();

    console.log(`   Found ${responsesToFix.length} CATI responses with abandonedReason but wrong status`);

    for (const response of responsesToFix) {
      results.abandonedStatus.found.push({
        responseId: response.responseId,
        mongoId: response._id.toString(),
        abandonedReason: response.abandonedReason,
        oldStatus: response.status,
        createdAt: response.createdAt
      });

      const updateResult = await SurveyResponse.updateOne(
        { _id: response._id },
        {
          $set: {
            status: 'abandoned',
            'metadata.abandonedStatusFixed': {
              oldStatus: response.status,
              fixedAt: new Date(),
              reason: 'Response had abandonedReason but status was not abandoned'
            }
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        results.abandonedStatus.fixed.push({
          responseId: response.responseId,
          mongoId: response._id.toString(),
          abandonedReason: response.abandonedReason,
          oldStatus: response.status
        });
        results.abandonedStatus.responseIds.push(response.responseId);
        console.log(`   ✅ Fixed status: ${response.responseId} (${response.status} -> abandoned, reason: ${response.abandonedReason})`);
      }
    }

    console.log(`\n✅ PART 2 Complete: Fixed ${results.abandonedStatus.fixed.length} CATI responses with abandoned status issues`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(80));
    console.log('📋 CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n📊 Database: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`\n1️⃣ DUPLICATE CATI RESPONSES:`);
    console.log(`   - Duplicate groups found: ${duplicateGroups.length}`);
    console.log(`   - Duplicate responses marked as abandoned: ${results.duplicates.marked.length}`);
    console.log(`   - Response IDs changed: ${results.duplicates.responseIds.length}`);
    
    if (results.duplicates.responseIds.length > 0) {
      console.log(`\n   📝 Response IDs marked as abandoned (duplicates):`);
      results.duplicates.responseIds.forEach((id, index) => {
        const info = results.duplicates.marked.find(m => m.responseId === id);
        console.log(`      ${index + 1}. ${id} (was: ${info?.oldStatus || 'unknown'}, call_id: ${info?.call_id || 'unknown'}, original: ${info?.originalResponseId || 'unknown'})`);
      });
    }

    console.log(`\n2️⃣ ABANDONED STATUS FIXES:`);
    console.log(`   - Responses with abandonedReason but wrong status: ${results.abandonedStatus.found.length}`);
    console.log(`   - Responses fixed: ${results.abandonedStatus.fixed.length}`);
    console.log(`   - Response IDs changed: ${results.abandonedStatus.responseIds.length}`);
    
    if (results.abandonedStatus.responseIds.length > 0) {
      console.log(`\n   📝 Response IDs fixed (abandoned status):`);
      results.abandonedStatus.responseIds.forEach((id, index) => {
        const info = results.abandonedStatus.fixed.find(f => f.responseId === id);
        console.log(`      ${index + 1}. ${id} (was: ${info?.oldStatus || 'unknown'}, reason: ${info?.abandonedReason || 'unknown'})`);
      });
    }

    const totalChanged = results.duplicates.responseIds.length + results.abandonedStatus.responseIds.length;
    console.log(`\n🎯 TOTAL RESPONSES CHANGED: ${totalChanged}`);
    console.log('='.repeat(80));

    // Save detailed results to file
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(__dirname, '../../Report-Generation/CatiCleanup');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const env = isProduction ? 'production' : 'development';
    const outputFile = path.join(outputDir, `cati_cleanup_${env}_${timestamp}.json`);
    
    fs.writeFileSync(outputFile, JSON.stringify({
      database: env,
      timestamp: new Date().toISOString(),
      summary: {
        duplicatesMarked: results.duplicates.marked.length,
        abandonedStatusFixed: results.abandonedStatus.fixed.length,
        totalChanged: totalChanged
      },
      details: results
    }, null, 2));
    
    console.log(`\n💾 Detailed results saved to: ${outputFile}`);

    await mongoose.connection.close();
    console.log('\n✅ Database cleanup complete!');
    
    return results;

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the cleanup
cleanCatiDuplicatesAndAbandoned()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

