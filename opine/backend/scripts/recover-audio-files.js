require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import models
const SurveyResponse = require('../models/SurveyResponse');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Extract filename from audioUrl
const extractFilename = (audioUrl) => {
  if (!audioUrl) return null;
  
  // Handle different URL formats
  // Format: /uploads/audio/filename.ext
  // Format: /uploads/audio/interview_sessionId_timestamp.ext
  if (audioUrl.includes('/uploads/audio/')) {
    return audioUrl.split('/uploads/audio/')[1];
  }
  
  // Handle S3 URLs (if any)
  if (audioUrl.includes('amazonaws.com')) {
    const parts = audioUrl.split('/');
    return parts[parts.length - 1];
  }
  
  // If it's just a filename
  if (audioUrl.includes('interview_')) {
    return audioUrl;
  }
  
  return null;
};

// Main recovery function
const recoverAudioFiles = async () => {
  try {
    console.log('🔍 Starting audio file recovery process...\n');
    
    // Connect to database
    await connectDB();
    
    // Query all CAPI interviews with audio recordings
    console.log('📊 Querying database for CAPI interviews with audio recordings...');
    const capiResponses = await SurveyResponse.find({
      interviewMode: 'capi',
      'audioRecording.hasAudio': true,
      'audioRecording.audioUrl': { $exists: true, $ne: null }
    }).select('sessionId audioRecording createdAt').lean();
    
    console.log(`✅ Found ${capiResponses.length} CAPI interviews with audio recordings\n`);
    
    // Get all existing files in the audio directory
    const audioDir = path.join(__dirname, '../../uploads/audio');
    let existingFiles = [];
    
    if (fs.existsSync(audioDir)) {
      existingFiles = fs.readdirSync(audioDir);
      console.log(`📁 Found ${existingFiles.length} existing files in audio directory\n`);
    } else {
      console.log('⚠️  Audio directory does not exist, creating it...');
      fs.mkdirSync(audioDir, { recursive: true });
      console.log('✅ Created audio directory\n');
    }
    
    // Extract filenames from database URLs and identify missing files
    const missingFiles = [];
    const foundFiles = [];
    const databaseUrls = [];
    
    console.log('🔍 Analyzing audio URLs from database...\n');
    
    for (const response of capiResponses) {
      const audioUrl = response.audioRecording?.audioUrl;
      if (!audioUrl) continue;
      
      const filename = extractFilename(audioUrl);
      if (!filename) {
        console.log(`⚠️  Could not extract filename from URL: ${audioUrl}`);
        continue;
      }
      
      databaseUrls.push({
        sessionId: response.sessionId,
        audioUrl,
        filename,
        createdAt: response.createdAt
      });
      
      if (existingFiles.includes(filename)) {
        foundFiles.push(filename);
      } else {
        missingFiles.push({
          sessionId: response.sessionId,
          audioUrl,
          filename,
          createdAt: response.createdAt
        });
      }
    }
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`   ✅ Found in filesystem: ${foundFiles.length}`);
    console.log(`   ❌ Missing from filesystem: ${missingFiles.length}`);
    console.log(`   📝 Total in database: ${databaseUrls.length}\n`);
    
    // Save missing files list to a JSON file
    const missingFilesPath = path.join(__dirname, '../../missing-audio-files.json');
    fs.writeFileSync(missingFilesPath, JSON.stringify(missingFiles, null, 2));
    console.log(`💾 Saved missing files list to: ${missingFilesPath}\n`);
    
    if (missingFiles.length === 0) {
      console.log('✅ All audio files are present! No recovery needed.');
      await mongoose.disconnect();
      return;
    }
    
    // Display missing files
    console.log('❌ Missing Files:');
    console.log('='.repeat(80));
    missingFiles.slice(0, 20).forEach((file, index) => {
      console.log(`${index + 1}. ${file.filename}`);
      console.log(`   Session ID: ${file.sessionId}`);
      console.log(`   Created: ${file.createdAt}`);
      console.log(`   URL: ${file.audioUrl}`);
      console.log('');
    });
    
    if (missingFiles.length > 20) {
      console.log(`... and ${missingFiles.length - 20} more files\n`);
    }
    
    // Attempt data recovery
    console.log('\n🔧 Attempting data recovery...\n');
    
    // Method 1: Check if files are in trash/recycle bin
    console.log('1️⃣ Checking for files in system trash...');
    try {
      const trashPaths = [
        '/home/azureuser/.local/share/Trash/files',
        '/home/azureuser/.Trash',
        '/root/.local/share/Trash/files',
        '/root/.Trash'
      ];
      
      let foundInTrash = 0;
      for (const trashPath of trashPaths) {
        if (fs.existsSync(trashPath)) {
          const trashFiles = fs.readdirSync(trashPath, { recursive: true });
          for (const missingFile of missingFiles) {
            if (trashFiles.includes(missingFile.filename)) {
              const trashFilePath = path.join(trashPath, missingFile.filename);
              const destPath = path.join(audioDir, missingFile.filename);
              fs.copyFileSync(trashFilePath, destPath);
              console.log(`   ✅ Recovered from trash: ${missingFile.filename}`);
              foundInTrash++;
            }
          }
        }
      }
      
      if (foundInTrash > 0) {
        console.log(`\n✅ Recovered ${foundInTrash} files from trash!\n`);
      } else {
        console.log('   ℹ️  No files found in trash\n');
      }
    } catch (error) {
      console.log(`   ⚠️  Error checking trash: ${error.message}\n`);
    }
    
    // Method 2: Use testdisk/photorec for advanced recovery
    console.log('2️⃣ Checking for data recovery tools...');
    
    const recoveryMethods = [];
    
    // Check for testdisk/photorec
    try {
      execSync('which photorec', { stdio: 'ignore' });
      recoveryMethods.push('photorec');
      console.log('   ✅ photorec is available');
    } catch (e) {
      console.log('   ⚠️  photorec not found (install with: sudo apt-get install testdisk)');
    }
    
    // Check for extundelete
    try {
      execSync('which extundelete', { stdio: 'ignore' });
      recoveryMethods.push('extundelete');
      console.log('   ✅ extundelete is available');
    } catch (e) {
      console.log('   ⚠️  extundelete not found');
    }
    
    // Check for foremost
    try {
      execSync('which foremost', { stdio: 'ignore' });
      recoveryMethods.push('foremost');
      console.log('   ✅ foremost is available');
    } catch (e) {
      console.log('   ⚠️  foremost not found');
    }
    
    // Check for scalpel
    try {
      execSync('which scalpel', { stdio: 'ignore' });
      recoveryMethods.push('scalpel');
      console.log('   ✅ scalpel is available');
    } catch (e) {
      console.log('   ⚠️  scalpel not found');
    }
    
    if (recoveryMethods.length === 0) {
      console.log('\n⚠️  No advanced recovery tools found. Installing photorec...\n');
      console.log('   Run the following command to install recovery tools:');
      console.log('   sudo apt-get update && sudo apt-get install -y testdisk');
      console.log('\n   Then run this script again.\n');
    } else {
      console.log(`\n✅ Found ${recoveryMethods.length} recovery tool(s): ${recoveryMethods.join(', ')}\n`);
      
      // Create recovery script
      const recoveryScriptPath = path.join(__dirname, '../../recover-audio-advanced.sh');
      const recoveryOutputDir = path.join(__dirname, '../../recovered-audio');
      
      const recoveryScript = `#!/bin/bash
# Advanced Audio Recovery Script
# Generated automatically by recover-audio-files.js

set -e

RECOVERY_DIR="${recoveryOutputDir}"
AUDIO_DIR="${audioDir}"
MISSING_COUNT=${missingFiles.length}

echo "🔧 Starting advanced audio recovery..."
echo "📁 Recovery output directory: \$RECOVERY_DIR"
echo "📁 Target audio directory: \$AUDIO_DIR"
echo "📊 Missing files to recover: \$MISSING_COUNT"
echo ""

# Create recovery output directory
mkdir -p "\$RECOVERY_DIR"

# Get the filesystem device for the uploads directory
DEVICE=$(df "${audioDir}" | tail -1 | awk '{print $1}')
echo "💾 Filesystem device: \$DEVICE"
echo ""

# Method 1: Use photorec to recover audio files
if command -v photorec &> /dev/null; then
    echo "1️⃣ Attempting recovery with photorec..."
    echo "   This will create a recovery session. Follow the prompts:"
    echo "   - Select the partition containing \$DEVICE"
    echo "   - Choose 'File Opt' -> 'Audio' -> 'mp3, wav, m4a, webm'"
    echo "   - Set output directory to: \$RECOVERY_DIR"
    echo ""
    echo "   Running photorec in non-interactive mode..."
    
    # Create photorec configuration for non-interactive mode
    # Note: photorec doesn't have great non-interactive support, so we'll use foremost instead
fi

# Method 2: Use foremost to recover audio files
if command -v foremost &> /dev/null; then
    echo "2️⃣ Attempting recovery with foremost..."
    
    # Create foremost config for audio files
    FOREmost_CONFIG="/tmp/foremost-audio.conf"
    cat > "\$FOREmost_CONFIG" << 'EOF'
# Foremost configuration for audio files
m4a     y   2000000    \\.m4a
wav     y   20000000   \\.wav
webm    y   20000000   \\.webm
mp3     y   20000000   \\.mp3
EOF
    
    # Run foremost
    foremost -t m4a,wav,webm,mp3 -i "\$DEVICE" -o "\$RECOVERY_DIR/foremost" -c "\$FOREmost_CONFIG"
    
    echo "✅ Foremost recovery completed. Check: \$RECOVERY_DIR/foremost"
fi

# Method 3: Use scalpel for recovery
if command -v scalpel &> /dev/null; then
    echo "3️⃣ Attempting recovery with scalpel..."
    
    # Create scalpel config
    SCALPEL_CONFIG="/tmp/scalpel-audio.conf"
    cat > "\$SCALPEL_CONFIG" << 'EOF'
# Scalpel configuration for audio files
m4a     y   2000000    \\.m4a
wav     y   20000000   \\.wav
webm    y   20000000   \\.webm
mp3     y   20000000   \\.mp3
EOF
    
    scalpel -c "\$SCALPEL_CONFIG" -o "\$RECOVERY_DIR/scalpel" "\$DEVICE"
    
    echo "✅ Scalpel recovery completed. Check: \$RECOVERY_DIR/scalpel"
fi

echo ""
echo "📋 Next steps:"
echo "1. Review recovered files in: \$RECOVERY_DIR"
echo "2. Match recovered files with missing files list: missing-audio-files.json"
echo "3. Copy matching files to: \$AUDIO_DIR"
echo ""
echo "To match files, you can use the sessionId pattern: interview_{sessionId}_*.{ext}"
`;

      fs.writeFileSync(recoveryScriptPath, recoveryScript);
      fs.chmodSync(recoveryScriptPath, '755');
      
      console.log(`📝 Created advanced recovery script: ${recoveryScriptPath}`);
      console.log(`   Run it with: sudo bash ${recoveryScriptPath}\n`);
    }
    
    // Method 3: Check for backup files
    console.log('3️⃣ Checking for backup files...');
    const backupDirs = [
      '/var/backups',
      '/home/azureuser/backups',
      '/root/backups',
      path.join(__dirname, '../../backups')
    ];
    
    let foundInBackups = 0;
    for (const backupDir of backupDirs) {
      if (fs.existsSync(backupDir)) {
        try {
          const backupFiles = fs.readdirSync(backupDir, { recursive: true });
          for (const missingFile of missingFiles) {
            const matchingBackup = backupFiles.find(f => 
              f.includes(missingFile.filename) || 
              f.includes(missingFile.sessionId)
            );
            
            if (matchingBackup) {
              const backupPath = path.join(backupDir, matchingBackup);
              const destPath = path.join(audioDir, missingFile.filename);
              
              if (fs.existsSync(backupPath) && fs.statSync(backupPath).isFile()) {
                fs.copyFileSync(backupPath, destPath);
                console.log(`   ✅ Recovered from backup: ${missingFile.filename}`);
                foundInBackups++;
              }
            }
          }
        } catch (error) {
          // Skip if can't read directory
        }
      }
    }
    
    if (foundInBackups > 0) {
      console.log(`\n✅ Recovered ${foundInBackups} files from backups!\n`);
    } else {
      console.log('   ℹ️  No matching files found in backup directories\n');
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 RECOVERY SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total CAPI interviews with audio: ${capiResponses.length}`);
    console.log(`Files found in filesystem: ${foundFiles.length}`);
    console.log(`Files missing: ${missingFiles.length}`);
    console.log(`\n📝 Missing files list saved to: ${missingFilesPath}`);
    
    if (recoveryMethods.length > 0) {
      console.log(`\n🔧 Advanced recovery script created: ${recoveryScriptPath}`);
      console.log(`   Run with: sudo bash ${recoveryScriptPath}`);
    }
    
    console.log('\n💡 Additional Recovery Options:');
    console.log('   1. Check if you have any system backups (rsync, tar, etc.)');
    console.log('   2. Check cloud storage backups if S3 was configured');
    console.log('   3. Use the advanced recovery script with photorec/foremost');
    console.log('   4. Check server logs for file deletion timestamps');
    console.log('   5. Contact your hosting provider for filesystem snapshots');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error during recovery process:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  }
};

// Run the recovery
if (require.main === module) {
  recoverAudioFiles()
    .then(() => {
      console.log('\n✅ Recovery process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Recovery process failed:', error);
      process.exit(1);
    });
}

module.exports = { recoverAudioFiles };





