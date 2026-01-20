/**
 * Recover Orphaned Audio Files
 * 
 * This script:
 * 1. Matches temp files to responses without audio
 * 2. Validates audio files (complete, not corrupted)
 * 3. Uploads to S3
 * 4. Links to responses atomically
 * 5. Creates detailed report
 * 
 * Reusable for future recovery operations
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { uploadToS3, generateAudioKey, fileExistsInS3 } = require('../utils/cloudStorage');
const SurveyResponse = require('../models/SurveyResponse');
const CatiCall = require('../models/CatiCall');

// Report data
const report = {
  startTime: new Date(),
  endTime: null,
  totalFiles: 0,
  validated: 0,
  corrupted: 0,
  uploaded: 0,
  linked: 0,
  failed: 0,
  skipped: 0,
  details: []
};

/**
 * Validate audio file (check if complete and not corrupted)
 */
function validateAudioFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }

    const stats = fs.statSync(filePath);
    
    // Check file size (should be > 0)
    if (stats.size === 0) {
      return { valid: false, error: 'File is empty (0 bytes)' };
    }

    // Check if file is too small (likely corrupted, < 1KB)
    if (stats.size < 1024) {
      return { valid: false, error: 'File too small (likely corrupted, < 1KB)' };
    }

    // Try to read first few bytes to check if file is accessible
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(1024);
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);
    } catch (readError) {
      return { valid: false, error: `Cannot read file: ${readError.message}` };
    }

    // Check file extension matches audio format
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = ['.m4a', '.mp3', '.webm', '.wav', '.mp4'];
    if (!validExtensions.includes(ext)) {
      return { valid: false, error: `Invalid audio extension: ${ext}` };
    }

    return { 
      valid: true, 
      size: stats.size,
      extension: ext,
      modified: stats.mtime
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Generate content hash for deduplication
 */
function generateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch (error) {
    console.error(`Error generating hash for ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if audio already exists in S3 (by hash or filename)
 */
async function checkDuplicateAudio(responseId, filename, fileHash) {
  try {
    // Check by responseId in database
    const existingResponse = await SurveyResponse.findOne({
      responseId: responseId,
      'audioRecording.hasAudio': true,
      'audioRecording.audioUrl': { $exists: true, $ne: '' }
    }).select('audioRecording').lean();

    if (existingResponse && existingResponse.audioRecording?.audioUrl) {
      // Check if file exists in S3
      const s3Key = existingResponse.audioRecording.audioUrl;
      if (await fileExistsInS3(s3Key)) {
        return { isDuplicate: true, reason: 'Response already has audio in S3', existingS3Key: s3Key };
      }
    }

    // Check by hash (if we have it)
    if (fileHash) {
      const hashMatch = await SurveyResponse.findOne({
        'audioRecording.contentHash': fileHash,
        'audioRecording.hasAudio': true
      }).select('audioRecording').lean();

      if (hashMatch && hashMatch.audioRecording?.audioUrl) {
        const s3Key = hashMatch.audioRecording.audioUrl;
        if (await fileExistsInS3(s3Key)) {
          return { isDuplicate: true, reason: 'Duplicate audio (same hash exists)', existingS3Key: s3Key };
        }
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking duplicate:', error.message);
    return { isDuplicate: false, error: error.message };
  }
}

/**
 * Upload file to S3 and link to response
 */
async function uploadAndLink(match, dryRun = false) {
  const { response, file, matchType, confidence } = match;
  const filePath = file.path;
  const filename = file.filename;

  const result = {
    responseId: response.responseId || response._id.toString(),
    responseMongoId: response._id.toString(),
    filename: filename,
    filePath: filePath,
    matchType: matchType,
    confidence: confidence,
    status: 'pending',
    error: null,
    s3Key: null,
    fileSize: null,
    contentHash: null
  };

  try {
    // Step 1: Validate file
    report.totalFiles++;
    const validation = validateAudioFile(filePath);
    
    if (!validation.valid) {
      result.status = 'failed';
      result.error = `Validation failed: ${validation.error}`;
      report.corrupted++;
      report.failed++;
      report.details.push(result);
      return result;
    }

    report.validated++;
    result.fileSize = validation.size;

    // Step 2: Generate content hash
    const fileHash = generateFileHash(filePath);
    result.contentHash = fileHash;

    // Step 3: Check for duplicates
    const duplicateCheck = await checkDuplicateAudio(
      response.responseId || response._id.toString(),
      filename,
      fileHash
    );

    if (duplicateCheck.isDuplicate) {
      result.status = 'skipped';
      result.error = duplicateCheck.reason;
      result.s3Key = duplicateCheck.existingS3Key;
      report.skipped++;
      report.details.push(result);
      return result;
    }

    // Step 4: Upload to S3 (if not dry run)
    if (dryRun) {
      result.status = 'dry-run';
      result.s3Key = `audio/interviews/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${filename}`;
      report.details.push(result);
      return result;
    }

    const s3Key = generateAudioKey(
      response.responseId || response._id.toString(),
      filename
    );

    console.log(`📤 Uploading ${filename} to S3: ${s3Key}`);
    const uploadResult = await uploadToS3(filePath, s3Key, {
      contentType: validation.extension === '.m4a' ? 'audio/mp4' : 
                   validation.extension === '.mp3' ? 'audio/mpeg' :
                   validation.extension === '.webm' ? 'audio/webm' :
                   'audio/mpeg',
      metadata: {
        responseId: response.responseId || response._id.toString(),
        sessionId: response.sessionId || null,
        recovered: 'true',
        recoveredAt: new Date().toISOString(),
        matchType: matchType,
        confidence: confidence,
        originalFilename: filename
      }
    });

    result.s3Key = uploadResult.key;
    report.uploaded++;

    // Step 5: Link to response atomically
    const updateData = {
      'audioRecording.hasAudio': true,
      'audioRecording.audioUrl': uploadResult.key,
      'audioRecording.uploadedAt': new Date(),
      'audioRecording.storageType': 's3',
      'audioRecording.filename': filename,
      'audioRecording.fileSize': validation.size,
      'audioRecording.format': validation.extension.replace('.', ''),
      'audioRecording.mimetype': validation.extension === '.m4a' ? 'audio/mp4' : 
                                 validation.extension === '.mp3' ? 'audio/mpeg' :
                                 validation.extension === '.webm' ? 'audio/webm' :
                                 'audio/mpeg',
      'audioRecording.contentHash': fileHash,
      'audioRecording.recovered': true,
      'audioRecording.recoveredAt': new Date(),
      'audioRecording.recoveryMatchType': matchType,
      'audioRecording.recoveryConfidence': confidence
    };

    // Calculate duration if we have startTime/endTime
    if (response.startedAt && response.completedAt) {
      const duration = Math.round((new Date(response.completedAt) - new Date(response.startedAt)) / 1000);
      updateData['audioRecording.recordingDuration'] = duration;
    }

    const updateResult = await SurveyResponse.updateOne(
      { _id: response._id },
      { $set: updateData }
    );

    if (updateResult.modifiedCount > 0) {
      result.status = 'success';
      report.linked++;
      console.log(`✅ Successfully linked audio to response: ${result.responseId}`);
    } else {
      result.status = 'failed';
      result.error = 'Database update failed (no documents modified)';
      report.failed++;
    }

    report.details.push(result);
    return result;

  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    report.failed++;
    report.details.push(result);
    console.error(`❌ Error processing ${filename}:`, error.message);
    return result;
  }
}

/**
 * Main recovery function
 */
async function recoverOrphanedAudio(options = {}) {
  const {
    dryRun = false,
    limit = null,
    minConfidence = 'low' // 'high', 'medium', 'low'
  } = options;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get responses without audio
    const query = {
      interviewMode: 'capi', // Focus on CAPI first
      $or: [
        { 'audioRecording.hasAudio': { $ne: true } },
        { 'audioRecording.hasAudio': { $exists: false } },
        { 'audioRecording.audioUrl': { $exists: false } },
        { 'audioRecording.audioUrl': '' }
      ]
    };

    const responsesWithoutAudio = await SurveyResponse.find(query)
      .select('_id responseId sessionId createdAt startedAt completedAt interviewMode')
      .sort({ createdAt: -1 })
      .limit(limit || 2000)
      .lean();

    console.log(`📊 Found ${responsesWithoutAudio.length} CAPI responses without audio\n`);

    // Get temp files
    const tempDir = path.join(__dirname, '../../uploads/temp');
    const tempFiles = fs.readdirSync(tempDir)
      .filter(f => f.match(/\.(m4a|webm|mp3)$/i))
      .map(f => {
        const filePath = path.join(tempDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime || stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);

    console.log(`📊 Found ${tempFiles.length} temp files\n`);

    // Match files to responses
    console.log('🔍 Matching files to responses...\n');
    const matches = [];

    // Match by responseId/sessionId
    for (const response of responsesWithoutAudio) {
      const matchingFiles = tempFiles.filter(f => {
        const filename = f.filename.toLowerCase();
        const responseId = (response.responseId || '').toLowerCase();
        const sessionId = (response.sessionId || '').toLowerCase();
        const mongoId = response._id.toString().toLowerCase();

        return filename.includes(responseId) ||
               filename.includes(sessionId) ||
               filename.includes(mongoId) ||
               filename.includes(sessionId?.replace('offline_', ''));
      });

      if (matchingFiles.length > 0) {
        const bestMatch = matchingFiles.sort((a, b) => b.modified - a.modified)[0];
        matches.push({
          response: response,
          file: bestMatch,
          matchType: response.responseId ? 'responseId' : 'sessionId',
          confidence: response.responseId ? 'high' : 'medium'
        });
      }
    }

    // Filter by confidence
    const confidenceLevels = { high: 3, medium: 2, low: 1 };
    const minConfidenceLevel = confidenceLevels[minConfidence];
    const filteredMatches = matches.filter(m => 
      confidenceLevels[m.confidence] >= minConfidenceLevel
    );

    console.log(`✅ Found ${filteredMatches.length} matches (filtered by confidence: ${minConfidence})\n`);

    if (filteredMatches.length === 0) {
      console.log('❌ No matches found. Exiting.');
      await mongoose.disconnect();
      return report;
    }

    // Process matches
    console.log(`🚀 Starting recovery (${dryRun ? 'DRY RUN' : 'LIVE'})...\n`);
    
    for (let i = 0; i < filteredMatches.length; i++) {
      const match = filteredMatches[i];
      console.log(`[${i + 1}/${filteredMatches.length}] Processing: ${match.file.filename.substring(0, 50)}...`);
      await uploadAndLink(match, dryRun);
      
      // Small delay to avoid overwhelming S3
      if (i % 10 === 0 && i > 0) {
        console.log(`   Processed ${i}/${filteredMatches.length} files...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    report.endTime = new Date();
    const duration = (report.endTime - report.startTime) / 1000;

    // Generate report
    const reportPath = path.join(__dirname, '../../recovery-report.json');
    const reportData = {
      summary: {
        startTime: report.startTime,
        endTime: report.endTime,
        duration: `${duration.toFixed(2)} seconds`,
        totalFiles: report.totalFiles,
        validated: report.validated,
        corrupted: report.corrupted,
        uploaded: report.uploaded,
        linked: report.linked,
        failed: report.failed,
        skipped: report.skipped,
        successRate: report.totalFiles > 0 ? `${((report.linked / report.totalFiles) * 100).toFixed(2)}%` : '0%'
      },
      details: report.details
    };

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📊 Report saved to: ${reportPath}\n`);

    // Print summary
    console.log('===========================================');
    console.log('📊 RECOVERY SUMMARY:');
    console.log('===========================================');
    console.log(`Total files processed: ${report.totalFiles}`);
    console.log(`✅ Validated: ${report.validated}`);
    console.log(`❌ Corrupted: ${report.corrupted}`);
    console.log(`📤 Uploaded to S3: ${report.uploaded}`);
    console.log(`🔗 Linked to responses: ${report.linked}`);
    console.log(`⏭️  Skipped (duplicates): ${report.skipped}`);
    console.log(`❌ Failed: ${report.failed}`);
    console.log(`Success rate: ${reportData.summary.successRate}`);
    console.log(`Duration: ${reportData.summary.duration}`);
    console.log('===========================================\n');

    await mongoose.disconnect();
    return report;

  } catch (error) {
    console.error('❌ Fatal error:', error);
    report.endTime = new Date();
    report.error = error.message;
    
    const reportPath = path.join(__dirname, '../../recovery-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: report,
      error: error.message,
      stack: error.stack
    }, null, 2));
    
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const minConfidence = args.find(arg => arg.startsWith('--confidence='))?.split('=')[1] || 'low';

  console.log('🚀 Starting Audio Recovery Process...\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will upload and link)'}`);
  console.log(`Limit: ${limit || 'unlimited'}`);
  console.log(`Min Confidence: ${minConfidence}\n`);

  recoverOrphanedAudio({
    dryRun: dryRun,
    limit: limit ? parseInt(limit) : null,
    minConfidence: minConfidence
  }).then(() => {
    console.log('✅ Recovery process completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Recovery failed:', error);
    process.exit(1);
  });
}

module.exports = { recoverOrphanedAudio, validateAudioFile, generateFileHash };




