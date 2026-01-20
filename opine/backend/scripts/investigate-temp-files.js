/**
 * Investigate temp files - Check which ones are in S3
 * This helps determine if files are accumulating improperly
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { fileExistsInS3, generateAudioKey } = require('../utils/cloudStorage');
const SurveyResponse = require('../models/SurveyResponse');

async function investigateTempFiles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const tempDir = path.join(__dirname, '../../uploads/temp');
    const allFiles = fs.readdirSync(tempDir).filter(f => f.match(/\.(m4a|webm|mp3)$/i));
    
    console.log(`📊 Total temp audio files: ${allFiles.length}`);
    console.log(`📊 Checking sample of 50 files...\n`);

    const sampleFiles = allFiles.slice(0, 50);
    let stats = {
      inS3: 0,
      inDB: 0,
      orphaned: 0,
      s3Failed: 0
    };

    for (const file of sampleFiles) {
      const filePath = path.join(tempDir, file);
      const stats_fs = fs.statSync(filePath);
      const modifiedDate = stats_fs.mtime;
      
      // Extract ID from filename
      const match = file.match(/interview[_-]([^_]+)/);
      if (!match) continue;
      
      const id = match[1];
      const year = modifiedDate.getFullYear();
      const month = String(modifiedDate.getMonth() + 1).padStart(2, '0');
      
      // Try to generate S3 key (same logic as upload)
      let s3Key;
      try {
        s3Key = generateAudioKey(id, file);
      } catch (e) {
        // Fallback: manual generation
        s3Key = `audio/interviews/${year}/${month}/${file}`;
      }

      // Check S3
      let existsInS3 = false;
      try {
        existsInS3 = await fileExistsInS3(s3Key);
      } catch (s3Error) {
        stats.s3Failed++;
        console.log(`⚠️  ${file.substring(0, 50)}: S3 check failed`);
        continue;
      }

      // Check database
      const dbRefs = await SurveyResponse.countDocuments({
        $or: [
          { 'audioRecording.audioUrl': { $regex: file } },
          { 'audioRecording.audioUrl': s3Key },
          { 'audioRecording.filename': file }
        ]
      });

      if (existsInS3) {
        stats.inS3++;
        console.log(`✅ ${file.substring(0, 50)}: IN S3 (should be deleted!)`);
      } else if (dbRefs > 0) {
        stats.inDB++;
        console.log(`⚠️  ${file.substring(0, 50)}: In DB but NOT in S3 (legitimate failure)`);
      } else {
        stats.orphaned++;
        console.log(`❌ ${file.substring(0, 50)}: Orphaned (not in S3 or DB)`);
      }
    }

    console.log('\n===========================================');
    console.log('📊 SUMMARY:');
    console.log('===========================================');
    console.log(`✅ In S3 (should delete): ${stats.inS3} (${((stats.inS3/sampleFiles.length)*100).toFixed(1)}%)`);
    console.log(`⚠️  In DB but not S3: ${stats.inDB} (${((stats.inDB/sampleFiles.length)*100).toFixed(1)}%)`);
    console.log(`❌ Orphaned: ${stats.orphaned} (${((stats.orphaned/sampleFiles.length)*100).toFixed(1)}%)`);
    console.log(`⚠️  S3 check failed: ${stats.s3Failed}`);
    console.log('\n');

    // Check date range
    const dates = allFiles.map(f => {
      const filePath = path.join(tempDir, f);
      return fs.statSync(filePath).mtime;
    }).sort();
    
    const oldest = dates[0];
    const newest = dates[dates.length - 1];
    const daysDiff = (newest - oldest) / (1000 * 60 * 60 * 24);
    
    console.log('📅 Date Range:');
    console.log(`   Oldest: ${oldest.toISOString().split('T')[0]}`);
    console.log(`   Newest: ${newest.toISOString().split('T')[0]}`);
    console.log(`   Span: ${daysDiff.toFixed(1)} days`);
    console.log('');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

investigateTempFiles();




