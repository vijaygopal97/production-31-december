/**
 * Verify approvals of Survey Responses from Dec 11-12, 2025
 */

const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const APPROVER_ID = '68fe8b6239b5a3a70225b17b';
const TARGET_DATES = [
  new Date('2025-12-11T00:00:00.000Z'),
  new Date('2025-12-12T23:59:59.999Z')
];

const verifyApprovals = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Count pending responses
    const pendingCount = await SurveyResponse.countDocuments({
      status: 'Pending_Approval',
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    });

    // Count rejected responses
    const rejectedCount = await SurveyResponse.countDocuments({
      status: 'Rejected',
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    });

    // Count approved responses by our approver
    const approvedCount = await SurveyResponse.countDocuments({
      status: 'Approved',
      'verificationData.reviewer': new mongoose.Types.ObjectId(APPROVER_ID),
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    });

    // Get sample approved responses
    const sampleApproved = await SurveyResponse.find({
      status: 'Approved',
      'verificationData.reviewer': new mongoose.Types.ObjectId(APPROVER_ID),
      createdAt: {
        $gte: TARGET_DATES[0],
        $lte: TARGET_DATES[1]
      }
    })
    .select('responseId status createdAt verificationData.reviewer verificationData.reviewedAt')
    .limit(5)
    .lean();

    console.log('📊 Verification Results:');
    console.log('================================================================================');
    console.log(`   Pending responses (Dec 11-12, 2025): ${pendingCount}`);
    console.log(`   Rejected responses (Dec 11-12, 2025): ${rejectedCount}`);
    console.log(`   Approved by ${APPROVER_ID}: ${approvedCount}`);
    console.log('================================================================================\n');

    if (sampleApproved.length > 0) {
      console.log('📋 Sample approved responses:');
      sampleApproved.forEach((resp, idx) => {
        console.log(`   ${idx + 1}. Response ID: ${resp.responseId || resp._id}`);
        console.log(`      Created: ${resp.createdAt}`);
        console.log(`      Reviewed At: ${resp.verificationData?.reviewedAt || 'N/A'}`);
        console.log();
      });
    }

    await mongoose.disconnect();
    console.log('✅ Verification complete\n');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

if (require.main === module) {
  verifyApprovals();
}

module.exports = { verifyApprovals };
