/**
 * Update Database Records to Use S3 Keys
 * 
 * This script updates all database records that still have local paths
 * to use S3 keys instead.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { extractS3Key, fileExistsInS3 } = require('../utils/cloudStorage');

// Models
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');

async function updateAudioRecords() {
  console.log('\n📁 Updating audio records in SurveyResponse...');
  
  // Find all responses with local audio URLs
  const responses = await SurveyResponse.find({
    'audioRecording.audioUrl': { $regex: '^/uploads/audio/' }
  });

  console.log(`📊 Found ${responses.length} responses with local audio URLs`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const response of responses) {
    try {
      const localUrl = response.audioRecording.audioUrl;
      const filename = localUrl.replace('/uploads/audio/', '');
      
      // Generate expected S3 key
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const s3Key = `audio/interviews/${year}/${month}/${filename}`;

      // Check if file exists in S3
      if (await fileExistsInS3(s3Key)) {
        response.audioRecording.audioUrl = s3Key;
        await response.save();
        updated++;
        if (updated % 10 === 0) {
          console.log(`  ✅ Updated ${updated} records...`);
        }
      } else {
        // Try to find the file in S3 by searching different date folders
        // Files might be in different month folders
        const possibleKeys = [];
        for (let m = 1; m <= 12; m++) {
          possibleKeys.push(`audio/interviews/${year}/${String(m).padStart(2, '0')}/${filename}`);
        }
        // Also check previous year
        for (let m = 1; m <= 12; m++) {
          possibleKeys.push(`audio/interviews/${year - 1}/${String(m).padStart(2, '0')}/${filename}`);
        }

        let found = false;
        for (const key of possibleKeys) {
          if (await fileExistsInS3(key)) {
            response.audioRecording.audioUrl = key;
            await response.save();
            updated++;
            found = true;
            break;
          }
        }

        if (!found) {
          notFound++;
          console.log(`  ⚠️  S3 key not found for: ${filename}`);
        }
      }
    } catch (error) {
      errors++;
      console.error(`  ❌ Error updating response ${response._id}:`, error.message);
    }
  }

  console.log(`\n✅ Audio records update complete:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found in S3: ${notFound}`);
  console.log(`   Errors: ${errors}`);
}

async function updateDocumentRecords() {
  console.log('\n📁 Updating document records in User profiles...');
  
  const documentFields = ['aadhaarDocument', 'panDocument', 'passportPhoto', 'bankDocumentUpload', 'cvUpload'];
  let totalUpdated = 0;

  for (const field of documentFields) {
    // Find users with local document paths
    const users = await User.find({
      [`interviewerProfile.${field}`]: { $regex: '^[^/].*' } // Not starting with /, so it's a filename
    });

    console.log(`📊 Found ${users.length} users with local ${field} paths`);

    let updated = 0;
    for (const user of users) {
      try {
        const filename = user.interviewerProfile[field];
        
        // Check if it's already an S3 key (contains /)
        if (filename && filename.includes('/')) {
          continue; // Already an S3 key
        }

        // Generate expected S3 key
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        let docType = 'other';
        if (field.includes('aadhaar')) docType = 'aadhaar';
        else if (field.includes('pan')) docType = 'pan';
        else if (field.includes('passport')) docType = 'passport-photos';
        else if (field.includes('bank')) docType = 'bank-documents';
        else if (field.includes('cv')) docType = 'cv';

        // Try to find in S3
        const possibleKeys = [];
        for (let m = 1; m <= 12; m++) {
          possibleKeys.push(`documents/${docType}/${year}/${String(m).padStart(2, '0')}/${filename}`);
        }
        for (let m = 1; m <= 12; m++) {
          possibleKeys.push(`documents/${docType}/${year - 1}/${String(m).padStart(2, '0')}/${filename}`);
        }

        let found = false;
        for (const key of possibleKeys) {
          if (await fileExistsInS3(key)) {
            user.interviewerProfile[field] = key;
            await user.save();
            updated++;
            totalUpdated++;
            found = true;
            break;
          }
        }

        if (!found && filename) {
          console.log(`  ⚠️  S3 key not found for ${field}: ${filename}`);
        }
      } catch (error) {
        console.error(`  ❌ Error updating user ${user._id} ${field}:`, error.message);
      }
    }

    console.log(`  ✅ Updated ${updated} ${field} records`);
  }

  console.log(`\n✅ Document records update complete: ${totalUpdated} total updated`);
}

async function main() {
  console.log('🚀 Starting Database Update Script');
  console.log('==================================\n');

  // Check S3 configuration
  const { isS3Configured } = require('../utils/cloudStorage');
  if (!isS3Configured()) {
    console.error('❌ S3 is not configured');
    process.exit(1);
  }

  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opine', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }

  try {
    await updateAudioRecords();
    await updateDocumentRecords();

    console.log('\n✅ Database update completed successfully!');
  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };









