/**
 * Revert "No Audio" rejected CATI responses from Dec 13, 2025 back to Pending_Approval
 * 
 * This script:
 * 1. Finds all CATI responses from Dec 13, 2025 that were rejected with "No Audio"
 * 2. Excludes the specified response IDs that should remain rejected
 * 3. Changes their status from "Rejected" back to "Pending_Approval"
 * 4. Clears verification data so they can be QC'd again
 * 
 * IMPORTANT: This script runs on PRODUCTION database only
 */

const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const TARGET_DATE = new Date('2025-12-13T00:00:00.000Z');
const TARGET_DATE_END = new Date('2025-12-13T23:59:59.999Z');

// Response IDs to EXCLUDE from reversion (keep as rejected)
const EXCLUDED_RESPONSE_IDS = [
  'b01573df-edd0-418e-8d46-21348183add2',
  '3947a153-0d5a-4ffd-a4e8-04d222e098d3',
  '5c58e76e-faaa-45c1-bd4c-3bf9667a1ebe'
];

const revertNoAudioRejections = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Finding "No Audio" rejected CATI responses from Dec 13, 2025...');
    console.log(`   Date range: ${TARGET_DATE.toISOString()} to ${TARGET_DATE_END.toISOString()}`);
    console.log(`   Excluding ${EXCLUDED_RESPONSE_IDS.length} response IDs from reversion\n`);

    // Find all rejected CATI responses from Dec 13, 2025
    const rejectedCATIResponses = await SurveyResponse.find({
      interviewMode: 'cati',
      status: 'Rejected',
      createdAt: {
        $gte: TARGET_DATE,
        $lte: TARGET_DATE_END
      }
    })
    .select('_id responseId sessionId status createdAt interviewMode verificationData.feedback')
    .lean();

    console.log(`📊 Found ${rejectedCATIResponses.length} rejected CATI responses from Dec 13, 2025\n`);

    // Filter for "No Audio" in feedback
    const noAudioResponses = rejectedCATIResponses.filter(response => {
      const feedback = response.verificationData?.feedback || '';
      return feedback.toLowerCase().includes('no audio') || 
             feedback.toLowerCase().includes('noaudio') ||
             feedback.toLowerCase().includes('no-audio');
    });

    console.log(`📊 Found ${noAudioResponses.length} responses rejected with "No Audio" reason\n`);

    // Exclude the specified response IDs
    const responsesToRevert = noAudioResponses.filter(response => {
      const responseId = response.responseId || response._id.toString();
      return !EXCLUDED_RESPONSE_IDS.includes(responseId);
    });

    const excludedResponses = noAudioResponses.filter(response => {
      const responseId = response.responseId || response._id.toString();
      return EXCLUDED_RESPONSE_IDS.includes(responseId);
    });

    console.log(`📊 Responses to revert to Pending_Approval: ${responsesToRevert.length}`);
    console.log(`📊 Responses to keep as Rejected (excluded): ${excludedResponses.length}\n`);

    if (responsesToRevert.length === 0) {
      console.log('✅ No responses to revert. Exiting.\n');
      await mongoose.disconnect();
      return;
    }

    // Show sample of responses to be reverted
    console.log('📋 Sample of responses to be reverted (first 5):');
    responsesToRevert.slice(0, 5).forEach((resp, idx) => {
      console.log(`   ${idx + 1}. Response ID: ${resp.responseId || resp._id}`);
    });
    if (responsesToRevert.length > 5) {
      console.log(`   ... and ${responsesToRevert.length - 5} more\n`);
    } else {
      console.log();
    }

    // Show excluded responses
    if (excludedResponses.length > 0) {
      console.log('📋 Responses that will remain Rejected (excluded):');
      excludedResponses.forEach((resp, idx) => {
        console.log(`   ${idx + 1}. Response ID: ${resp.responseId || resp._id}`);
      });
      console.log();
    }

    // Confirm before proceeding
    console.log('⚠️  WARNING: This will revert responses from "Rejected" to "Pending_Approval"');
    console.log(`   Total responses to revert: ${responsesToRevert.length}`);
    console.log(`   Responses to keep as Rejected: ${excludedResponses.length}`);
    console.log('\n⏳ Proceeding with reversion in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Revert each response
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log('🚀 Starting reversion process...\n');

    for (let i = 0; i < responsesToRevert.length; i++) {
      const response = responsesToRevert[i];
      try {
        const updateData = {
          $set: {
            status: 'Pending_Approval',
            updatedAt: new Date()
          },
          $unset: { 
            reviewAssignment: '',
            'verificationData.reviewer': '',
            'verificationData.reviewedAt': ''
          }
        };

        // Note: We keep verificationData.criteria and verificationData.feedback for reference
        // but clear reviewer and reviewedAt so they can be QC'd again

        const result = await SurveyResponse.updateOne(
          { _id: response._id },
          updateData
        );

        if (result.modifiedCount === 1) {
          successCount++;
          if ((i + 1) % 10 === 0) {
            console.log(`   ✅ Reverted ${i + 1}/${responsesToRevert.length} responses...`);
          }
        } else {
          errorCount++;
          errors.push({
            responseId: response.responseId || response._id,
            error: 'No document modified (may have been updated by another process)'
          });
        }
      } catch (error) {
        errorCount++;
        errors.push({
          responseId: response.responseId || response._id,
          error: error.message
        });
        console.error(`   ❌ Error reverting response ${response.responseId || response._id}:`, error.message);
      }
    }

    console.log('\n✅ Reversion process completed!\n');

    // Summary
    console.log('📊 Summary:');
    console.log('================================================================================');
    console.log(`✅ Successfully reverted: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📋 Total processed: ${responsesToRevert.length}`);
    console.log(`📋 Kept as Rejected (excluded): ${excludedResponses.length}`);
    console.log('================================================================================\n');

    if (errors.length > 0 && errors.length <= 10) {
      console.log('⚠️  Errors encountered:');
      errors.forEach(err => {
        console.log(`   - ${err.responseId}: ${err.error}`);
      });
      console.log();
    } else if (errors.length > 10) {
      console.log(`⚠️  ${errors.length} errors encountered (showing first 10):`);
      errors.slice(0, 10).forEach(err => {
        console.log(`   - ${err.responseId}: ${err.error}`);
      });
      console.log();
    }

    // Verify the results
    console.log('🔍 Verifying results...');
    const remainingRejected = await SurveyResponse.countDocuments({
      interviewMode: 'cati',
      status: 'Rejected',
      createdAt: {
        $gte: TARGET_DATE,
        $lte: TARGET_DATE_END
      },
      'verificationData.feedback': { $regex: /no audio/i }
    });

    const pendingCount = await SurveyResponse.countDocuments({
      interviewMode: 'cati',
      status: 'Pending_Approval',
      createdAt: {
        $gte: TARGET_DATE,
        $lte: TARGET_DATE_END
      }
    });

    console.log(`   Remaining "No Audio" rejected: ${remainingRejected} (should be ${excludedResponses.length})`);
    console.log(`   Pending_Approval from Dec 13: ${pendingCount}\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error in revertNoAudioRejections:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  revertNoAudioRejections()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { revertNoAudioRejections };
