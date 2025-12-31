/**
 * Script to revert incorrectly changed responses back to Pending_Approval
 * 
 * Problem: We ran updateMany that changed ALL responses (including CAPI) with abandonedReason to 'abandoned'
 * Solution: Revert CAPI responses with abandonedReason back to 'Pending_Approval'
 * 
 * Note: CATI responses should remain as 'abandoned' if they have abandonedReason
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');

const isProduction = process.argv.includes('--production');
const MONGODB_URI = isProduction 
  ? process.env.PRODUCTION_MONGO_URI || process.env.MONGODB_URI
  : process.env.MONGODB_URI;

async function revertIncorrectStatus() {
  try {
    console.log(`🔌 Connecting to ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} database...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const results = {
      capiReverted: [],
      totalReverted: 0
    };

    // Find CAPI responses that were incorrectly changed to 'abandoned'
    // CAPI responses with abandonedReason should remain as 'Pending_Approval' (they need approval even if abandoned)
    console.log('🔍 Finding CAPI responses incorrectly marked as abandoned...');
    
    const capiIncorrectlyAbandoned = await SurveyResponse.find({
      interviewMode: 'capi',
      abandonedReason: { $exists: true, $ne: null, $ne: '' },
      status: 'abandoned'
    }).lean();

    console.log(`   Found ${capiIncorrectlyAbandoned.length} CAPI responses incorrectly marked as abandoned`);

    if (capiIncorrectlyAbandoned.length === 0) {
      console.log('✅ No CAPI responses to revert');
      await mongoose.connection.close();
      return;
    }

    // Revert them back to 'Pending_Approval'
    console.log('\n🔄 Reverting CAPI responses back to Pending_Approval...');
    
    const responseIds = capiIncorrectlyAbandoned.map(r => r._id);
    
    const updateResult = await SurveyResponse.updateMany(
      {
        _id: { $in: responseIds },
        interviewMode: 'capi',
        status: 'abandoned'
      },
      {
        $set: {
          status: 'Pending_Approval'
        },
        $unset: {
          'metadata.abandonedStatusFixed': ''
        }
      }
    );

    console.log(`✅ Reverted ${updateResult.modifiedCount} CAPI responses from 'abandoned' to 'Pending_Approval'`);

    results.totalReverted = updateResult.modifiedCount;
    results.capiReverted = capiIncorrectlyAbandoned.slice(0, 100).map(r => ({
      responseId: r.responseId,
      abandonedReason: r.abandonedReason,
      answeredQuestions: r.answeredQuestions,
      completionPercentage: r.completionPercentage
    }));

    // Verify the fix
    const pendingApprovalCount = await SurveyResponse.countDocuments({ 
      interviewMode: 'capi', 
      status: 'Pending_Approval' 
    });
    const capiAbandonedCount = await SurveyResponse.countDocuments({ 
      interviewMode: 'capi', 
      status: 'abandoned' 
    });

    console.log('\n📊 VERIFICATION:');
    console.log(`   CAPI Pending_Approval: ${pendingApprovalCount}`);
    console.log(`   CAPI abandoned: ${capiAbandonedCount}`);

    // Save results to file
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(__dirname, '../../Report-Generation/CatiCleanup');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const env = isProduction ? 'production' : 'development';
    const outputFile = path.join(outputDir, `revert_capi_status_${env}_${timestamp}.json`);
    
    fs.writeFileSync(outputFile, JSON.stringify({
      database: env,
      timestamp: new Date().toISOString(),
      action: 'revert_capi_abandoned_to_pending_approval',
      summary: {
        totalReverted: results.totalReverted
      },
      details: results
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${outputFile}`);
    console.log('\n✅ Reversion complete!');

    await mongoose.connection.close();
    
    return results;

  } catch (error) {
    console.error('❌ Error during reversion:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the reversion
revertIncorrectStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

