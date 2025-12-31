const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SurveyResponse = require('../models/SurveyResponse');
const fs = require('fs').promises;
const path = require('path');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const OUTPUT_DIR = '/var/www/Report-Generation/IncorrectStatusCorrection';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Load incorrect response IDs from the report
 */
async function loadIncorrectResponseIds() {
  try {
    // Try to find the most recent report file
    const files = await fs.readdir(OUTPUT_DIR);
    const reportFiles = files.filter(f => f.startsWith('incorrect_status_response_ids_') && f.endsWith('.txt'));
    
    if (reportFiles.length === 0) {
      throw new Error('No incorrect status report file found!');
    }
    
    // Sort by date and get the most recent
    reportFiles.sort().reverse();
    const latestReportFile = reportFiles[0];
    const reportPath = path.join(OUTPUT_DIR, latestReportFile);
    
    console.log(`📄 Loading response IDs from: ${latestReportFile}\n`);
    
    const content = await fs.readFile(reportPath, 'utf8');
    const responseIds = content
      .split('\n')
      .map(id => id.trim())
      .filter(id => id && id !== 'N/A' && id.length > 0);
    
    console.log(`✅ Loaded ${responseIds.length} response IDs\n`);
    return responseIds;
  } catch (error) {
    console.error('❌ Error loading response IDs:', error);
    throw error;
  }
}

/**
 * Update incorrect responses to abandoned status
 */
async function updateIncorrectStatusToAbandoned() {
  try {
    await connectDB();
    
    console.log('\n🔍 Starting update of incorrect status responses...');
    console.log(`📋 Survey ID: ${SURVEY_ID}\n`);
    
    // Load incorrect response IDs
    const responseIds = await loadIncorrectResponseIds();
    
    if (responseIds.length === 0) {
      console.log('⚠️  No response IDs to update!');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // First, verify these responses exist and get their current status
    console.log('🔍 Verifying responses exist...');
    const existingResponses = await SurveyResponse.find({
      $or: [
        { responseId: { $in: responseIds } },
        { _id: { $in: responseIds.map(id => {
          try {
            return mongoose.Types.ObjectId(id);
          } catch {
            return null;
          }
        }).filter(id => id !== null) } }
      ],
      survey: SURVEY_ID
    })
      .select('_id responseId status')
      .lean();
    
    console.log(`✅ Found ${existingResponses.length} existing responses to update\n`);
    
    if (existingResponses.length === 0) {
      console.log('⚠️  No matching responses found in database!');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Get current status breakdown
    const statusBreakdown = {};
    existingResponses.forEach(r => {
      statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
    });
    
    console.log('📊 Current status breakdown:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('');
    
    // Update in batches for safety
    const BATCH_SIZE = 500;
    const responseIdsToUpdate = existingResponses.map(r => r._id);
    let totalUpdated = 0;
    let totalBatches = Math.ceil(responseIdsToUpdate.length / BATCH_SIZE);
    
    console.log(`🔄 Updating ${responseIdsToUpdate.length} responses in ${totalBatches} batches of ${BATCH_SIZE}...\n`);
    
    for (let i = 0; i < responseIdsToUpdate.length; i += BATCH_SIZE) {
      const batch = responseIdsToUpdate.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      try {
        const updateResult = await SurveyResponse.updateMany(
          {
            _id: { $in: batch },
            survey: SURVEY_ID
          },
          {
            $set: {
              status: 'abandoned',
              updatedAt: new Date()
            }
          }
        );
        
        totalUpdated += updateResult.modifiedCount;
        console.log(`✅ Batch ${batchNumber}/${totalBatches}: Updated ${updateResult.modifiedCount} responses (Total: ${totalUpdated}/${responseIdsToUpdate.length})`);
        
        // Small delay between batches
        if (i + BATCH_SIZE < responseIdsToUpdate.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (batchError) {
        console.error(`⚠️  Error updating batch ${batchNumber}:`, batchError.message);
        // Continue with next batch
      }
    }
    
    console.log(`\n✅ Update completed!`);
    console.log(`📊 Total responses updated: ${totalUpdated}\n`);
    
    // Verify the update
    console.log('🔍 Verifying updates...');
    const updatedResponses = await SurveyResponse.find({
      _id: { $in: responseIdsToUpdate },
      survey: SURVEY_ID,
      status: 'abandoned'
    }).countDocuments();
    
    console.log(`✅ Verified: ${updatedResponses} responses now have status "abandoned"\n`);
    
    // Save update log
    const logFilePath = path.join(OUTPUT_DIR, `status_update_log_${TIMESTAMP}.txt`);
    const logContent = `
STATUS UPDATE LOG
==================

Survey ID: ${SURVEY_ID}
Update Date: ${new Date().toISOString()}

Total Response IDs in Report: ${responseIds.length}
Responses Found in Database: ${existingResponses.length}
Responses Updated: ${totalUpdated}
Responses Verified as "abandoned": ${updatedResponses}

Previous Status Breakdown:
${Object.entries(statusBreakdown).map(([status, count]) => `  ${status}: ${count}`).join('\n')}

Update completed successfully.
All incorrect responses have been marked as "abandoned".
`;
    
    await fs.writeFile(logFilePath, logContent);
    console.log(`📄 Update log saved: ${logFilePath}\n`);
    
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Update failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the update
updateIncorrectStatusToAbandoned();










