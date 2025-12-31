require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Match recovered files with missing files
const matchRecoveredFiles = async () => {
  try {
    console.log('🔍 Matching recovered files with missing files...\n');
    
    const RECOVERY_DIRS = [
      '/var/www/opine/recovery-output',
      '/var/www/opine/recovered-audio-photorec',
      '/var/www/opine/recovered-audio-live',
      '/var/www/opine/recovered-audio-deep',
      '/var/www/opine/recovered-audio-final'
    ];
    
    const AUDIO_DIR = '/var/www/opine/uploads/audio';
    const MISSING_FILES_JSON = '/var/www/opine/missing-audio-files.json';
    
    // Read missing files
    if (!fs.existsSync(MISSING_FILES_JSON)) {
      console.error('❌ Missing files JSON not found:', MISSING_FILES_JSON);
      return;
    }
    
    const missingFiles = JSON.parse(fs.readFileSync(MISSING_FILES_JSON, 'utf8'));
    console.log(`📝 Missing files to match: ${missingFiles.length}\n`);
    
    // Find all recovered files
    const recoveredFiles = [];
    
    for (const recoveryDir of RECOVERY_DIRS) {
      if (fs.existsSync(recoveryDir)) {
        console.log(`📁 Scanning: ${recoveryDir}`);
        
        // Find all audio files recursively
        const findAudioFiles = (dir) => {
          let files = [];
          try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
              const fullPath = path.join(dir, item);
              try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                  files = files.concat(findAudioFiles(fullPath));
                } else if (stat.isFile() && /\.(m4a|wav|webm|mp3)$/i.test(item)) {
                  files.push(fullPath);
                }
              } catch (e) {
                // Skip if can't read
              }
            }
          } catch (e) {
            // Skip if can't read directory
          }
          return files;
        };
        
        const files = findAudioFiles(recoveryDir);
        console.log(`   Found ${files.length} audio files`);
        recoveredFiles.push(...files);
      }
    }
    
    console.log(`\n✅ Total recovered files found: ${recoveredFiles.length}\n`);
    
    if (recoveredFiles.length === 0) {
      console.log('⚠️  No recovered files found. Run photorec first!');
      return;
    }
    
    // Match files
    let matchedCount = 0;
    const matchedFiles = [];
    
    console.log('🔍 Matching files...\n');
    
    for (const recoveredFile of recoveredFiles) {
      const filename = path.basename(recoveredFile);
      
      // Extract session ID from filename
      const sessionMatch = filename.match(/interview_([a-f0-9-]+)_/);
      if (!sessionMatch) continue;
      
      const sessionId = sessionMatch[1];
      
      // Find matching missing file
      const missingFile = missingFiles.find(mf => mf.sessionId === sessionId);
      
      if (missingFile) {
        const expectedFilename = missingFile.filename;
        const dest = path.join(AUDIO_DIR, expectedFilename);
        
        // Check file size to verify it's valid
        try {
          const stats = fs.statSync(recoveredFile);
          if (stats.size > 1000) { // At least 1KB
            if (!fs.existsSync(dest)) {
              fs.copyFileSync(recoveredFile, dest);
              console.log(`✅ Matched and copied: ${expectedFilename}`);
              console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
              console.log(`   Source: ${recoveredFile}`);
              matchedFiles.push({
                filename: expectedFilename,
                sessionId,
                size: stats.size,
                source: recoveredFile
              });
              matchedCount++;
            } else {
              console.log(`⚠️  File already exists: ${expectedFilename}`);
            }
          } else {
            console.log(`⚠️  File too small (likely corrupted): ${filename} (${stats.size} bytes)`);
          }
        } catch (error) {
          console.error(`❌ Error copying ${filename}:`, error.message);
        }
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MATCHING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total recovered files: ${recoveredFiles.length}`);
    console.log(`Files matched: ${matchedCount}`);
    console.log(`Files still missing: ${missingFiles.length - matchedCount}`);
    
    if (matchedCount > 0) {
      console.log('\n✅ Successfully recovered files:');
      matchedFiles.forEach(mf => {
        console.log(`   - ${mf.filename} (${(mf.size / 1024).toFixed(2)} KB)`);
      });
    }
    
    // Save matching report
    const reportPath = '/var/www/opine/recovery-matching-report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      matchedFiles,
      totalRecovered: recoveredFiles.length,
      matchedCount,
      stillMissing: missingFiles.length - matchedCount
    }, null, 2));
    
    console.log(`\n📝 Report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error matching files:', error);
  }
};

// Run
if (require.main === module) {
  matchRecoveredFiles()
    .then(() => {
      console.log('\n✅ Matching completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Matching failed:', error);
      process.exit(1);
    });
}

module.exports = { matchRecoveredFiles };

