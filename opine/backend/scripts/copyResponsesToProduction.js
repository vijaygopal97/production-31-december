const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load development .env file
const devEnvPath = path.join(__dirname, '../.env');
if (fs.existsSync(devEnvPath)) {
  const envFile = fs.readFileSync(devEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const SurveyResponse = require('../models/SurveyResponse');

const SURVEY_ID = '68fd1915d41841da463f0d46';

// Response IDs to copy from development to production
const RESPONSE_IDS_TO_COPY = [
  '4486a185-54a3-4825-a07e-ccf9a56d8bbc',
  'b0bc93dd-4ebc-487e-8f32-8fba5771b8f9',
  '04c935a0-3143-4fdf-b2bd-edd20878651b',
  '3aa2da83-2a3f-4967-baf7-bfbc17e14ca4',
  'f9e19c05-c85f-4fba-8c8c-9276b73e572f',
  '89f3bd48-344d-4d84-8917-455c07ea35e6',
  'd0064ede-911f-45dd-8f30-55247b2464c5',
  '294c94ff-19f0-4b6b-bbe4-2040802f3a21',
  '208ff04f-af06-4503-9349-4e3361bad9d0',
  '99f89a1c-284e-489c-b386-8bf46ac49f82',
  '3f44b37d-60a4-4af1-9e18-237f0543c536',
  '920ff544-136a-4964-97cd-20851bf97a8f',
  '32e1acaf-0fe4-49ba-8f86-a96fc9485e51',
  'b8049594-9d0b-408e-91e4-b6c05a44e32a',
  '149f3615-03c5-444a-a37f-5aed59bb4cfc',
  '53b6546d-0c4f-4384-b33d-5847a5ebf2c8',
  '3fc478d8-4ee0-4ed0-8ce5-fc1f48f7e447'
];

async function copyResponsesToProduction() {
  let devConnection = null;
  let prodConnection = null;
  
  try {
    // Connect to development database
    const devMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!devMongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    
    console.log('🔗 Connecting to development database...');
    devConnection = await mongoose.createConnection(devMongoUri);
    console.log('✅ Connected to development database');
    
    const DevSurveyResponse = devConnection.model('SurveyResponse', SurveyResponse.schema);
    
    // Connect to production database
    console.log('\n🔗 Connecting to production database...');
    // Production MongoDB URI (hardcoded for safety)
    const prodMongoUri = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
    prodConnection = await mongoose.createConnection(prodMongoUri);
    console.log('✅ Connected to production database');
    
    const ProdSurveyResponse = prodConnection.model('SurveyResponse', SurveyResponse.schema);
    
    console.log('\n=== COPYING RESPONSES FROM DEVELOPMENT TO PRODUCTION ===');
    let copiedCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    
    for (const responseId of RESPONSE_IDS_TO_COPY) {
      try {
        // Fetch from development
        const devResponse = await DevSurveyResponse.findOne({ responseId }).lean();
        
        if (!devResponse) {
          console.log(`⚠️  Response ${responseId} not found in development database`);
          notFoundCount++;
          continue;
        }
        
        // Check if exists in production
        const prodResponse = await ProdSurveyResponse.findOne({ responseId }).lean();
        
        if (!prodResponse) {
          console.log(`⚠️  Response ${responseId} not found in production database - skipping`);
          notFoundCount++;
          continue;
        }
        
        // Remove _id and __v from dev response to avoid conflicts
        const responseData = { ...devResponse };
        delete responseData._id;
        delete responseData.__v;
        
        // Update production response with development data
        await ProdSurveyResponse.updateOne(
          { responseId },
          { $set: responseData }
        );
        
        console.log(`✅ Copied response ${responseId} from development to production`);
        copiedCount++;
      } catch (error) {
        console.error(`❌ Error copying response ${responseId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Copied: ${copiedCount}`);
    console.log(`Not found: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total: ${RESPONSE_IDS_TO_COPY.length}`);
    
    // Close connections
    await devConnection.close();
    await prodConnection.close();
    console.log('\n✅ Disconnected from both databases');
  } catch (error) {
    console.error('Error:', error);
    if (devConnection) await devConnection.close();
    if (prodConnection) await prodConnection.close();
    process.exit(1);
  }
}

// Run the script
copyResponsesToProduction();

