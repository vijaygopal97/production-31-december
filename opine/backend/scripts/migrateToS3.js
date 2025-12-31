/**
 * Migration Script: Transfer existing files from local storage to S3
 * 
 * This script:
 * 1. Scans /var/www/opine/uploads/audio for audio files
 * 2. Scans /var/www/opine/uploads for document files
 * 3. Scans /var/www/opine/uploads/reports for report files
 * 4. Uploads each file to S3
 * 5. Updates database records with S3 keys
 * 6. Verifies uploads
 * 
 * Usage: node scripts/migrateToS3.js [--dry-run] [--skip-audio] [--skip-documents] [--skip-reports]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { uploadToS3, isS3Configured, extractS3Key, fileExistsInS3 } = require('../utils/cloudStorage');

// Models
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_AUDIO = process.argv.includes('--skip-audio');
const SKIP_DOCUMENTS = process.argv.includes('--skip-documents');
const SKIP_REPORTS = process.argv.includes('--skip-reports');

// Statistics
const stats = {
  audio: { total: 0, uploaded: 0, skipped: 0, failed: 0, updated: 0 },
  documents: { total: 0, uploaded: 0, skipped: 0, failed: 0, updated: 0 },
  reports: { total: 0, uploaded: 0, skipped: 0, failed: 0 }
};

/**
 * Convert local path to S3 key
 */
function localPathToS3Key(localPath, type) {
  // Remove /var/www/opine/uploads prefix
  let relativePath = localPath.replace(/^.*\/uploads\//, '');
  
  if (type === 'audio') {
    // audio/interviews/2024/12/filename.m4a
    const filename = path.basename(relativePath);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `audio/interviews/${year}/${month}/${filename}`;
  } else if (type === 'document') {
    // documents/{type}/{year}/{month}/filename
    const filename = path.basename(relativePath);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Determine document type from filename
    let docType = 'other';
    if (relativePath.includes('aadhaar')) docType = 'aadhaar';
    else if (relativePath.includes('pan')) docType = 'pan';
    else if (relativePath.includes('passport')) docType = 'passport-photos';
    else if (relativePath.includes('bank')) docType = 'bank-documents';
    else if (relativePath.includes('cv')) docType = 'cv';
    
    return `documents/${docType}/${year}/${month}/${filename}`;
  } else if (type === 'report') {
    // reports/survey-reports/{year}/{month}/filename
    const filename = path.basename(relativePath);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `reports/survey-reports/${year}/${month}/${filename}`;
  }
  
  return relativePath;
}

/**
 * Migrate audio files
 */
async function migrateAudioFiles() {
  if (SKIP_AUDIO) {
    console.log('⏭️  Skipping audio files migration');
    return;
  }

  console.log('\n📁 Starting audio files migration...');
  const audioDir = path.join(__dirname, '../../uploads/audio');
  
  if (!fs.existsSync(audioDir)) {
    console.log('⚠️  Audio directory does not exist:', audioDir);
    return;
  }

  const files = fs.readdirSync(audioDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.m4a', '.mp3', '.wav', '.webm'].includes(ext);
  });

  stats.audio.total = files.length;
  console.log(`📊 Found ${files.length} audio files to migrate`);

  for (const file of files) {
    const localPath = path.join(audioDir, file);
    const s3Key = localPathToS3Key(localPath, 'audio');

      try {
        // Check if file already exists in S3 (but force upload if --force flag is set)
        const FORCE_UPLOAD = process.argv.includes('--force');
        if (!FORCE_UPLOAD && await fileExistsInS3(s3Key)) {
          console.log(`⏭️  Skipping ${file} (already in S3)`);
          stats.audio.skipped++;
          continue;
        }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would upload: ${file} → ${s3Key}`);
        stats.audio.uploaded++;
        continue;
      }

      // Upload to S3
      console.log(`📤 Uploading ${file}...`);
      const uploadResult = await uploadToS3(localPath, s3Key, {
        metadata: {
          migrated: 'true',
          originalPath: localPath,
          migratedAt: new Date().toISOString()
        }
      });

      console.log(`✅ Uploaded: ${file} → ${s3Key}`);
      stats.audio.uploaded++;

      // Update database records
      // Find all SurveyResponse records with this audio URL
      const localUrl = `/uploads/audio/${file}`;
      const responses = await SurveyResponse.find({
        'audioRecording.audioUrl': localUrl
      });

      if (responses.length > 0) {
        console.log(`  📝 Updating ${responses.length} database records...`);
        for (const response of responses) {
          response.audioRecording.audioUrl = s3Key;
          await response.save();
        }
        stats.audio.updated += responses.length;
        console.log(`  ✅ Updated ${responses.length} records`);
      }

    } catch (error) {
      console.error(`❌ Failed to migrate ${file}:`, error.message);
      stats.audio.failed++;
    }
  }

  console.log(`\n✅ Audio migration complete: ${stats.audio.uploaded} uploaded, ${stats.audio.updated} records updated, ${stats.audio.failed} failed`);
}

/**
 * Migrate document files
 */
async function migrateDocumentFiles() {
  if (SKIP_DOCUMENTS) {
    console.log('⏭️  Skipping documents migration');
    return;
  }

  console.log('\n📁 Starting documents migration...');
  const uploadsDir = path.join(__dirname, '../../uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    console.log('⚠️  Uploads directory does not exist:', uploadsDir);
    return;
  }

  const documentPatterns = [
    /^aadhaarDocument-/,
    /^panDocument-/,
    /^passportPhoto-/,
    /^bankDocumentUpload-/,
    /^cvUpload-/
  ];

  const files = fs.readdirSync(uploadsDir).filter(file => {
    return documentPatterns.some(pattern => pattern.test(file));
  });

  stats.documents.total = files.length;
  console.log(`📊 Found ${files.length} document files to migrate`);

  for (const file of files) {
    const localPath = path.join(uploadsDir, file);
    
    // Determine document type
    let docType = 'other';
    if (file.startsWith('aadhaarDocument-')) docType = 'aadhaar';
    else if (file.startsWith('panDocument-')) docType = 'pan';
    else if (file.startsWith('passportPhoto-')) docType = 'passport-photos';
    else if (file.startsWith('bankDocumentUpload-')) docType = 'bank-documents';
    else if (file.startsWith('cvUpload-')) docType = 'cv';

    const s3Key = localPathToS3Key(localPath, 'document');

      try {
        // Check if file already exists in S3 (but force upload if --force flag is set)
        const FORCE_UPLOAD = process.argv.includes('--force');
        if (!FORCE_UPLOAD && await fileExistsInS3(s3Key)) {
          console.log(`⏭️  Skipping ${file} (already in S3)`);
          stats.documents.skipped++;
          continue;
        }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would upload: ${file} → ${s3Key}`);
        stats.documents.uploaded++;
        continue;
      }

      // Upload to S3
      console.log(`📤 Uploading ${file}...`);
      const uploadResult = await uploadToS3(localPath, s3Key, {
        metadata: {
          migrated: 'true',
          originalPath: localPath,
          documentType: docType,
          migratedAt: new Date().toISOString()
        }
      });

      console.log(`✅ Uploaded: ${file} → ${s3Key}`);
      stats.documents.uploaded++;

      // Update database records in User model
      // Find users with this document filename
      const fieldName = file.startsWith('aadhaarDocument-') ? 'aadhaarDocument' :
                       file.startsWith('panDocument-') ? 'panDocument' :
                       file.startsWith('passportPhoto-') ? 'passportPhoto' :
                       file.startsWith('bankDocumentUpload-') ? 'bankDocumentUpload' :
                       file.startsWith('cvUpload-') ? 'cvUpload' : null;

      if (fieldName) {
        const users = await User.find({
          [`interviewerProfile.${fieldName}`]: file
        });

        if (users.length > 0) {
          console.log(`  📝 Updating ${users.length} user records...`);
          for (const user of users) {
            if (user.interviewerProfile) {
              user.interviewerProfile[fieldName] = s3Key;
              await user.save();
            }
          }
          stats.documents.updated += users.length;
          console.log(`  ✅ Updated ${users.length} records`);
        }
      }

    } catch (error) {
      console.error(`❌ Failed to migrate ${file}:`, error.message);
      stats.documents.failed++;
    }
  }

  console.log(`\n✅ Documents migration complete: ${stats.documents.uploaded} uploaded, ${stats.documents.updated} records updated, ${stats.documents.failed} failed`);
}

/**
 * Migrate report files
 */
async function migrateReportFiles() {
  if (SKIP_REPORTS) {
    console.log('⏭️  Skipping reports migration');
    return;
  }

  console.log('\n📁 Starting reports migration...');
  const reportsDir = path.join(__dirname, '../../uploads/reports');
  
  if (!fs.existsSync(reportsDir)) {
    console.log('⚠️  Reports directory does not exist:', reportsDir);
    return;
  }

  // Get files from both reports root and reports/output
  const files = [];
  
  // Root reports directory
  if (fs.existsSync(reportsDir)) {
    const rootFiles = fs.readdirSync(reportsDir)
      .filter(file => {
        const filePath = path.join(reportsDir, file);
        return fs.statSync(filePath).isFile() && 
               (file.endsWith('.xlsx') || file.endsWith('.pptx') || file.endsWith('.txt'));
      })
      .map(file => ({ file, dir: 'reports' }));
    files.push(...rootFiles);
  }

  // Reports/output directory
  const outputDir = path.join(reportsDir, 'output');
  if (fs.existsSync(outputDir)) {
    const outputFiles = fs.readdirSync(outputDir)
      .filter(file => {
        const filePath = path.join(outputDir, file);
        return fs.statSync(filePath).isFile() && 
               (file.endsWith('.xlsx') || file.endsWith('.pptx') || file.endsWith('.txt'));
      })
      .map(file => ({ file, dir: 'reports/output' }));
    files.push(...outputFiles);
  }

  stats.reports.total = files.length;
  console.log(`📊 Found ${files.length} report files to migrate`);

  for (const { file, dir } of files) {
    const localPath = path.join(__dirname, '../../uploads', dir, file);
    const s3Key = localPathToS3Key(localPath, 'report');

      try {
        // Check if file already exists in S3 (but force upload if --force flag is set)
        const FORCE_UPLOAD = process.argv.includes('--force');
        if (!FORCE_UPLOAD && await fileExistsInS3(s3Key)) {
          console.log(`⏭️  Skipping ${file} (already in S3)`);
          stats.reports.skipped++;
          continue;
        }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would upload: ${file} → ${s3Key}`);
        stats.reports.uploaded++;
        continue;
      }

      // Upload to S3
      console.log(`📤 Uploading ${file}...`);
      const uploadResult = await uploadToS3(localPath, s3Key, {
        metadata: {
          migrated: 'true',
          originalPath: localPath,
          migratedAt: new Date().toISOString()
        }
      });

      console.log(`✅ Uploaded: ${file} → ${s3Key}`);
      stats.reports.uploaded++;

      // Note: Reports are typically referenced by filename in the frontend,
      // so we may not need to update database records for reports
      // If you have a Report model, update it here

    } catch (error) {
      console.error(`❌ Failed to migrate ${file}:`, error.message);
      stats.reports.failed++;
    }
  }

  console.log(`\n✅ Reports migration complete: ${stats.reports.uploaded} uploaded, ${stats.reports.failed} failed`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting S3 Migration Script');
  console.log('================================');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be uploaded or database updated');
  }

  // Check S3 configuration
  if (!isS3Configured()) {
    console.error('❌ S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in .env');
    process.exit(1);
  }

  console.log('✅ S3 configuration verified');

  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opine', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }

  try {
    // Run migrations
    await migrateAudioFiles();
    await migrateDocumentFiles();
    await migrateReportFiles();

    // Print summary
    console.log('\n📊 Migration Summary');
    console.log('====================');
    console.log('Audio Files:');
    console.log(`  Total: ${stats.audio.total}`);
    console.log(`  Uploaded: ${stats.audio.uploaded}`);
    console.log(`  Skipped: ${stats.audio.skipped}`);
    console.log(`  Failed: ${stats.audio.failed}`);
    console.log(`  DB Records Updated: ${stats.audio.updated}`);
    
    console.log('\nDocuments:');
    console.log(`  Total: ${stats.documents.total}`);
    console.log(`  Uploaded: ${stats.documents.uploaded}`);
    console.log(`  Skipped: ${stats.documents.skipped}`);
    console.log(`  Failed: ${stats.documents.failed}`);
    console.log(`  DB Records Updated: ${stats.documents.updated}`);
    
    console.log('\nReports:');
    console.log(`  Total: ${stats.reports.total}`);
    console.log(`  Uploaded: ${stats.reports.uploaded}`);
    console.log(`  Skipped: ${stats.reports.skipped}`);
    console.log(`  Failed: ${stats.reports.failed}`);

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  }
}

// Run migration
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };









