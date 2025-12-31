/**
 * Copy today's SurveyResponses from Production to Development Database
 */

const mongoose = require('mongoose');
require('dotenv').config();

const PROD_MONGODB_URI = process.env.PROD_MONGODB_URI || process.env.MONGO_URI;
const DEV_MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const SURVEY_ID = '68fd1915d41841da463f0d46';

const copyTodayResponses = async () => {
  let prodConnection, devConnection;
  
  try {
    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('📅 Copying responses from:', today.toISOString(), 'to', tomorrow.toISOString());
    console.log('🔌 Connecting to Production database...\n');
    
    // Connect to Production
    prodConnection = await mongoose.createConnection(PROD_MONGODB_URI);
    const ProdSurveyResponse = prodConnection.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Connect to Development
    console.log('🔌 Connecting to Development database...\n');
    devConnection = await mongoose.createConnection(DEV_MONGODB_URI);
    const DevSurveyResponse = devConnection.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Find today's responses in production
    const prodResponses = await ProdSurveyResponse.find({
      survey: SURVEY_ID,
      createdAt: { $gte: today, $lt: tomorrow }
    }).lean();
    
    console.log(`📊 Found ${prodResponses.length} responses in Production for today\n`);
    
    if (prodResponses.length === 0) {
      console.log('✅ No responses to copy');
      await prodConnection.close();
      await devConnection.close();
      process.exit(0);
    }
    
    // Check which ones already exist in development
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
    
    // Also update existing ones (in case they were modified)
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
    
    await prodConnection.close();
    await devConnection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (prodConnection) await prodConnection.close();
    if (devConnection) await devConnection.close();
    process.exit(1);
  }
};

if (require.main === module) {
  copyTodayResponses();
}

module.exports = { copyTodayResponses };

