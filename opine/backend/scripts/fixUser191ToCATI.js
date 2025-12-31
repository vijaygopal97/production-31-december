/**
 * FIX USER 191 TO CATI MODE
 * 
 * This script fixes user with member ID 191:
 * - Updates their details (email, password, phone, name)
 * - Changes interview mode to CATI
 * - Moves them from CAPI to CATI assignment in survey 68fd1915d41841da463f0d46
 * 
 * Usage:
 *   node scripts/fixUser191ToCATI.js
 * 
 * This will process both DEVELOPMENT and PRODUCTION databases
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Database connections
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

// User details
const MEMBER_ID = '191';
const USER_EMAIL = 'cati191@gmail.com';
const USER_PASSWORD = '8670475453';
const USER_PHONE = '8670475453';
const USER_FIRST_NAME = 'Sumit';
const USER_LAST_NAME = 'Kumar Roy';

// Survey ID
const SURVEY_ID = '68fd1915d41841da463f0d46';

// Load models
const UserSchema = require('../models/User').schema;
const SurveySchema = require('../models/Survey').schema;

let devConnection = null;
let prodConnection = null;
let DevUser = null;
let ProdUser = null;
let DevSurvey = null;
let ProdSurvey = null;

/**
 * Connect to both databases
 */
async function connectDatabases() {
  try {
    console.log('🔌 Connecting to DEVELOPMENT database...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    DevUser = devConnection.model('User', UserSchema);
    DevSurvey = devConnection.model('Survey', SurveySchema);
    console.log('✅ Connected to DEVELOPMENT database\n');

    console.log('🔌 Connecting to PRODUCTION database...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    ProdUser = prodConnection.model('User', UserSchema);
    ProdSurvey = prodConnection.model('Survey', SurveySchema);
    console.log('✅ Connected to PRODUCTION database\n');
  } catch (error) {
    console.error('❌ Error connecting to databases:', error);
    throw error;
  }
}

/**
 * Normalize phone number
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
}

/**
 * Update user details and move from CAPI to CATI
 */
async function fixUser191(UserModel, SurveyModel, dbName) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔧 Processing ${dbName.toUpperCase()} Database`);
    console.log(`${'='.repeat(60)}\n`);

    // Find user by memberId
    const user = await UserModel.findOne({ memberId: MEMBER_ID });
    if (!user) {
      console.log(`❌ User with member ID ${MEMBER_ID} not found in ${dbName} database\n`);
      return { updated: false, moved: false };
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email || user.memberId})`);
    console.log(`   Current email: ${user.email || 'N/A'}`);
    console.log(`   Current phone: ${user.phone || 'N/A'}`);
    console.log(`   Current interview mode: ${user.interviewModes || 'N/A'}\n`);

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(USER_PASSWORD, salt);

    // Update user details
    const updateData = {
      firstName: USER_FIRST_NAME,
      lastName: USER_LAST_NAME,
      email: USER_EMAIL.toLowerCase(),
      phone: USER_PHONE,
      password: hashedPassword,
      interviewModes: 'CATI (Telephonic interview)'
    };

    await UserModel.updateOne(
      { _id: user._id },
      { $set: updateData }
    );

    // Verify password
    const updatedUser = await UserModel.findById(user._id).select('+password');
    const passwordValid = await updatedUser.comparePassword(USER_PASSWORD);
    if (!passwordValid) {
      console.log(`⚠️  Password verification failed, retrying...`);
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(USER_PASSWORD, retrySalt);
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { password: retryHashedPassword } }
      );
      const retryUser = await UserModel.findById(user._id).select('+password');
      const retryValid = await retryUser.comparePassword(USER_PASSWORD);
      if (!retryValid) {
        throw new Error(`Password verification failed after retry for member ID ${MEMBER_ID}`);
      }
    }

    console.log(`✅ Updated user details:`);
    console.log(`   Name: ${USER_FIRST_NAME} ${USER_LAST_NAME}`);
    console.log(`   Email: ${USER_EMAIL}`);
    console.log(`   Phone: ${USER_PHONE}`);
    console.log(`   Password: ${USER_PASSWORD}`);
    console.log(`   Interview Mode: CATI (Telephonic interview)\n`);

    // Find survey
    const survey = await SurveyModel.findById(SURVEY_ID);
    if (!survey) {
      console.log(`❌ Survey ${SURVEY_ID} not found in ${dbName} database\n`);
      return { updated: true, moved: false };
    }

    console.log(`✅ Found survey: ${survey.surveyName || SURVEY_ID}\n`);

    const userId = user._id.toString();
    let moved = false;

    // Check if user is in CAPI interviewers
    const capiIndex = survey.capiInterviewers?.findIndex(
      assignment => assignment.interviewer.toString() === userId
    );

    // Check if user is already in CATI interviewers
    const catiIndex = survey.catiInterviewers?.findIndex(
      assignment => assignment.interviewer.toString() === userId
    );

    if (capiIndex !== undefined && capiIndex !== -1) {
      // User is in CAPI - need to move to CATI
      const capiAssignment = survey.capiInterviewers[capiIndex];
      
      console.log(`📍 Found in CAPI interviewers`);
      console.log(`   Status: ${capiAssignment.status}`);
      console.log(`   Assigned ACs: ${(capiAssignment.assignedACs || []).join(', ') || 'None'}`);
      console.log(`   Max Interviews: ${capiAssignment.maxInterviews || 0}`);
      console.log(`   Completed: ${capiAssignment.completedInterviews || 0}`);

      // Remove from CAPI
      survey.capiInterviewers.splice(capiIndex, 1);
      moved = true; // Mark as moved since we're removing from CAPI
      console.log(`   ✅ Removed from CAPI interviewers`);

      // Add to CATI (only if not already there)
      if (catiIndex === undefined || catiIndex === -1) {
        if (!survey.catiInterviewers) {
          survey.catiInterviewers = [];
        }

        // Preserve assignment data
        survey.catiInterviewers.push({
          interviewer: user._id,
          assignedBy: capiAssignment.assignedBy || user._id,
          assignedAt: capiAssignment.assignedAt || new Date(),
          assignedACs: capiAssignment.assignedACs || [],
          selectedState: capiAssignment.selectedState || '',
          selectedCountry: capiAssignment.selectedCountry || '',
          status: capiAssignment.status || 'assigned',
          maxInterviews: capiAssignment.maxInterviews || 0,
          completedInterviews: capiAssignment.completedInterviews || 0
        });
        console.log(`   ✅ Added to CATI interviewers (preserved assignment data)\n`);
      } else {
        console.log(`   ⚠️  Already in CATI interviewers, skipping addition\n`);
      }
    } else if (catiIndex !== undefined && catiIndex !== -1) {
      console.log(`✅ Already in CATI interviewers (correct assignment)\n`);
    } else {
      console.log(`⚠️  Not found in either CAPI or CATI assignments\n`);
    }

    // Save survey if changes were made (removed from CAPI)
    if (moved) {
      await survey.save();
      console.log(`✅ Survey saved with user removed from CAPI assignment\n`);
    }

    return { updated: true, moved: moved };

  } catch (error) {
    console.error(`❌ Error processing ${dbName}:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting User 191 CATI Fix\n');
    console.log(`📋 User Details:`);
    console.log(`   Member ID: ${MEMBER_ID}`);
    console.log(`   Name: ${USER_FIRST_NAME} ${USER_LAST_NAME}`);
    console.log(`   Email: ${USER_EMAIL}`);
    console.log(`   Phone: ${USER_PHONE}`);
    console.log(`   Password: ${USER_PASSWORD}`);
    console.log(`   Interview Mode: CATI (Telephonic interview)\n`);
    console.log(`📋 Survey ID: ${SURVEY_ID}\n`);
    console.log(`⚠️  This will process both DEVELOPMENT and PRODUCTION databases\n`);

    // Connect to databases
    await connectDatabases();

    // Process development database
    const devResults = await fixUser191(DevUser, DevSurvey, 'development');

    // Process production database
    const prodResults = await fixUser191(ProdUser, ProdSurvey, 'production');

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log('\nDEVELOPMENT:');
    console.log(`   ✅ User Updated: ${devResults.updated ? 'Yes' : 'No'}`);
    console.log(`   🔄 Moved to CATI: ${devResults.moved ? 'Yes' : 'No'}`);
    console.log('\nPRODUCTION:');
    console.log(`   ✅ User Updated: ${prodResults.updated ? 'Yes' : 'No'}`);
    console.log(`   🔄 Moved to CATI: ${prodResults.moved ? 'Yes' : 'No'}`);
    console.log(`\n✅ Process completed!\n`);

    // Close connections
    await devConnection.close();
    await prodConnection.close();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    
    if (devConnection) await devConnection.close();
    if (prodConnection) await prodConnection.close();
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, fixUser191 };






