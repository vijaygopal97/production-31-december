/**
 * Verify recovered audio files - check if they're complete and playable
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fileExistsInS3, getSignedUrl } = require('../utils/cloudStorage');
const SurveyResponse = require('../models/SurveyResponse');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

const BUCKET_NAME = 'convergent-audio-documents-bucket';

async function verifyRecoveredAudio() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get the specific response
    const responseId = 'c7a69172-3f21-42ab-82a9-9a4c0f87f1f8';
    const response = await SurveyResponse.findOne({ responseId })
      .select('audioRecording responseId')
      .lean();

    if (!response || !response.audioRecording || !response.audioRecording.audioUrl) {
      console.log('❌ Response or audio not found');
      await mongoose.disconnect();
      return;
    }

    const s3Key = response.audioRecording.audioUrl;
    console.log('📊 Checking recovered audio:');
    console.log(`  Response ID: ${responseId}`);
    console.log(`  S3 Key: ${s3Key}`);
    console.log('');

    // Check if file exists in temp
    const tempFile = path.join(__dirname, '../../uploads/temp/1767901295402-interview_ac47f551-821f-4770-8c10-0c131fd158d6_1767901241384.m4a');
    let tempFileSize = 0;
    let tempFileHash = null;
    
    if (fs.existsSync(tempFile)) {
      const tempStats = fs.statSync(tempFile);
      tempFileSize = tempStats.size;
      const tempBuffer = fs.readFileSync(tempFile);
      tempFileHash = crypto.createHash('md5').update(tempBuffer).digest('hex');
      console.log('✅ Temp file exists:');
      console.log(`  Size: ${tempFileSize} bytes (${(tempFileSize / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  MD5: ${tempFileHash}`);
    } else {
      console.log('⚠️  Temp file not found (may have been deleted)');
    }

    console.log('');

    // Check S3 file
    try {
      const s3Object = await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }).promise();

      console.log('✅ S3 file exists:');
      console.log(`  Size: ${s3Object.ContentLength} bytes (${(s3Object.ContentLength / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  ContentType: ${s3Object.ContentType}`);
      console.log(`  ETag: ${s3Object.ETag}`);
      console.log('');

      // Download first and last chunks to verify integrity
      console.log('🔍 Verifying file integrity...');
      
      // Download first 1KB
      const headChunk = await s3.getObject({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Range: 'bytes=0-1023'
      }).promise();

      // Download last 1KB
      const tailChunk = await s3.getObject({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Range: `bytes=${Math.max(0, s3Object.ContentLength - 1024)}-${s3Object.ContentLength - 1}`
      }).promise();

      console.log('✅ File chunks downloaded successfully');
      console.log(`  First 20 bytes (hex): ${headChunk.Body.slice(0, 20).toString('hex')}`);
      console.log(`  Last 20 bytes (hex): ${tailChunk.Body.slice(-20).toString('hex')}`);
      console.log('');

      // Check if file header is valid MP4/M4A
      const header = headChunk.Body.slice(0, 12);
      const isValidMP4 = header.toString('hex').includes('667479706d703432') || // ftypmp42
                        header.toString('hex').includes('667479704d344120'); // ftypM4A
      
      console.log('📋 File Format Check:');
      console.log(`  Valid MP4/M4A header: ${isValidMP4 ? '✅ YES' : '❌ NO'}`);
      console.log(`  Header (hex): ${header.toString('hex')}`);
      console.log('');

      // Compare sizes
      if (tempFileSize > 0) {
        const sizeMatch = tempFileSize === s3Object.ContentLength;
        console.log('📊 Size Comparison:');
        console.log(`  Temp file: ${tempFileSize} bytes`);
        console.log(`  S3 file: ${s3Object.ContentLength} bytes`);
        console.log(`  Match: ${sizeMatch ? '✅ YES' : '❌ NO (FILE MAY BE INCOMPLETE!)'}`);
        console.log('');
      }

      // Check if file is too small (likely incomplete)
      const minExpectedSize = 100 * 1024; // 100KB minimum for audio
      const isTooSmall = s3Object.ContentLength < minExpectedSize;
      console.log('📊 File Size Check:');
      console.log(`  Size: ${s3Object.ContentLength} bytes`);
      console.log(`  Minimum expected: ${minExpectedSize} bytes`);
      console.log(`  Too small: ${isTooSmall ? '⚠️  YES (may be incomplete)' : '✅ NO'}`);
      console.log('');

      if (!isValidMP4 || (tempFileSize > 0 && tempFileSize !== s3Object.ContentLength) || isTooSmall) {
        console.log('❌ FILE INTEGRITY ISSUES DETECTED!');
        console.log('  The file may be corrupted or incomplete.');
        console.log('  Recommendation: Re-upload from temp file if it still exists.');
      } else {
        console.log('✅ File appears to be valid');
        console.log('  If it still doesn\'t play, the issue may be in the frontend or proxy endpoint.');
      }

    } catch (s3Error) {
      console.error('❌ Error checking S3 file:', s3Error.message);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyRecoveredAudio();




