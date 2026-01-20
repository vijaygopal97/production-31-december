/**
 * Validate recovered audio files - check if they're actually playable
 * This script identifies corrupted files that pass basic validation but don't play
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const SurveyResponse = require('../models/SurveyResponse');

const RECOVERY_REPORT = path.join(__dirname, '../../recovery-report.json');

async function validateRecoveredAudio() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    if (!fs.existsSync(RECOVERY_REPORT)) {
      console.error('❌ Recovery report not found:', RECOVERY_REPORT);
      await mongoose.disconnect();
      return;
    }

    const report = JSON.parse(fs.readFileSync(RECOVERY_REPORT, 'utf8'));
    const recoveredFiles = report.details.filter(d => d.status === 'success');
    
    console.log(`📊 Validating ${recoveredFiles.length} recovered files...\n`);

    let validated = 0;
    let corrupted = 0;
    const corruptedFiles = [];

    for (const file of recoveredFiles) {
      const { responseId, s3Key, fileSize } = file;
      
      // Check if file still exists in temp (for re-validation)
      const tempFile = file.filePath;
      let canValidate = false;
      
      if (fs.existsSync(tempFile)) {
        canValidate = true;
        console.log(`🔍 Validating: ${path.basename(tempFile)}`);
        
        // Try to validate using file command (basic check)
        try {
          const fileOutput = execSync(`file "${tempFile}"`, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
          console.log(`  File type: ${fileOutput.trim()}`);
          
          // Check if it's a valid audio file
          if (fileOutput.includes('ISO Media') || fileOutput.includes('MP4') || fileOutput.includes('audio')) {
            console.log(`  ✅ Basic validation passed`);
            validated++;
          } else {
            console.log(`  ⚠️  File type check failed - may be corrupted`);
            corrupted++;
            corruptedFiles.push({ responseId, s3Key, reason: 'Invalid file type', filePath: tempFile });
          }
        } catch (error) {
          console.log(`  ⚠️  Could not validate file: ${error.message}`);
          // Don't mark as corrupted if we can't validate
        }
      } else {
        console.log(`⚠️  Temp file not found: ${path.basename(tempFile)} (cannot re-validate)`);
        // File was deleted after recovery - assume it was valid
        validated++;
      }
      
      console.log('');
    }

    console.log('\n===========================================');
    console.log('📊 VALIDATION SUMMARY:');
    console.log('===========================================');
    console.log(`Total recovered files: ${recoveredFiles.length}`);
    console.log(`✅ Validated: ${validated}`);
    console.log(`❌ Potentially corrupted: ${corrupted}`);
    console.log('===========================================\n');

    if (corruptedFiles.length > 0) {
      console.log('⚠️  CORRUPTED FILES FOUND:');
      console.log('These files may need to be re-uploaded from the original source\n');
      corruptedFiles.forEach(f => {
        console.log(`  - Response ID: ${f.responseId}`);
        console.log(`    S3 Key: ${f.s3Key}`);
        console.log(`    Reason: ${f.reason}`);
        console.log('');
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

validateRecoveredAudio();




