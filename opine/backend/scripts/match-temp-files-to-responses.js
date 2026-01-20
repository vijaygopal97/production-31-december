/**
 * Match temp files to responses without audio
 * This helps recover lost audio data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { uploadToS3, generateAudioKey } = require('../utils/cloudStorage');
const SurveyResponse = require('../models/SurveyResponse');

async function matchTempFilesToResponses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get responses without audio
    const responsesWithoutAudio = await SurveyResponse.find({
      interviewMode: 'capi',
      $or: [
        { 'audioRecording.hasAudio': { $ne: true } },
        { 'audioRecording.hasAudio': { $exists: false } },
        { 'audioRecording.audioUrl': { $exists: false } },
        { 'audioRecording.audioUrl': '' }
      ]
    })
    .select('_id responseId sessionId createdAt startedAt completedAt')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

    console.log(`📊 Found ${responsesWithoutAudio.length} responses without audio\n`);

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
    console.log('🔍 Attempting to match files to responses...\n');

    let matches = [];
    let checked = 0;

    // Try to match by responseId in filename
    for (const response of responsesWithoutAudio) {
      if (!response.responseId) continue;
      
      // Look for files with this responseId
      const matchingFiles = tempFiles.filter(f => 
        f.filename.includes(response.responseId) ||
        f.filename.includes(response._id.toString())
      );

      if (matchingFiles.length > 0) {
        // Use the most recent file
        const bestMatch = matchingFiles.sort((a, b) => b.modified - a.modified)[0];
        matches.push({
          response: response,
          file: bestMatch,
          matchType: 'responseId',
          confidence: 'high'
        });
        console.log(`✅ Matched: ${bestMatch.filename.substring(0, 60)}`);
        console.log(`   → Response: ${response.responseId || response._id}`);
        console.log(`   → Date: ${bestMatch.modified.toISOString()}`);
        console.log(`   → Size: ${(bestMatch.size / 1024 / 1024).toFixed(2)}MB\n`);
      }

      checked++;
      if (checked % 100 === 0) {
        console.log(`   Checked ${checked}/${responsesWithoutAudio.length} responses...`);
      }
    }

    // Try to match by sessionId
    for (const response of responsesWithoutAudio) {
      if (!response.sessionId || matches.find(m => m.response._id.toString() === response._id.toString())) continue;
      
      const matchingFiles = tempFiles.filter(f => 
        f.filename.includes(response.sessionId) ||
        f.filename.includes(response.sessionId?.replace('offline_', ''))
      );

      if (matchingFiles.length > 0) {
        const bestMatch = matchingFiles.sort((a, b) => b.modified - a.modified)[0];
        matches.push({
          response: response,
          file: bestMatch,
          matchType: 'sessionId',
          confidence: 'medium'
        });
        console.log(`✅ Matched (sessionId): ${bestMatch.filename.substring(0, 60)}`);
        console.log(`   → Response: ${response.responseId || response._id}`);
      }
    }

    // Try to match by date proximity (within 5 minutes)
    for (const response of responsesWithoutAudio) {
      if (matches.find(m => m.response._id.toString() === response._id.toString())) continue;
      
      const responseDate = response.completedAt || response.createdAt;
      if (!responseDate) continue;

      const matchingFiles = tempFiles.filter(f => {
        const timeDiff = Math.abs(f.modified - new Date(responseDate));
        return timeDiff < 5 * 60 * 1000; // 5 minutes
      });

      if (matchingFiles.length > 0) {
        const bestMatch = matchingFiles.sort((a, b) => {
          const diffA = Math.abs(a.modified - new Date(responseDate));
          const diffB = Math.abs(b.modified - new Date(responseDate));
          return diffA - diffB;
        })[0];
        
        matches.push({
          response: response,
          file: bestMatch,
          matchType: 'dateProximity',
          confidence: 'low'
        });
      }
    }

    console.log('\n===========================================');
    console.log('📊 MATCHING SUMMARY:');
    console.log('===========================================');
    console.log(`Total matches found: ${matches.length}`);
    console.log(`High confidence: ${matches.filter(m => m.confidence === 'high').length}`);
    console.log(`Medium confidence: ${matches.filter(m => m.confidence === 'medium').length}`);
    console.log(`Low confidence: ${matches.filter(m => m.confidence === 'low').length}`);

    // Show sample matches
    console.log('\n📋 Sample Matches (first 10):');
    matches.slice(0, 10).forEach((match, i) => {
      console.log(`\n${i + 1}. ${match.file.filename.substring(0, 50)}`);
      console.log(`   Response: ${match.response.responseId || match.response._id}`);
      console.log(`   Match type: ${match.matchType} (${match.confidence} confidence)`);
      console.log(`   File date: ${match.file.modified.toISOString()}`);
      console.log(`   Response date: ${match.response.completedAt || match.response.createdAt}`);
    });

    await mongoose.disconnect();

    return matches;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

matchTempFilesToResponses().then(matches => {
  console.log(`\n✅ Analysis complete. Found ${matches.length} potential matches.`);
  console.log('\n💡 Next step: Review matches and upload to S3');
});




