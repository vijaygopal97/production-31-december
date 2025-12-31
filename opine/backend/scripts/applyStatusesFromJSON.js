#!/usr/bin/env node

/**
 * Apply response statuses from a JSON file to the database
 * This script reads a JSON file with responseId and status mappings
 * and updates the database accordingly
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');

// JSON file path (can be passed as command line argument)
const JSON_FILE = process.argv[2] || '/tmp/remote_statuses.json';
const OUTPUT_DIR = path.join(__dirname, '../../Report-Generation/StatusSync');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function applyStatusesFromJSON() {
  console.log('🔄 Applying statuses from JSON file...\n');
  
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`❌ JSON file not found: ${JSON_FILE}`);
    process.exit(1);
  }
  
  try {
    // Load JSON data
    console.log(`📥 Loading JSON file: ${JSON_FILE}`);
    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    console.log(`✅ Loaded ${jsonData.length} responses from JSON file\n`);
    
    // Create status map
    const statusMap = new Map();
    jsonData.forEach(item => {
      if (item.responseId && item.status) {
        statusMap.set(item.responseId, item.status);
      }
    });
    
    console.log(`📊 Created status map with ${statusMap.size} entries\n`);
    
    // Connect to database
    const TARGET_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
    const targetDbName = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT';
    console.log(`📡 Connecting to ${targetDbName} database...`);
    await mongoose.connect(TARGET_MONGODB_URI);
    console.log(`✅ Connected to ${targetDbName} database\n`);
    
    // Update database
    console.log('🔄 Updating database...');
    const responseIds = Array.from(statusMap.keys());
    
    const BATCH_SIZE = 1000;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalNotFound = 0;
    let totalUnchanged = 0;
    const changes = [];
    
    for (let i = 0; i < responseIds.length; i += BATCH_SIZE) {
      const batch = responseIds.slice(i, i + BATCH_SIZE);
      
      // Find responses in database
      const responses = await SurveyResponse.find({
        responseId: { $in: batch }
      }).select('_id responseId status').lean();
      
      // Create a map of responses
      const responseMap = new Map();
      responses.forEach(response => {
        responseMap.set(response.responseId, response);
      });
      
      // Process each response
      for (const responseId of batch) {
        totalProcessed++;
        const targetStatus = statusMap.get(responseId);
        const existingResponse = responseMap.get(responseId);
        
        if (!existingResponse) {
          totalNotFound++;
          continue;
        }
        
        if (existingResponse.status === targetStatus) {
          totalUnchanged++;
          continue;
        }
        
        // Update status
        try {
          await SurveyResponse.updateOne(
            { _id: existingResponse._id },
            { $set: { status: targetStatus } }
          );
          
          totalUpdated++;
          changes.push({
            responseId: responseId,
            oldStatus: existingResponse.status,
            newStatus: targetStatus
          });
          
          if (totalUpdated % 100 === 0) {
            console.log(`  Processed ${totalProcessed}/${responseIds.length}, Updated: ${totalUpdated}`);
          }
        } catch (error) {
          console.error(`❌ Error updating response ${responseId}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Status application completed!\n');
    console.log('Summary:');
    console.log(`  Total responses in JSON: ${statusMap.size}`);
    console.log(`  Total processed: ${totalProcessed}`);
    console.log(`  Updated: ${totalUpdated}`);
    console.log(`  Unchanged: ${totalUnchanged}`);
    console.log(`  Not found in database: ${totalNotFound}\n`);
    
    // Save detailed log
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const logPath = path.join(OUTPUT_DIR, `status_apply_${targetDbName}_${timestamp}.json`);
    const summary = {
      timestamp: new Date().toISOString(),
      targetDatabase: targetDbName,
      jsonFile: JSON_FILE,
      summary: {
        totalResponsesInJSON: statusMap.size,
        totalProcessed: totalProcessed,
        totalUpdated: totalUpdated,
        totalUnchanged: totalUnchanged,
        totalNotFound: totalNotFound
      },
      changes: changes
    };
    
    fs.writeFileSync(logPath, JSON.stringify(summary, null, 2));
    console.log(`📄 Detailed log saved to: ${logPath}`);
    
    // Also save a CSV with changes
    const csvPath = path.join(OUTPUT_DIR, `status_apply_${targetDbName}_${timestamp}.csv`);
    const csvRows = [
      'Response ID,Old Status,New Status'
    ];
    changes.forEach(change => {
      csvRows.push(`"${change.responseId}","${change.oldStatus}","${change.newStatus}"`);
    });
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`📄 Changes CSV saved to: ${csvPath}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error during status application:', error);
    throw error;
  }
}

// Run the script
applyStatusesFromJSON()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

