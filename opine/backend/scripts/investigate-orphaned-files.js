/**
 * Investigate orphaned files in /uploads/temp/
 * Check if they match responses in database
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const SurveyResponse = require('../models/SurveyResponse');

const RECOVERY_REPORT = path.join(__dirname, '../../recovery-report.json');

async function investigateOrphanedFiles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Load recovery report
    const report = JSON.parse(fs.readFileSync(RECOVERY_REPORT, 'utf8'));
    const recoveredFilenames = report.details.map(d => path.basename(d.filename || d.filePath));
    const recoveredSet = new Set(recoveredFilenames);

    // Get all temp files
    const tempFiles = fs.readdirSync(path.join(__dirname, '../../uploads/temp'))
      .filter(f => f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.webm'));

    const notRecovered = tempFiles.filter(f => !recoveredSet.has(f));
    console.log(`📊 Total orphaned files: ${notRecovered.length}\n`);

    // Sample check (first 100 files)
    const sampleSize = Math.min(100, notRecovered.length);
    const sample = notRecovered.slice(0, sampleSize);

    let matchedWithAudio = 0;
    let matchedWithoutAudio = 0;
    let notMatched = 0;
    const matchedWithoutAudioList = [];

    console.log(`🔍 Checking sample of ${sampleSize} files against database...\n`);

    for (const filename of sample) {
      const responseIdMatch = filename.match(/interview_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})_/);
      const sessionIdMatch = filename.match(/interview_([a-f0-9-]{36}|offline_[a-zA-Z0-9_]+)_/);

      let response = null;

      // Try to match by responseId
      if (responseIdMatch) {
        response = await SurveyResponse.findOne({ responseId: responseIdMatch[1] })
          .select('responseId audioRecording')
          .lean();
      }

      // Try to match by sessionId
      if (!response && sessionIdMatch) {
        response = await SurveyResponse.findOne({
          $or: [
            { 'metadata.sessionId': sessionIdMatch[1] },
            { sessionId: sessionIdMatch[1] }
          ]
        })
          .select('responseId audioRecording')
          .lean();
      }

      if (response) {
        if (response.audioRecording && response.audioRecording.hasAudio && response.audioRecording.audioUrl) {
          matchedWithAudio++;
        } else {
          matchedWithoutAudio++;
          matchedWithoutAudioList.push({
            filename,
            responseId: response.responseId
          });
        }
      } else {
        notMatched++;
      }
    }

    console.log('📊 Sample Results:');
    console.log(`  Matched to responses WITH audio (duplicates): ${matchedWithAudio} (${(matchedWithAudio / sampleSize * 100).toFixed(1)}%)`);
    console.log(`  Matched to responses WITHOUT audio (could recover): ${matchedWithoutAudio} (${(matchedWithoutAudio / sampleSize * 100).toFixed(1)}%)`);
    console.log(`  Not matched (completely orphaned): ${notMatched} (${(notMatched / sampleSize * 100).toFixed(1)}%)\n`);

    if (matchedWithoutAudioList.length > 0) {
      console.log('✅ Files that could be recovered (responses without audio):');
      matchedWithoutAudioList.slice(0, 10).forEach(item => {
        console.log(`  - ${item.filename.substring(0, 60)}... (Response: ${item.responseId})`);
      });
      if (matchedWithoutAudioList.length > 10) {
        console.log(`  ... and ${matchedWithoutAudioList.length - 10} more`);
      }
      console.log('');
    }

    // Extrapolate to full dataset
    const totalOrphaned = notRecovered.length;
    const estimatedRecoverable = Math.round((matchedWithoutAudio / sampleSize) * totalOrphaned);
    const estimatedDuplicates = Math.round((matchedWithAudio / sampleSize) * totalOrphaned);
    const estimatedTrulyOrphaned = totalOrphaned - estimatedRecoverable - estimatedDuplicates;

    console.log('📊 Extrapolated Estimates (for all 12,302 files):');
    console.log(`  Potentially recoverable: ~${estimatedRecoverable} files`);
    console.log(`  Duplicates (response already has audio): ~${estimatedDuplicates} files`);
    console.log(`  Completely orphaned: ~${estimatedTrulyOrphaned} files\n`);

    // Calculate sizes
    let totalSize = 0;
    let recoverableSize = 0;
    let duplicateSize = 0;
    let orphanedSize = 0;

    notRecovered.forEach(f => {
      const filePath = path.join(__dirname, '../../uploads/temp', f);
      try {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      } catch (e) {}
    });

    // Estimate sizes based on percentages
    recoverableSize = (matchedWithoutAudio / sampleSize) * totalSize;
    duplicateSize = (matchedWithAudio / sampleSize) * totalSize;
    orphanedSize = (notMatched / sampleSize) * totalSize;

    console.log('💾 Size Breakdown:');
    console.log(`  Total orphaned files: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  Potentially recoverable: ~${(recoverableSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  Duplicates (safe to delete): ~${(duplicateSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  Completely orphaned (safe to delete): ~${(orphanedSize / 1024 / 1024 / 1024).toFixed(2)} GB\n`);

    console.log('💡 Recommendations:');
    console.log('1. Run recovery for files matching responses without audio');
    console.log('2. Delete duplicates (responses already have audio)');
    console.log('3. Delete completely orphaned files');
    console.log(`4. This would free up approximately ${((duplicateSize + orphanedSize) / 1024 / 1024 / 1024).toFixed(2)} GB\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

investigateOrphanedFiles();




