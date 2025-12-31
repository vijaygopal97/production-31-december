/**
 * Transfer Survey Responses from Development to Production Database
 * Transfers all responses created on December 11, 2025
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Development Database
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Production Database
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

// Survey Response Schema (simplified for transfer)
const surveyResponseSchema = new mongoose.Schema({}, { strict: false, collection: 'surveyresponses' });

async function transferResponses() {
  let devConnection, prodConnection;

  try {
    console.log('🔌 Connecting to development database...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    console.log('✅ Connected to development database');

    console.log('🔌 Connecting to production database...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    console.log('✅ Connected to production database');

    const DevResponse = devConnection.model('SurveyResponse', surveyResponseSchema, 'surveyresponses');
    const ProdResponse = prodConnection.model('SurveyResponse', surveyResponseSchema, 'surveyresponses');

    // Find all responses created on December 11, 2025
    const startDate = new Date('2025-12-11T00:00:00.000Z');
    const endDate = new Date('2025-12-12T00:00:00.000Z');

    console.log(`📅 Searching for responses between ${startDate.toISOString()} and ${endDate.toISOString()}...`);

    const responses = await DevResponse.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate
      }
    }).lean();

    console.log(`📊 Found ${responses.length} responses to transfer`);

    if (responses.length === 0) {
      console.log('ℹ️  No responses found to transfer');
      return;
    }

    let transferred = 0;
    let skipped = 0;
    let errors = 0;

    for (const response of responses) {
      try {
        // Check if response already exists in production (by _id or sessionId)
        const existing = await ProdResponse.findOne({
          $or: [
            { _id: response._id },
            { sessionId: response.sessionId }
          ]
        });

        if (existing) {
          console.log(`⏭️  Skipping response ${response._id} - already exists in production`);
          skipped++;
          continue;
        }

        // Convert _id to ObjectId if it's a string
        if (response._id && typeof response._id === 'string') {
          response._id = new mongoose.Types.ObjectId(response._id);
        }

        // Insert into production
        await ProdResponse.create(response);
        console.log(`✅ Transferred response ${response._id} (Session: ${response.sessionId || 'N/A'}, Interviewer: ${response.interviewerId || 'N/A'})`);
        transferred++;

      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error - already exists
          console.log(`⏭️  Skipping response ${response._id} - duplicate key (already exists)`);
          skipped++;
        } else {
          console.error(`❌ Error transferring response ${response._id}:`, error.message);
          errors++;
        }
      }
    }

    console.log('\n📊 Transfer Summary:');
    console.log(`   ✅ Transferred: ${transferred}`);
    console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total processed: ${responses.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (devConnection) {
      await devConnection.close();
      console.log('🔌 Disconnected from development database');
    }
    if (prodConnection) {
      await prodConnection.close();
      console.log('🔌 Disconnected from production database');
    }
  }
}

// Run the transfer
transferResponses()
  .then(() => {
    console.log('\n✅ Transfer completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Transfer failed:', error);
    process.exit(1);
  });






