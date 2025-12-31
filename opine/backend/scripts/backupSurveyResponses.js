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
 * Backup SurveyResponse collection for the specific survey
 */
async function backupSurveyResponses() {
  try {
    await connectDB();
    
    console.log('\n🔍 Starting backup of SurveyResponse collection...');
    console.log(`📋 Survey ID: ${SURVEY_ID}`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);
    
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Get count first
    const totalCount = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      status: { $in: ['Approved', 'Pending_Approval', 'Rejected'] }
    });
    
    console.log(`📊 Found ${totalCount} responses to backup\n`);
    
    // Use MongoDB native export via mongoexport or write in batches
    const backupFilePath = path.join(OUTPUT_DIR, `survey_responses_backup_${TIMESTAMP}.json`);
    const writeStream = require('fs').createWriteStream(backupFilePath);
    
    writeStream.write('[\n');
    
    // Process in batches and write to file
    const BATCH_SIZE = 1000;
    let firstItem = true;
    let processedCount = 0;
    
    const cursor = SurveyResponse.find({
      survey: SURVEY_ID,
      status: { $in: ['Approved', 'Pending_Approval', 'Rejected'] }
    })
      .lean()
      .select('_id responseId status interviewMode responses createdAt updatedAt')
      .cursor({ batchSize: BATCH_SIZE });
    
    for await (const response of cursor) {
      if (!firstItem) {
        writeStream.write(',\n');
      }
      writeStream.write(JSON.stringify(response, null, 2));
      firstItem = false;
      processedCount++;
      
      if (processedCount % 1000 === 0) {
        console.log(`   Backed up: ${processedCount}/${totalCount} (${Math.round(processedCount / totalCount * 100)}%)`);
      }
    }
    
    writeStream.write('\n]');
    writeStream.end();
    
    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`✅ Backup completed!`);
    console.log(`📄 Backup file: ${backupFilePath}`);
    console.log(`📊 Total responses backed up: ${processedCount}\n`);
    
    // Get status and mode breakdown for summary
    const statusCounts = {
      Approved: 0,
      Pending_Approval: 0,
      Rejected: 0
    };
    const modeCounts = {
      CAPI: 0,
      CATI: 0,
      Online: 0,
      Unknown: 0
    };
    
    // Re-query to get counts (or we can count from the file, but this is simpler)
    const statusBreakdown = await SurveyResponse.aggregate([
      {
        $match: {
          survey: new mongoose.Types.ObjectId(SURVEY_ID),
          status: { $in: ['Approved', 'Pending_Approval', 'Rejected'] }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const modeBreakdown = await SurveyResponse.aggregate([
      {
        $match: {
          survey: new mongoose.Types.ObjectId(SURVEY_ID),
          status: { $in: ['Approved', 'Pending_Approval', 'Rejected'] }
        }
      },
      {
        $group: {
          _id: '$interviewMode',
          count: { $sum: 1 }
        }
      }
    ]);
    
    statusBreakdown.forEach(item => {
      statusCounts[item._id] = item.count;
    });
    
    modeBreakdown.forEach(item => {
      const mode = item._id || 'Unknown';
      if (mode === 'capi') modeCounts.CAPI = item.count;
      else if (mode === 'cati') modeCounts.CATI = item.count;
      else if (mode === 'online') modeCounts.Online = item.count;
      else modeCounts.Unknown += item.count;
    });
    
    // Also create a summary file
    const summaryFilePath = path.join(OUTPUT_DIR, `backup_summary_${TIMESTAMP}.txt`);
    const summary = `
SURVEY RESPONSES BACKUP SUMMARY
================================

Survey ID: ${SURVEY_ID}
Backup Date: ${new Date().toISOString()}
Backup File: ${backupFilePath}

Total Responses Backed Up: ${totalCount}

Status Breakdown:
-----------------
Approved: ${statusCounts.Approved}
Pending_Approval: ${statusCounts.Pending_Approval}
Rejected: ${statusCounts.Rejected}

Mode Breakdown:
---------------
CAPI: ${modeCounts.CAPI}
CATI: ${modeCounts.CATI}
Online: ${modeCounts.Online}
Unknown: ${modeCounts.Unknown}

Backup includes:
- _id
- responseId
- status
- interviewMode
- responses (full array)
- createdAt
- updatedAt

This backup was created before updating incorrect status responses to "abandoned".
`;
    
    await fs.writeFile(summaryFilePath, summary);
    console.log(`📄 Summary file: ${summaryFilePath}\n`);
    
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the backup
backupSurveyResponses();

