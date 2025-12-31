/**
 * Force Update Script: Set State to "West Bengal" for all CATI SurveyResponses
 * 
 * This script forces an update of the state field to "West Bengal" for all CATI responses
 * regardless of current value.
 */

const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load .env file from backend directory
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded .env from: ${envPath}`);
} else {
  console.log('⚠️  No .env file found, using environment variables from system');
}

const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');

const forceUpdateState = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI must be set in environment variables');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    console.log(`📝 Using MongoDB URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all CATI responses
    const catiResponses = await SurveyResponse.find({
      interviewMode: 'cati',
      selectedAC: { $exists: true, $ne: null, $ne: '' }
    }).select('_id selectedAC selectedPollingStation interviewMode');

    console.log(`\n📊 Found ${catiResponses.length} CATI responses with selectedAC`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const response of catiResponses) {
      try {
        const acName = response.selectedAC;
        if (!acName || acName === 'N/A' || acName.trim() === '') {
          continue;
        }

        // Get current polling station or create new one
        const currentPollingStation = response.selectedPollingStation || {};
        
        // Force update state to "West Bengal"
        const updatedPollingStation = {
          ...currentPollingStation,
          acName: acName,
          state: 'West Bengal' // Force set to West Bengal
        };

        // Update the response
        await SurveyResponse.updateOne(
          { _id: response._id },
          { $set: { selectedPollingStation: updatedPollingStation } }
        );

        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          console.log(`✅ Updated ${updatedCount} responses...`);
        }
      } catch (error) {
        console.error(`❌ Error updating response ${response._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${catiResponses.length}`);

    console.log('\n✅ Force update completed successfully!');

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
  forceUpdateState();
}

module.exports = { forceUpdateState };

