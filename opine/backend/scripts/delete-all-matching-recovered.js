/**
 * Delete all files that match responses that were successfully recovered
 * This will catch the skipped files
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../uploads/temp');
const REPORT_FILE = path.join(__dirname, '../../orphaned-files-cleanup-report.json');
const DELETION_REPORT_FILE = path.join(__dirname, '../../skipped-files-deletion-report.json');

async function deleteMatchingFiles() {
  try {
    // Load recovery report
    const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
    const successful = report.recovery.details.filter(d => d.status === 'success');
    const successfulFilenames = new Set(successful.map(d => d.filename));
    const successfulResponseIds = new Set(successful.map(d => d.responseId).filter(Boolean));

    console.log('✅ Loaded recovery report');
    console.log(`  Successful recoveries: ${successful.length}`);
    console.log(`  Unique responses recovered: ${successfulResponseIds.size}\n`);

    // Get all temp files
    const tempFiles = fs.readdirSync(TEMP_DIR)
      .filter(f => f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.webm'));

    console.log(`📊 Total temp files: ${tempFiles.length}`);

    // Find files that match recovered responses but weren't successfully recovered
    console.log('🔍 Finding files matching recovered responses...\n');
    const filesToDelete = [];

    for (const filename of tempFiles) {
      // Skip if this file was successfully recovered
      if (successfulFilenames.has(filename)) {
        continue;
      }

      // Check if file matches a recovered responseId
      const responseIdMatch = filename.match(/interview_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})_/);
      if (responseIdMatch && successfulResponseIds.has(responseIdMatch[1])) {
        filesToDelete.push({
          filename,
          responseId: responseIdMatch[1],
          reason: 'matches recovered response - duplicate/skipped'
        });
      }
    }

    console.log(`  Found ${filesToDelete.length} files matching recovered responses\n`);

    if (filesToDelete.length === 0) {
      console.log('⚠️  No matching files found.');
      console.log('   The skipped files may have been deleted already or match via sessionId.\n');
      return;
    }

    // Delete files
    console.log('🗑️  Deleting files...');
    const deletionReport = {
      startTime: new Date().toISOString(),
      totalFiles: filesToDelete.length,
      deleted: 0,
      failed: 0,
      totalSize: 0,
      details: []
    };

    for (let i = 0; i < filesToDelete.length; i += 500) {
      const batch = filesToDelete.slice(i, i + 500);
      
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
          if (deletionReport.failed <= 10) {
            console.error(`  Failed to delete ${file.filename}:`, error.message);
          }
        }
      }

      if ((i + 500) % 1000 === 0 || i + 500 >= filesToDelete.length) {
        console.log(`  Deleted ${Math.min(i + 500, filesToDelete.length)}/${filesToDelete.length} files...`);
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
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteMatchingFiles();




