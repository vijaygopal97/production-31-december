/**
 * Migration Script: Update existing CATI SurveyResponses with District, State, PC from AC
 * 
 * This script:
 * 1. Finds all CATI SurveyResponses that have selectedAC but missing district/state/PC in selectedPollingStation
 * 2. Uses assemblyConstituencies.json to derive district, state, PC from AC name
 * 3. Updates selectedPollingStation with the derived fields
 * 
 * Usage: node backend/scripts/updateCatiResponsesWithACDetails.js
 */

const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Try multiple paths for .env file
const possibleEnvPaths = [
  path.join(__dirname, '../.env'), // backend/.env
  path.join(__dirname, '../../.env'), // root/.env
  path.join(__dirname, '../../../.env'),
  path.join(process.cwd(), '.env')
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded .env from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('⚠️  No .env file found, using environment variables from system');
}

const mongoose = require('mongoose');
const { getAllACDetails } = require('../utils/acDataHelper');

// Import models
const SurveyResponse = require('../models/SurveyResponse');

const updateCatiResponses = async () => {
  try {
    // Connect to MongoDB - try to get from environment or use the same connection method as server.js
    let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    // If not found, try to read from PM2 environment or check common locations
    if (!mongoUri) {
      // Try to get from the running backend process environment
      // For now, we'll require it to be set
      console.error('❌ MONGODB_URI not found in environment variables');
      console.error('💡 Please set MONGODB_URI environment variable or run:');
      console.error('   export MONGODB_URI="your_mongodb_connection_string"');
      console.error('   node backend/scripts/updateCatiResponsesWithACDetails.js');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to MongoDB...');
    console.log(`📝 Using MongoDB URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials in log
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all CATI responses that have selectedAC but missing district/state/PC
    const catiResponses = await SurveyResponse.find({
      interviewMode: 'cati',
      selectedAC: { $exists: true, $ne: null, $ne: '' }
    }).select('_id selectedAC selectedPollingStation interviewMode');

    console.log(`\n📊 Found ${catiResponses.length} CATI responses with selectedAC`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const response of catiResponses) {
      try {
        const acName = response.selectedAC;
        if (!acName || acName === 'N/A' || acName.trim() === '') {
          skippedCount++;
          continue;
        }

        // Get AC details
        const acDetails = getAllACDetails(acName);
        
        if (!acDetails || (!acDetails.district && !acDetails.state && !acDetails.pcName)) {
          console.log(`⚠️  No AC details found for: ${acName} (Response ID: ${response._id})`);
          skippedCount++;
          continue;
        }

        // Always update state to "West Bengal" for all CATI responses
        // Prepare updated selectedPollingStation
        const updatedPollingStation = {
          ...(response.selectedPollingStation || {}),
          acName: acName,
          district: response.selectedPollingStation?.district || acDetails.district || null,
          state: 'West Bengal', // All ACs in this survey belong to West Bengal - FORCE UPDATE
          pcName: response.selectedPollingStation?.pcName || acDetails.pcName || null
        };

        // Check if state needs to be updated (force update if not "West Bengal")
        const stateNeedsUpdate = updatedPollingStation.state !== 'West Bengal';
        const otherFieldsNeedUpdate = 
          !updatedPollingStation.district ||
          !updatedPollingStation.pcName ||
          !updatedPollingStation.acName;

        // Always update if state is not "West Bengal" or other fields are missing
        if (!stateNeedsUpdate && !otherFieldsNeedUpdate) {
          skippedCount++;
          continue;
        }

        // Update the response
        await SurveyResponse.updateOne(
          { _id: response._id },
          { $set: { selectedPollingStation: updatedPollingStation } }
        );

        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          console.log(`✅ Updated ${updatedCount} responses...`);
        }
      } catch (error) {
        console.error(`❌ Error updating response ${response._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${catiResponses.length}`);

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run migration
if (require.main === module) {
  updateCatiResponses();
}

module.exports = { updateCatiResponses };

