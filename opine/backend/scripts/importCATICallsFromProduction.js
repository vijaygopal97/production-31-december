/**
 * Import Survey Calls from Production to Development Database
 * 
 * IMPORTANT: This script is READ-ONLY on production database
 * - Only READS data from production (no writes, updates, or deletes)
 * - Only WRITES to development database
 * 
 * This script:
 * 1. Connects to production database (READ-ONLY operations only)
 * 2. Fetches all CATI calls (or for a specific survey)
 * 3. Connects to development database
 * 4. Imports calls, handling duplicates and preserving relationships
 * 
 * SAFETY FEATURES:
 * - No delete operations anywhere
 * - No update operations on production
 * - Only uses find(), countDocuments() on production (read-only)
 * - Only uses create() on development (write only to dev)
 */

const mongoose = require('mongoose');
const CatiCall = require('../models/CatiCall');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Configuration
// Production MongoDB URI - must be accessible from development server
// IMPORTANT: This script is READ-ONLY on production (no deletes, updates, or modifications)
const PRODUCTION_MONGO_URI = process.env.PRODUCTION_MONGO_URI || 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const DEV_MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://opine_user:OpineApp2024Secure@localhost:27017/Opine?authSource=Opine';

// Optional: Filter by specific survey ID (set to null to import all)
const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46'; // Set to null to import all surveys

const importCATICalls = async () => {
  let prodConnection = null;
  let devConnection = null;

  try {
    console.log('🚀 Starting CATI Calls import process...\n');
    console.log('⚠️  SAFETY CHECK: This script is READ-ONLY on production database');
    console.log('   - Production: READ operations only (find, countDocuments)');
    console.log('   - Development: WRITE operations only (create)\n');

    // Step 1: Connect to production database (READ-ONLY)
    console.log('📡 Step 1: Connecting to PRODUCTION database (READ-ONLY)...');
    console.log(`   URI: ${PRODUCTION_MONGO_URI.replace(/\/\/.*@/, '//***@')}`);
    console.log('   ⚠️  Only READ operations will be performed on production\n');
    
    prodConnection = await mongoose.createConnection(PRODUCTION_MONGO_URI);
    const ProdCatiCall = prodConnection.model('CatiCall', CatiCall.schema);
    
    console.log('✅ Connected to PRODUCTION database (READ-ONLY mode)\n');

    // Step 2: Connect to development database
    console.log('📡 Step 2: Connecting to DEVELOPMENT database...');
    console.log(`   URI: ${DEV_MONGO_URI.replace(/\/\/.*@/, '//***@')}`);
    
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    const DevCatiCall = devConnection.model('CatiCall', CatiCall.schema);
    
    console.log('✅ Connected to DEVELOPMENT database\n');

    // Step 3: Count calls in production (READ-ONLY operation)
    console.log('📋 Step 3: Counting CATI calls in production (READ-ONLY)...');
    const totalCount = await ProdCatiCall.countDocuments({});
    console.log(`📊 Total CATI calls in production: ${totalCount} (no data modified)\n`);

    if (totalCount === 0) {
      console.log('⚠️  No calls found in production. Exiting.');
      return;
    }

    // Step 5: Fetch calls in batches
    const BATCH_SIZE = 100;
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log(`📦 Step 4: Importing calls in batches of ${BATCH_SIZE}...\n`);

    for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
      console.log(`   Processing batch ${Math.floor(skip / BATCH_SIZE) + 1}/${Math.ceil(totalCount / BATCH_SIZE)} (${skip + 1}-${Math.min(skip + BATCH_SIZE, totalCount)} of ${totalCount})...`);

      // Fetch batch from production (READ-ONLY - no data modified)
      const prodCalls = await ProdCatiCall.find(query)
        .populate('survey', '_id')
        .populate('interviewer', '_id memberId')
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean(); // Using lean() ensures no modifications to production data

      // Process each call
      for (const prodCall of prodCalls) {
        try {
          // Check if call already exists in dev (by callId or _id)
          const existingCall = await DevCatiCall.findOne({
            $or: [
              { callId: prodCall.callId },
              { _id: prodCall._id },
              { sessionId: prodCall.sessionId }
            ]
          }).lean();

          if (existingCall) {
            skippedCount++;
            continue; // Skip duplicates
          }

          // Check if survey exists in dev
          const surveyId = prodCall.survey?._id || prodCall.survey;
          const devSurvey = await DevSurvey.findOne({ _id: surveyId }).lean();
          
          if (!devSurvey) {
            console.log(`   ⚠️  Survey ${surveyId} not found in dev, skipping call ${prodCall.callId || prodCall._id}`);
            skippedCount++;
            continue;
          }

          // Check if interviewer exists in dev (by memberId or _id)
          const interviewerId = prodCall.interviewer?._id || prodCall.interviewer;
          let devInterviewer = null;
          
          if (interviewerId) {
            // Try to find by _id first
            devInterviewer = await DevUser.findOne({ _id: interviewerId }).lean();
            
            // If not found, try to find by memberId
            if (!devInterviewer && prodCall.interviewer?.memberId) {
              devInterviewer = await DevUser.findOne({ memberId: prodCall.interviewer.memberId }).lean();
            }
          }

          // Prepare call data for import
          const callData = {
            ...prodCall,
            survey: surveyId,
            interviewer: devInterviewer?._id || interviewerId, // Use dev interviewer ID if found, otherwise original
            _id: prodCall._id, // Preserve original _id
            createdAt: prodCall.createdAt,
            updatedAt: prodCall.updatedAt
          };

          // Remove populated fields that shouldn't be in the document (local copy only, not affecting production)
          delete callData.__v; // Remove version key if present (local copy only)

          // Clean up empty string enum values in verificationData (convert '' to undefined/null)
          if (callData.verificationData) {
            // Clean criteria object
            if (callData.verificationData.criteria) {
              const criteriaFields = ['genderMatching', 'upcomingElectionsMatching', 'previousElectionsMatching', 
                                     'previousLoksabhaElectionsMatching', 'nameMatching', 'ageMatching', 'phoneNumberAsked'];
              criteriaFields.forEach(field => {
                if (callData.verificationData.criteria[field] === '') {
                  delete callData.verificationData.criteria[field];
                }
              });
            }
            // Clean top-level verificationData fields
            const verificationFields = ['genderMatching', 'upcomingElectionsMatching', 'previousElectionsMatching', 
                                      'previousLoksabhaElectionsMatching', 'nameMatching', 'ageMatching', 'phoneNumberAsked'];
            verificationFields.forEach(field => {
              if (callData.verificationData[field] === '') {
                delete callData.verificationData[field];
              }
            });
          }

          // Import call (WRITE to dev only)
          // Use runValidators: false to skip validation for edge cases (empty strings in enums)
          await DevCatiCall.create([callData], { runValidators: false });
          importedCount++;

        } catch (error) {
          errorCount++;
          const errorInfo = {
            callId: prodCall.callId || prodCall._id,
            error: error.message
          };
          errors.push(errorInfo);
          console.error(`   ❌ Error importing call ${errorInfo.callId}:`, error.message);
        }
      }

      // Progress update
      if ((skip + BATCH_SIZE) % 500 === 0 || skip + BATCH_SIZE >= totalCount) {
        console.log(`   ✅ Progress: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors\n`);
      }
    }

    // Step 6: Summary
    console.log('\n✅ Import process completed!\n');
    console.log('📊 Summary:');
    console.log('================================================================================');
    console.log(`   Total calls in production: ${totalCount}`);
    console.log(`   ✅ Successfully imported: ${importedCount}`);
    console.log(`   ⏭️  Skipped (duplicates/missing refs): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('================================================================================\n');
    console.log('✅ PRODUCTION DATABASE WAS NOT MODIFIED (read-only operations only)\n');

    if (errors.length > 0 && errors.length <= 20) {
      console.log('⚠️  Errors encountered:');
      errors.forEach(err => {
        console.log(`   - ${err.callId}: ${err.error}`);
      });
      console.log();
    } else if (errors.length > 20) {
      console.log(`⚠️  ${errors.length} errors encountered (showing first 20):`);
      errors.slice(0, 20).forEach(err => {
        console.log(`   - ${err.callId}: ${err.error}`);
      });
      console.log();
    }

    // Step 7: Verify import
    console.log('🔍 Verifying import...');
    const devCount = await DevCatiCall.countDocuments(TARGET_SURVEY_ID ? { survey: TARGET_SURVEY_ID } : {});
    console.log(`   Calls in development database: ${devCount}`);
    console.log();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    // Close connections
    if (prodConnection) {
      await prodConnection.close();
      console.log('✅ Closed production database connection');
    }
    if (devConnection) {
      await devConnection.close();
      console.log('✅ Closed development database connection');
    }
  }
};

// Run the script
if (require.main === module) {
  // Safety confirmation
  console.log('⚠️  IMPORTANT SAFETY REMINDER:');
  console.log('   - This script is READ-ONLY on production database');
  console.log('   - NO data will be deleted, modified, or updated in production');
  console.log('   - Only READ operations (find, countDocuments) on production');
  console.log('   - Only WRITE operations (create) on development database');
  console.log('   - Production data remains completely untouched\n');

  // Check if PRODUCTION_MONGO_URI is set
  if (!process.env.PRODUCTION_MONGO_URI && !PRODUCTION_MONGO_URI.includes('13.202.181.167')) {
    console.error('❌ ERROR: PRODUCTION_MONGO_URI not configured!');
    console.error('   Please set it in your .env file or export it before running this script.');
    console.error('   Example: PRODUCTION_MONGO_URI="mongodb://user:pass@host:27017/Opine?authSource=admin"');
    process.exit(1);
  }

  // Wait 3 seconds for user to read safety message
  console.log('⏳ Starting in 3 seconds... (Press Ctrl+C to cancel)\n');
  
  (async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    importCATICalls()
      .then(() => {
        console.log('✅ Script completed successfully');
        console.log('✅ Production database was NOT modified (read-only operations only)');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Script failed:', error);
        console.error('✅ Production database was NOT modified (read-only operations only)');
        process.exit(1);
      });
  })();
}

module.exports = { importCATICalls };
