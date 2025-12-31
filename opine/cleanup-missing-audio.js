const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    cleanupMissingAudio();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function cleanupMissingAudio() {
  try {
    const SurveyResponse = require('./backend/models/SurveyResponse');
    
    // Get all survey responses with audio
    const responses = await SurveyResponse.find({
      'audioRecording.hasAudio': true,
      'audioRecording.audioUrl': { $exists: true, $ne: null }
    });
    
    console.log(`Found ${responses.length} responses with audio`);
    
    let cleanedCount = 0;
    
    for (const response of responses) {
      const audioUrl = response.audioRecording.audioUrl;
      
      // Extract filename from URL
      const filename = audioUrl.split('/').pop();
      const filePath = path.join(__dirname, 'uploads', 'audio', filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`Missing file: ${filename}`);
        
        // Update the response to mark audio as missing
        await SurveyResponse.updateOne(
          { _id: response._id },
          {
            $set: {
              'audioRecording.hasAudio': false,
              'audioRecording.audioUrl': null,
              'audioRecording.fileSize': 0
            }
          }
        );
        
        cleanedCount++;
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} responses with missing audio files`);
    process.exit(0);
    
  } catch (error) {
    console.error('Error cleaning up missing audio:', error);
    process.exit(1);
  }
}
