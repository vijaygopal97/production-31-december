/**
 * Test S3 Connection Script
 * 
 * This script tests the S3 connection and credentials
 * Usage: node scripts/testS3Connection.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { uploadToS3, getSignedUrl, isS3Configured, listFilesInS3, BUCKET_NAME } = require('../utils/cloudStorage');
const fs = require('fs');
const path = require('path');

async function testS3Connection() {
  console.log('🧪 Testing S3 Connection');
  console.log('========================\n');

  // Check configuration
  if (!isS3Configured()) {
    console.error('❌ S3 is not configured');
    console.error('   Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in .env');
    process.exit(1);
  }

  console.log('✅ S3 Configuration:');
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Region: ${process.env.AWS_REGION || 'ap-south-1'}`);
  console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}\n`);

  try {
    // Test 1: List files in bucket
    console.log('📋 Test 1: Listing files in bucket...');
    const files = await listFilesInS3('');
    console.log(`✅ Successfully connected to S3 bucket`);
    console.log(`   Found ${files.length} files in bucket\n`);

    // Test 2: Upload a test file
    console.log('📤 Test 2: Uploading test file...');
    const testContent = Buffer.from('This is a test file for S3 connection verification');
    const uploadsDir = path.join(__dirname, '../../../uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const testFilePath = path.join(uploadsDir, 'test-s3-connection.txt');
    
    // Create test file
    fs.writeFileSync(testFilePath, testContent);
    
    const testKey = `test/connection-test-${Date.now()}.txt`;
    const uploadResult = await uploadToS3(testFilePath, testKey, {
      contentType: 'text/plain',
      metadata: {
        test: 'true',
        uploadedAt: new Date().toISOString()
      }
    });
    
    console.log(`✅ Test file uploaded successfully`);
    console.log(`   S3 Key: ${uploadResult.key}`);
    console.log(`   URL: ${uploadResult.url}\n`);

    // Test 3: Generate signed URL
    console.log('🔗 Test 3: Generating signed URL...');
    const signedUrl = await getSignedUrl(uploadResult.key, 3600);
    console.log(`✅ Signed URL generated successfully`);
    console.log(`   URL: ${signedUrl.substring(0, 100)}...\n`);

    // Cleanup test file
    fs.unlinkSync(testFilePath);
    console.log('🧹 Cleaned up local test file\n');

    console.log('✅ All S3 tests passed!');
    console.log('   Your S3 configuration is working correctly.\n');

  } catch (error) {
    console.error('❌ S3 connection test failed:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    
    if (error.code === 'AccessDenied') {
      console.error('\n💡 Tip: Check your IAM user permissions');
      console.error('   The user needs: s3:PutObject, s3:GetObject, s3:ListBucket permissions');
    } else if (error.code === 'NoSuchBucket') {
      console.error('\n💡 Tip: Check your bucket name');
      console.error(`   Current bucket: ${BUCKET_NAME}`);
    } else if (error.code === 'InvalidAccessKeyId') {
      console.error('\n💡 Tip: Check your AWS_ACCESS_KEY_ID in .env');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.error('\n💡 Tip: Check your AWS_SECRET_ACCESS_KEY in .env');
    }
    
    process.exit(1);
  }
}

// Run test
testS3Connection().catch(console.error);









