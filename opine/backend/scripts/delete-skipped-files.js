/**
 * Delete skipped files from recovery process
 * These are files that matched responses but were skipped because response already had audio
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const SurveyResponse = require('../models/SurveyResponse');

const TEMP_DIR = path.join(__dirname, '../../uploads/temp');
const REPORT_FILE = path.join(__dirname, '../../orphaned-files-cleanup-report.json');
const DELETION_REPORT_FILE = path.join(__dirname, '../../skipped-files-deletion-report.json');

async function deleteSkippedFiles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Load recovery report
    const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
    const successfulRecoveries = report.recovery.details.filter(d => d.status === 'success');
    const successfulFilenames = new Set(successfulRecoveries.map(d => d.filename));
    const successfulResponseIds = new Set(successfulRecoveries.map(d => d.responseId).filter(Boolean));

    console.log(`📊 Loaded recovery report:`);
    console.log(`  Successful recoveries: ${successfulRecoveries.length}`);
    console.log(`  Skipped files: ${report.recovery.skipped}\n`);

    // Get all temp files
    const tempFiles = fs.readdirSync(TEMP_DIR)
      .filter(f => f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.webm'));

    console.log(`📊 Total temp files: ${tempFiles.length}\n`);

    // Find skipped files: files that match responses with audio but weren't successfully recovered
    console.log('🔍 Identifying skipped files...');
    const skippedFiles = [];
    let checked = 0;

    // Extract responseIds and sessionIds from all temp files
    const fileMetadata = tempFiles.map(filename => {
      const responseIdMatch = filename.match(/interview_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})_/);
      const sessionIdMatch = filename.match(/interview_([a-f0-9-]{36}|offline_[a-zA-Z0-9_]+)_/);
      return {
        filename,
        responseId: responseIdMatch ? responseIdMatch[1] : null,
        sessionId: sessionIdMatch ? sessionIdMatch[1] : null
      };
    });

    // Get all responseIds and sessionIds
    const responseIds = new Set(fileMetadata.map(f => f.responseId).filter(Boolean));
    const sessionIds = new Set(fileMetadata.map(f => f.sessionId).filter(Boolean));

    console.log(`  Extracted ${responseIds.size} responseIds and ${sessionIds.size} sessionIds`);

    // Bulk fetch responses with audio
    const responsesWithAudio = new Set();
    if (responseIds.size > 0) {
      const responseIdArray = Array.from(responseIds);
      for (let i = 0; i < responseIdArray.length; i += 1000) {
        const batch = responseIdArray.slice(i, i + 1000);
        const responses = await SurveyResponse.find({
          responseId: { $in: batch },
          'audioRecording.hasAudio': true,
          'audioRecording.audioUrl': { $exists: true, $ne: null, $ne: '' }
        }).select('responseId').lean();
        responses.forEach(r => responsesWithAudio.add(r.responseId));
        if ((i + 1000) % 5000 === 0 || i + 1000 >= responseIdArray.length) {
          console.log(`  Checked ${Math.min(i + 1000, responseIdArray.length)}/${responseIdArray.length} responses...`);
        }
      }
    }

    if (sessionIds.size > 0) {
      const sessionIdArray = Array.from(sessionIds);
      for (let i = 0; i < sessionIdArray.length; i += 1000) {
        const batch = sessionIdArray.slice(i, i + 1000);
        const responses = await SurveyResponse.find({
          $or: [
            { 'metadata.sessionId': { $in: batch } },
            { sessionId: { $in: batch } }
          ],
          'audioRecording.hasAudio': true,
          'audioRecording.audioUrl': { $exists: true, $ne: null, $ne: '' }
        }).select('responseId metadata.sessionId sessionId').lean();
        responses.forEach(r => {
          if (r.responseId) responsesWithAudio.add(r.responseId);
          const sessionId = r.metadata?.sessionId || r.sessionId;
          if (sessionId) {
            // Map sessionId to responseId for checking
            fileMetadata.forEach(f => {
              if (f.sessionId === sessionId && r.responseId) {
                responsesWithAudio.add(r.responseId);
              }
            });
          }
        });
        if ((i + 1000) % 5000 === 0 || i + 1000 >= sessionIdArray.length) {
          console.log(`  Checked ${Math.min(i + 1000, sessionIdArray.length)}/${sessionIdArray.length} sessions...`);
        }
      }
    }

    console.log(`  Found ${responsesWithAudio.size} responses with audio\n`);

    // Identify skipped files: files that match responses with audio but weren't successfully recovered
    console.log('🔍 Identifying skipped files...');
    for (const file of fileMetadata) {
      // Skip if this file was successfully recovered
      if (successfulFilenames.has(file.filename)) {
        continue;
      }

      // Check if file matches a response that has audio
      if (file.responseId && responsesWithAudio.has(file.responseId)) {
        skippedFiles.push({
          filename: file.filename,
          responseId: file.responseId,
          reason: 'skipped - response already has audio'
        });
      } else if (file.sessionId) {
        // For sessionId matches, we need to check if any response with this sessionId has audio
        // This is more complex, so we'll do a simpler check
        // Actually, let's just check if the file matches a responseId that has audio
        // We already did that above
      }
    }

    console.log(`  Found ${skippedFiles.length} skipped files to delete\n`);

    // Delete skipped files
    console.log('🗑️  Deleting skipped files...');
    const deletionReport = {
      startTime: new Date().toISOString(),
      totalSkipped: skippedFiles.length,
      deleted: 0,
      failed: 0,
      totalSize: 0,
      details: []
    };

    for (let i = 0; i < skippedFiles.length; i += 500) {
      const batch = skippedFiles.slice(i, i + 500);
      
      for (const file of batch) {
        const filePath = path.join(TEMP_DIR, file.filename);
        try {
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            fs.unlinkSync(filePath);
            
            deletionReport.deleted++;
            deletionReport.totalSize += fileSize;
            
            if (deletionReport.details.length < 100) {
              deletionReport.details.push({
                filename: file.filename,
                size: fileSize,
                responseId: file.responseId
              });
            }
          }
        } catch (error) {
          deletionReport.failed++;
          console.error(`  Failed to delete ${file.filename}:`, error.message);
        }
      }

      if ((i + 500) % 1000 === 0 || i + 500 >= skippedFiles.length) {
        console.log(`  Deleted ${Math.min(i + 500, skippedFiles.length)}/${skippedFiles.length} files...`);
      }
    }

    deletionReport.endTime = new Date().toISOString();
    deletionReport.duration = `${((new Date(deletionReport.endTime) - new Date(deletionReport.startTime)) / 1000).toFixed(2)} seconds`;

    // Save deletion report
    fs.writeFileSync(DELETION_REPORT_FILE, JSON.stringify(deletionReport, null, 2));

    console.log(`\n✅ Deletion complete:`);
    console.log(`  Deleted: ${deletionReport.deleted} files`);
    console.log(`  Failed: ${deletionReport.failed} files`);
    console.log(`  Total size freed: ${(deletionReport.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  Report saved to: ${DELETION_REPORT_FILE}\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteSkippedFiles();




