/**
 * Copy today's SurveyResponses from Production to Development Database via SSH
 */

const mongoose = require('mongoose');
const { execSync } = require('child_process');
require('dotenv').config();

const DEV_MONGODB_URI = process.env.MONGODB_URI;
const PROD_SSH_KEY = '/var/www/MyLogos/Convergent-New.pem';
const PROD_SERVER = 'ubuntu@13.202.181.167';
const SURVEY_ID = '68fd1915d41841da463f0d46';

const copyTodayResponses = async () => {
  try {
    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('📅 Copying responses from:', today.toISOString(), 'to', tomorrow.toISOString());
    
    // Step 1: Export from production via SSH
    console.log('🔌 Exporting responses from Production database...\n');
    const exportScript = `
      const mongoose = require('mongoose');
      require('dotenv').config();
      const today = new Date('${today.toISOString()}');
      const tomorrow = new Date('${tomorrow.toISOString()}');
      mongoose.connect(process.env.MONGODB_URI).then(async () => {
        const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
        const responses = await SurveyResponse.find({
          survey: '${SURVEY_ID}',
          createdAt: { \$gte: today, \$lt: tomorrow }
        }).lean();
        console.log(JSON.stringify(responses));
        await mongoose.disconnect();
        process.exit(0);
      }).catch(err => {
        console.error('ERROR:', err.message);
        process.exit(1);
      });
    `;
    
    const prodResponsesJson = execSync(
      `ssh -i ${PROD_SSH_KEY} ${PROD_SERVER} "cd /var/www/opine/backend && node -e ${JSON.stringify(exportScript)}"`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
    );
    
    let prodResponses;
    try {
      prodResponses = JSON.parse(prodResponsesJson.trim());
    } catch (parseError) {
      // Try to extract JSON from output (might have error messages)
      const jsonMatch = prodResponsesJson.match(/\[.*\]/s);
      if (jsonMatch) {
        prodResponses = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse production responses JSON');
      }
    }
    
    console.log(`📊 Found ${prodResponses.length} responses in Production for today\n`);
    
    if (prodResponses.length === 0) {
      console.log('✅ No responses to copy');
      process.exit(0);
    }
    
    // Step 2: Import to development
    console.log('🔌 Connecting to Development database...\n');
    await mongoose.connect(DEV_MONGODB_URI);
    const DevSurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Check which ones already exist
    const prodResponseIds = prodResponses.map(r => r._id);
    const existingResponses = await DevSurveyResponse.find({
      _id: { $in: prodResponseIds }
    }).select('_id').lean();
    
    const existingIds = new Set(existingResponses.map(r => r._id.toString()));
    const newResponses = prodResponses.filter(r => !existingIds.has(r._id.toString()));
    
    console.log(`📋 Already exists in Dev: ${existingResponses.length}`);
    console.log(`🆕 New responses to copy: ${newResponses.length}\n`);
    
    if (newResponses.length > 0) {
      // Insert new responses
      await DevSurveyResponse.insertMany(newResponses, { ordered: false });
      console.log(`✅ Successfully copied ${newResponses.length} responses to Development\n`);
    }
    
    // Update existing ones
    let updatedCount = 0;
    for (const response of prodResponses) {
      await DevSurveyResponse.updateOne(
        { _id: response._id },
        { $set: response },
        { upsert: false }
      );
      updatedCount++;
    }
    
    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} existing responses in Development\n`);
    }
    
    // Verify
    const devCount = await DevSurveyResponse.countDocuments({
      survey: SURVEY_ID,
      createdAt: { $gte: today, $lt: tomorrow }
    });
    
    console.log(`📊 Verification - Development now has ${devCount} responses for today`);
    console.log(`📊 Production had ${prodResponses.length} responses for today\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  copyTodayResponses();
}

module.exports = { copyTodayResponses };

