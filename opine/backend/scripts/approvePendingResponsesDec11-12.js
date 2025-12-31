/**
 * Approve Pending_Approval and Rejected Survey Responses from Dec 11-12, 2025
 * 
 * This script:
 * 1. Finds all SurveyResponse objects created on Dec 11-12, 2025 with status 'Pending_Approval' or 'Rejected'
 * 2. Approves them using the same approval method as user '68fe8b6239b5a3a70225b17b'
 * 3. Only affects responses in 'Pending_Approval' or 'Rejected' status (skips already approved)
 * 
 * IMPORTANT: This script runs on PRODUCTION database only
 */

const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Configuration
const REFERENCE_REVIEWER_IDS = [
  '68fe8b6239b5a3a70225b17b', // Primary reference user
  '6933f9885f41617a76fd50af'  // Alternative reference user
];
const APPROVER_ID = '68fe8b6239b5a3a70225b17b'; // User ID to use for approval
const TARGET_DATES = [
  new Date('2025-12-11T00:00:00.000Z'), // Dec 11, 2025 start
  new Date('2025-12-12T23:59:59.999Z')  // Dec 12, 2025 end
];

// First, let's find an example of how the reference users approved responses
const findExampleApproval = async () => {
  try {
    console.log('🔍 Finding example approval by reference users...\n');
    
    // Try to find approval by primary reference user first
    let exampleResponse = await SurveyResponse.findOne({
      'verificationData.reviewer': new mongoose.Types.ObjectId(REFERENCE_REVIEWER_IDS[0]),
      status: 'Approved'
    })
    .sort({ 'verificationData.reviewedAt': -1 })
    .limit(1)
    .lean();

    // If not found, try the alternative reference user
    if (!exampleResponse || !exampleResponse.verificationData) {
      console.log(`   Trying alternative reference user: ${REFERENCE_REVIEWER_IDS[1]}...`);
      exampleResponse = await SurveyResponse.findOne({
        'verificationData.reviewer': new mongoose.Types.ObjectId(REFERENCE_REVIEWER_IDS[1]),
        status: 'Approved'
      })
      .sort({ 'verificationData.reviewedAt': -1 })
      .limit(1)
      .lean();
    }

    if (!exampleResponse || !exampleResponse.verificationData) {
      console.log('⚠️  No example approval found. Using default verification criteria.\n');
      return null;
    }

    console.log('✅ Found example approval:');
    console.log(`   Response ID: ${exampleResponse.responseId || exampleResponse._id}`);
    console.log(`   Reviewer: ${exampleResponse.verificationData.reviewer}`);
    console.log(`   Reviewed At: ${exampleResponse.verificationData.reviewedAt}`);
    console.log(`   Criteria:`, JSON.stringify(exampleResponse.verificationData.criteria, null, 2));
    console.log(`   Feedback: ${exampleResponse.verificationData.feedback || 'N/A'}\n`);

    return exampleResponse.verificationData;
  } catch (error) {
    console.error('❌ Error finding example approval:', error);
    return null;
  }
};

// Get default verification criteria (typical approval values)
const getDefaultVerificationCriteria = () => {
  return {
    audioStatus: '1', // Survey conversation can be heard
    genderMatching: '1', // Matching
    upcomingElectionsMatching: '1', // Matching
    previousElectionsMatching: '1', // Matching
    previousLoksabhaElectionsMatching: '1', // Matching
    nameMatching: '1', // Matching
    ageMatching: '1', // Matching
    phoneNumberAsked: '1' // Yes
  };
};

// Main function to approve pending responses
const approvePendingResponses = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find example approval to replicate the pattern
    const exampleVerificationData = await findExampleApproval();
    
    // Use example criteria if available, otherwise use defaults
    let verificationCriteria;
    if (exampleVerificationData && exampleVerificationData.criteria) {
      verificationCriteria = exampleVerificationData.criteria;
      console.log('📋 Using verification criteria from example approval\n');
    } else {
      verificationCriteria = getDefaultVerificationCriteria();
      console.log('📋 Using default verification criteria\n');
    }

    // Find all pending and rejected responses from Dec 11-12, 2025
    console.log('🔍 Finding pending and rejected responses from Dec 11-12, 2025...');
    console.log(`   Date range: ${TARGET_DATES[0].toISOString()} to ${TARGET_DATES[1].toISOString()}\n`);

    const targetResponses = await SurveyResponse.find({
      status: { $in: ['Pending_Approval', 'Rejected'] },
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    })
    .select('_id responseId sessionId status createdAt survey interviewer')
    .lean();

    // Separate by status
    const pendingResponses = targetResponses.filter(r => r.status === 'Pending_Approval');
    const rejectedResponses = targetResponses.filter(r => r.status === 'Rejected');

    console.log(`📊 Found ${targetResponses.length} responses to approve from Dec 11-12, 2025:`);
    console.log(`   - Pending_Approval: ${pendingResponses.length}`);
    console.log(`   - Rejected: ${rejectedResponses.length}\n`);

    if (targetResponses.length === 0) {
      console.log('✅ No pending or rejected responses to approve. Exiting.\n');
      await mongoose.disconnect();
      return;
    }

    // Show sample of responses to be approved
    console.log('📋 Sample of responses to be approved (first 5):');
    targetResponses.slice(0, 5).forEach((resp, idx) => {
      console.log(`   ${idx + 1}. Response ID: ${resp.responseId || resp._id}, Status: ${resp.status}, Created: ${resp.createdAt}`);
    });
    if (targetResponses.length > 5) {
      console.log(`   ... and ${targetResponses.length - 5} more\n`);
    } else {
      console.log();
    }

    // Confirm before proceeding
    console.log('⚠️  WARNING: This will approve all pending and rejected responses from Dec 11-12, 2025');
    console.log(`   Total responses to approve: ${targetResponses.length}`);
    console.log(`   - Pending_Approval: ${pendingResponses.length}`);
    console.log(`   - Rejected: ${rejectedResponses.length}`);
    console.log(`   Approver ID: ${APPROVER_ID}`);
    console.log('\n⏳ Proceeding with approval in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Approve each response
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log('🚀 Starting approval process...\n');

    for (let i = 0; i < targetResponses.length; i++) {
      const response = targetResponses[i];
      try {
        const updateData = {
          $set: {
            status: 'Approved',
            verificationData: {
              reviewer: new mongoose.Types.ObjectId(APPROVER_ID),
              reviewedAt: new Date(),
              criteria: verificationCriteria,
              feedback: '',
              // Copy criteria fields to top level for backward compatibility
              audioStatus: verificationCriteria.audioStatus,
              genderMatching: verificationCriteria.genderMatching,
              upcomingElectionsMatching: verificationCriteria.upcomingElectionsMatching,
              previousElectionsMatching: verificationCriteria.previousElectionsMatching,
              previousLoksabhaElectionsMatching: verificationCriteria.previousLoksabhaElectionsMatching,
              nameMatching: verificationCriteria.nameMatching,
              ageMatching: verificationCriteria.ageMatching,
              phoneNumberAsked: verificationCriteria.phoneNumberAsked
            },
            updatedAt: new Date()
          },
          $unset: { reviewAssignment: '' } // Clear assignment
        };

        const result = await SurveyResponse.updateOne(
          { _id: response._id },
          updateData
        );

        if (result.modifiedCount === 1) {
          successCount++;
          if ((i + 1) % 100 === 0) {
            console.log(`   ✅ Approved ${i + 1}/${targetResponses.length} responses...`);
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
        console.error(`   ❌ Error approving response ${response.responseId || response._id}:`, error.message);
      }
    }

    console.log('\n✅ Approval process completed!\n');

    // Summary
    console.log('📊 Summary:');
    console.log('================================================================================');
    console.log(`✅ Successfully approved: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📋 Total processed: ${targetResponses.length}`);
    console.log(`   - Pending_Approval: ${pendingResponses.length}`);
    console.log(`   - Rejected: ${rejectedResponses.length}`);
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
    const remainingPending = await SurveyResponse.countDocuments({
      status: 'Pending_Approval',
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    });

    const remainingRejected = await SurveyResponse.countDocuments({
      status: 'Rejected',
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    });

    const approvedCount = await SurveyResponse.countDocuments({
      status: 'Approved',
      'verificationData.reviewer': new mongoose.Types.ObjectId(APPROVER_ID),
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    });

    console.log(`   Remaining pending: ${remainingPending}`);
    console.log(`   Remaining rejected: ${remainingRejected}`);
    console.log(`   Approved by ${APPROVER_ID}: ${approvedCount}\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error in approvePendingResponses:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  approvePendingResponses()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { approvePendingResponses };
