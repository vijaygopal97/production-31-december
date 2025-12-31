/**
 * Copy today's SurveyResponses from Production to Development
 * And create the respective QCBatch objects that would have been created
 * if the responses were submitted through the development server
 */

const mongoose = require('mongoose');
const { execSync } = require('child_process');
require('dotenv').config();

const DEV_MONGODB_URI = process.env.MONGODB_URI;
const PROD_SSH_KEY = '/var/www/MyLogos/Convergent-New.pem';
const PROD_SERVER = 'ubuntu@13.202.181.167';
const SURVEY_ID = '68fd1915d41841da463f0d46';

const copyTodayResponsesAndCreateBatches = async () => {
  try {
    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('📅 Copying responses from:', today.toISOString(), 'to', tomorrow.toISOString());
    
    // Step 1: Copy export script to production and execute it
    console.log('🔌 Exporting responses from Production database...\n');
    
    // Copy the export script to production
    execSync(
      `scp -i ${PROD_SSH_KEY} /var/www/opine/backend/scripts/exportTodayResponses.js ${PROD_SERVER}:/tmp/exportTodayResponses.js`,
      { encoding: 'utf-8' }
    );
    
    // Copy script to backend directory on production
    execSync(
      `scp -i ${PROD_SSH_KEY} /var/www/opine/backend/scripts/exportTodayResponses.js ${PROD_SERVER}:/var/www/opine/backend/scripts/exportTodayResponses.js`,
      { encoding: 'utf-8' }
    );
    
    // Execute the script on production - it will write to a temp file and output the file path
    const output = execSync(
      `ssh -i ${PROD_SSH_KEY} ${PROD_SERVER} "cd /var/www/opine/backend && node scripts/exportTodayResponses.js 2>/dev/null"`,
      { encoding: 'utf-8' }
    );
    
    // Extract file path from output (might have dotenv messages)
    const lines = output.split('\n');
    let outputFilePath = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('/tmp/prod_responses_') && trimmed.endsWith('.json')) {
        outputFilePath = trimmed;
        break;
      }
    }
    
    if (!outputFilePath) {
      throw new Error('Could not find output file path in script output');
    }
    
    console.log(`📁 JSON file created on production: ${outputFilePath}\n`);
    
    // Download the JSON file from production
    const fs = require('fs');
    const localTempFile = `/tmp/prod_responses_${Date.now()}.json`;
    execSync(
      `scp -i ${PROD_SSH_KEY} ${PROD_SERVER}:${outputFilePath} ${localTempFile}`,
      { encoding: 'utf-8' }
    );
    
    console.log(`📥 Downloaded JSON file to: ${localTempFile}\n`);
    
    // Read and parse the JSON file
    let prodResponses;
    try {
      const jsonContent = fs.readFileSync(localTempFile, 'utf-8');
      prodResponses = JSON.parse(jsonContent);
      console.log(`✅ Parsed ${prodResponses.length} responses from JSON file\n`);
      
      // Clean up local temp file
      fs.unlinkSync(localTempFile);
      
      // Clean up remote temp file
      execSync(
        `ssh -i ${PROD_SSH_KEY} ${PROD_SERVER} "rm -f ${outputFilePath}"`,
        { encoding: 'utf-8' }
      );
    } catch (parseError) {
      console.error('❌ Failed to parse production responses:', parseError.message);
      prodResponses = [];
    }
    
    console.log(`📊 Found ${prodResponses.length} responses in Production for today\n`);
    
    if (prodResponses.length === 0) {
      console.log('✅ No responses to copy');
      process.exit(0);
    }
    
    // Step 2: Connect to development database
    console.log('🔌 Connecting to Development database...\n');
    await mongoose.connect(DEV_MONGODB_URI);
    
    // Load all required models first (this will compile them)
    require('../models/SurveyResponse');
    require('../models/QCBatch');
    require('../models/Company'); // Required by QCBatch helper
    require('../models/Survey'); // Required by QCBatch helper
    require('../models/User'); // Required by QCBatch helper
    
    // Now get the models from mongoose
    const DevSurveyResponse = mongoose.model('SurveyResponse');
    const QCBatch = mongoose.model('QCBatch');
    
    // Load helper after models are set up
    const { getOrCreateBatch, addResponseToBatch } = require('../utils/qcBatchHelper');
    
    // Step 3: Import responses and create batches
    let copiedCount = 0;
    let updatedCount = 0;
    let batchCreatedCount = 0;
    let batchUpdatedCount = 0;
    
    for (const prodResponse of prodResponses) {
      try {
        // Check if response already exists
        const existingResponse = await DevSurveyResponse.findById(prodResponse._id);
        
        if (!existingResponse) {
          // Insert new response
          await DevSurveyResponse.create(prodResponse);
          copiedCount++;
          console.log(`✅ Copied response ${prodResponse._id}`);
        } else {
          // Update existing response
          await DevSurveyResponse.updateOne(
            { _id: prodResponse._id },
            { $set: prodResponse }
          );
          updatedCount++;
          if (updatedCount % 100 === 0) {
            console.log(`🔄 Updated ${updatedCount} responses...`);
          }
        }
        
        // Create/update QCBatch for this response
        // Only if response is NOT auto-rejected and NOT abandoned
        const isAutoRejected = prodResponse.status === 'Rejected' && 
                               (prodResponse.rejectionReason?.toLowerCase().includes('auto-rejected') ||
                                prodResponse.rejectionReason?.toLowerCase().includes('auto rejected'));
        const isAbandoned = prodResponse.status === 'abandoned' || 
                           prodResponse.status === 'Abandoned' ||
                           prodResponse.metadata?.abandoned === true;
        
        if (!isAutoRejected && !isAbandoned && prodResponse.interviewer) {
          try {
            const interviewerId = typeof prodResponse.interviewer === 'object' 
              ? prodResponse.interviewer._id || prodResponse.interviewer
              : prodResponse.interviewer;
            
            // Check if response already has a batch
            const responseWithBatch = await DevSurveyResponse.findById(prodResponse._id).select('qcBatch').lean();
            if (responseWithBatch && responseWithBatch.qcBatch) {
              // Response already has a batch, skip
              continue;
            }
            
            // Get or create batch (this will find existing collecting batch or create new one)
            const batch = await getOrCreateBatch(
              SURVEY_ID,
              interviewerId.toString()
            );
            
            // Check if this is a new batch (just created)
            const isNewBatch = batch.totalResponses === 0 && batch.responses.length === 0;
            
            // Add response to batch if not already added
            const responseIdStr = prodResponse._id.toString();
            const alreadyInBatch = batch.responses.some(r => r.toString() === responseIdStr);
            
            if (!alreadyInBatch) {
              await addResponseToBatch(
                prodResponse._id,
                SURVEY_ID,
                interviewerId.toString()
              );
              
              if (isNewBatch) {
                batchCreatedCount++;
                if (batchCreatedCount <= 10) {
                  console.log(`  📦 Created new batch ${batch._id} for interviewer ${interviewerId}`);
                }
              } else {
                batchUpdatedCount++;
                if (batchUpdatedCount <= 10 || batchUpdatedCount % 100 === 0) {
                  console.log(`  📦 Added to existing batch ${batch._id}`);
                }
              }
            }
          } catch (batchError) {
            console.error(`  ⚠️  Error creating batch for response ${prodResponse._id}:`, batchError.message);
            // Continue with next response
          }
        } else {
          console.log(`  ⏭️  Skipped batch creation for ${isAbandoned ? 'abandoned' : 'auto-rejected'} response ${prodResponse._id}`);
        }
      } catch (error) {
        console.error(`❌ Error processing response ${prodResponse._id}:`, error.message);
        // Continue with next response
      }
    }
    
    // Step 4: Verify
    const devCount = await DevSurveyResponse.countDocuments({
      survey: SURVEY_ID,
      createdAt: { $gte: today, $lt: tomorrow }
    });
    
    const batchCount = await QCBatch.countDocuments({
      survey: SURVEY_ID,
      batchDate: { $gte: today, $lt: tomorrow }
    });
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Copied ${copiedCount} new responses`);
    console.log(`   🔄 Updated ${updatedCount} existing responses`);
    console.log(`   📦 Created ${batchCreatedCount} new batches`);
    console.log(`   📦 Updated ${batchUpdatedCount} existing batches`);
    console.log(`   📊 Development now has ${devCount} responses for today`);
    console.log(`   📊 Development now has ${batchCount} batches for today`);
    console.log(`   📊 Production had ${prodResponses.length} responses for today\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  copyTodayResponsesAndCreateBatches();
}

module.exports = { copyTodayResponsesAndCreateBatches };

