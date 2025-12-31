require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Check if S3 is configured
const isS3Configured = () => {
  return !!(process.env.AWS_ACCESS_KEY_ID && 
           process.env.AWS_SECRET_ACCESS_KEY && 
           process.env.AWS_S3_BUCKET_NAME);
};

// Check S3 for missing audio files
const checkS3Backup = async () => {
  try {
    console.log('🔍 Checking AWS S3 for audio file backups...\n');
    
    if (!isS3Configured()) {
      console.log('⚠️  S3 is not configured in environment variables');
      console.log('   AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set');
      console.log('   AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set');
      console.log('   AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || '❌ Not set');
      return;
    }
    
    console.log('✅ S3 is configured\n');
    
    // Initialize S3
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
    
    console.log(`📦 Bucket: ${BUCKET_NAME}`);
    console.log(`🌍 Region: ${process.env.AWS_REGION || 'us-east-1'}\n`);
    
    // List all audio files in S3
    console.log('📋 Listing audio files in S3...\n');
    
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: 'audio-recordings/'
    };
    
    const allObjects = [];
    let continuationToken = null;
    
    do {
      if (continuationToken) {
        params.ContinuationToken = continuationToken;
      }
      
      const data = await s3.listObjectsV2(params).promise();
      allObjects.push(...(data.Contents || []));
      continuationToken = data.NextContinuationToken;
    } while (continuationToken);
    
    console.log(`✅ Found ${allObjects.length} files in S3\n`);
    
    if (allObjects.length === 0) {
      console.log('⚠️  No audio files found in S3 bucket');
      console.log('   This suggests files were stored locally only\n');
      return;
    }
    
    // Read missing files list
    const missingFilesPath = path.join(__dirname, '../../missing-audio-files.json');
    let missingFiles = [];
    
    if (fs.existsSync(missingFilesPath)) {
      missingFiles = JSON.parse(fs.readFileSync(missingFilesPath, 'utf8'));
      console.log(`📝 Missing files to check: ${missingFiles.length}\n`);
    }
    
    // Match S3 files with missing files
    const matchedFiles = [];
    const audioDir = path.join(__dirname, '../../uploads/audio');
    
    for (const s3Object of allObjects) {
      const key = s3Object.Key;
      const filename = key.split('/').pop();
      
      // Check if this file is in the missing list
      const missingFile = missingFiles.find(mf => mf.filename === filename);
      
      if (missingFile) {
        console.log(`✅ Found missing file in S3: ${filename}`);
        
        // Download the file
        const downloadParams = {
          Bucket: BUCKET_NAME,
          Key: key
        };
        
        try {
          const data = await s3.getObject(downloadParams).promise();
          const destPath = path.join(audioDir, filename);
          
          fs.writeFileSync(destPath, data.Body);
          console.log(`   ✅ Downloaded to: ${destPath}`);
          matchedFiles.push(filename);
        } catch (error) {
          console.error(`   ❌ Error downloading ${filename}:`, error.message);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Files in S3: ${allObjects.length}`);
    console.log(`   Missing files checked: ${missingFiles.length}`);
    console.log(`   Files recovered from S3: ${matchedFiles.length}`);
    
    if (matchedFiles.length > 0) {
      console.log(`\n✅ Successfully recovered ${matchedFiles.length} files from S3!`);
    } else {
      console.log(`\n⚠️  No matching files found in S3`);
      console.log(`   This could mean:`);
      console.log(`   1. Files were never uploaded to S3 (local storage only)`);
      console.log(`   2. Files were deleted from S3`);
      console.log(`   3. Files are in a different bucket or path`);
    }
    
  } catch (error) {
    console.error('❌ Error checking S3:', error.message);
    if (error.code === 'NoSuchBucket') {
      console.error('   The S3 bucket does not exist');
    } else if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      console.error('   S3 credentials are invalid');
    }
  }
};

// Run the check
if (require.main === module) {
  checkS3Backup()
    .then(() => {
      console.log('\n✅ S3 check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ S3 check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkS3Backup };





