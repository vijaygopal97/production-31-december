/**
 * Check if recovered audio is accessible
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const { fileExistsInS3, streamAudioFromS3 } = require('../utils/cloudStorage');

async function checkRecoveredAudio() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const responseId = 'c7a69172-3f21-42ab-82a9-9a4c0f87f1f8';
    const response = await SurveyResponse.findOne({ responseId })
      .select('audioRecording responseId')
      .lean();

    if (!response) {
      console.log('❌ Response not found');
      await mongoose.disconnect();
      return;
    }

    console.log('📊 Response Audio Data:');
    console.log(JSON.stringify(response.audioRecording, null, 2));
    console.log('');

    if (!response.audioRecording || !response.audioRecording.audioUrl) {
      console.log('❌ No audio URL in response');
      await mongoose.disconnect();
      return;
    }

    const audioUrl = response.audioRecording.audioUrl;
    console.log(`🔍 Checking S3 for: ${audioUrl}`);

    const exists = await fileExistsInS3(audioUrl);
    console.log(`✅ File exists in S3: ${exists}`);

    if (!exists) {
      console.log('❌ File does not exist in S3!');
      console.log('This means the upload failed or the key is incorrect.');
    } else {
      console.log('✅ File exists in S3 - should be accessible');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRecoveredAudio();




