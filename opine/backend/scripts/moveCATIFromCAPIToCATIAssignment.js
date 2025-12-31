/**
 * MOVE CATI INTERVIEWERS FROM CAPI TO CATI ASSIGNMENT
 * 
 * This script moves CATI interviewers from CAPI assignment to CATI assignment
 * in a specific survey. These users were incorrectly assigned as CAPI interviewers
 * but should be CATI interviewers.
 * 
 * Survey ID: 68fd1915d41841da463f0d46
 * CSV File: /var/www/CATI Caller list (1).csv
 * 
 * Usage:
 *   node scripts/moveCATIFromCAPIToCATIAssignment.js
 * 
 * This will process both DEVELOPMENT and PRODUCTION databases
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Survey ID
const SURVEY_ID = '68fd1915d41841da463f0d46';

// CSV file path
const CSV_FILE_PATH = '/var/www/CATI Caller list (1).csv';

// Database connections
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

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
 * Read CATI caller list from CSV
 */
function readCATICallerList() {
  return new Promise((resolve, reject) => {
    const callers = [];
    
    if (!fs.existsSync(CSV_FILE_PATH)) {
      reject(new Error(`CSV file not found: ${CSV_FILE_PATH}`));
      return;
    }

    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => {
        const memberId = row.teleform_user_id?.trim();
        if (memberId) {
          callers.push({
            memberId: memberId,
            name: row.name?.trim() || '',
            mobileNumber: row.mobile_number?.trim() || ''
          });
        }
      })
      .on('end', () => {
        console.log(`📋 Read ${callers.length} CATI callers from CSV\n`);
        resolve(callers);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Move CATI interviewers from CAPI to CATI assignment in a database
 */
async function moveInterviewers(SurveyModel, UserModel, dbName) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Processing ${dbName.toUpperCase()} Database`);
    console.log(`${'='.repeat(60)}\n`);

    // Read CSV
    const callers = await readCATICallerList();
    const memberIds = callers.map(c => c.memberId);

    console.log(`📋 Looking for ${memberIds.length} CATI interviewers by memberId...\n`);

    // Find users by memberId
    const users = await UserModel.find({ memberId: { $in: memberIds } });
    console.log(`✅ Found ${users.length} users in database\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found. Skipping...\n');
      return { moved: 0, removed: 0, added: 0 };
    }

    // Find survey
    const survey = await SurveyModel.findById(SURVEY_ID);
    if (!survey) {
      console.log(`❌ Survey ${SURVEY_ID} not found in ${dbName} database\n`);
      return { moved: 0, removed: 0, added: 0 };
    }

    console.log(`✅ Found survey: ${survey.surveyName || SURVEY_ID}\n`);

    const userIds = users.map(u => u._id.toString());
    let movedCount = 0;
    let removedCount = 0;
    let addedCount = 0;

    // Process each user
    for (const user of users) {
      const userId = user._id.toString();
      const memberId = user.memberId;
      const userName = `${user.firstName} ${user.lastName}`;

      console.log(`\n👤 Processing: ${userName} (Member ID: ${memberId})`);

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
        
        console.log(`   📍 Found in CAPI interviewers`);
        console.log(`      Status: ${capiAssignment.status}`);
        console.log(`      Assigned ACs: ${(capiAssignment.assignedACs || []).join(', ') || 'None'}`);
        console.log(`      Max Interviews: ${capiAssignment.maxInterviews || 0}`);
        console.log(`      Completed: ${capiAssignment.completedInterviews || 0}`);

        // Remove from CAPI
        survey.capiInterviewers.splice(capiIndex, 1);
        removedCount++;
        console.log(`   ✅ Removed from CAPI interviewers`);

        // Add to CATI (only if not already there)
        if (catiIndex === undefined || catiIndex === -1) {
          if (!survey.catiInterviewers) {
            survey.catiInterviewers = [];
          }

          // Preserve assignment data
          survey.catiInterviewers.push({
            interviewer: user._id,
            assignedBy: capiAssignment.assignedBy || user._id, // Preserve or use user as fallback
            assignedAt: capiAssignment.assignedAt || new Date(),
            assignedACs: capiAssignment.assignedACs || [],
            selectedState: capiAssignment.selectedState || '',
            selectedCountry: capiAssignment.selectedCountry || '',
            status: capiAssignment.status || 'assigned',
            maxInterviews: capiAssignment.maxInterviews || 0,
            completedInterviews: capiAssignment.completedInterviews || 0
          });
          addedCount++;
          movedCount++;
          console.log(`   ✅ Added to CATI interviewers (preserved assignment data)`);
        } else {
          console.log(`   ⚠️  Already in CATI interviewers, skipping addition`);
        }
      } else if (catiIndex !== undefined && catiIndex !== -1) {
        console.log(`   ✅ Already in CATI interviewers (correct assignment)`);
      } else {
        console.log(`   ⚠️  Not found in either CAPI or CATI assignments`);
      }
    }

    // Save survey if changes were made
    if (movedCount > 0) {
      await survey.save();
      console.log(`\n✅ Survey saved with ${movedCount} interviewer(s) moved from CAPI to CATI\n`);
    } else {
      console.log(`\n⚠️  No changes needed - all interviewers are correctly assigned\n`);
    }

    return { moved: movedCount, removed: removedCount, added: addedCount };

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
    console.log('🚀 Starting CATI Interviewer Assignment Fix\n');
    console.log(`📋 Survey ID: ${SURVEY_ID}`);
    console.log(`📄 CSV File: ${CSV_FILE_PATH}`);
    console.log(`\n⚠️  This will:`);
    console.log(`   1. Find CATI interviewers from CSV`);
    console.log(`   2. Remove them from CAPI interviewers in survey`);
    console.log(`   3. Add them to CATI interviewers (preserving assignment data)`);
    console.log(`   4. Process both DEVELOPMENT and PRODUCTION databases\n`);

    // Connect to databases
    await connectDatabases();

    // Process development database
    const devResults = await moveInterviewers(DevSurvey, DevUser, 'development');

    // Process production database
    const prodResults = await moveInterviewers(ProdSurvey, ProdUser, 'production');

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log('\nDEVELOPMENT:');
    console.log(`   🔄 Moved: ${devResults.moved}`);
    console.log(`   ➖ Removed from CAPI: ${devResults.removed}`);
    console.log(`   ➕ Added to CATI: ${devResults.added}`);
    console.log('\nPRODUCTION:');
    console.log(`   🔄 Moved: ${prodResults.moved}`);
    console.log(`   ➖ Removed from CAPI: ${prodResults.removed}`);
    console.log(`   ➕ Added to CATI: ${prodResults.added}`);
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

module.exports = { main, moveInterviewers, readCATICallerList };







