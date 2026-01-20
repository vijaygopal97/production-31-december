/**
 * Mark recovered audio files as potentially corrupted
 * This allows users to know which files may need to be re-uploaded
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');

async function markPotentiallyCorrupted() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all responses with recovered audio
    const recoveredResponses = await SurveyResponse.find({
      'audioRecording.recovered': true,
      'audioRecording.hasAudio': true
    }).select('responseId audioRecording').lean();

    console.log(`📊 Found ${recoveredResponses.length} responses with recovered audio\n`);

    let marked = 0;
    for (const response of recoveredResponses) {
      // Mark as potentially corrupted (users reported they don't play)
      await SurveyResponse.updateOne(
        { _id: response._id },
        { 
          $set: { 
            'audioRecording.potentiallyCorrupted': true,
            'audioRecording.corruptionNote': 'File was recovered from temp directory. If audio does not play, it may have been corrupted during original upload. Please re-upload from original source if available.'
          } 
        }
      );
      marked++;
    }

    console.log(`✅ Marked ${marked} responses as potentially corrupted`);
    console.log('\nNote: These files were recovered from /uploads/temp/ and may have been');
    console.log('corrupted during the original upload. Users should be notified to');
    console.log('re-upload from the original source if the audio does not play.\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

markPotentiallyCorrupted();




