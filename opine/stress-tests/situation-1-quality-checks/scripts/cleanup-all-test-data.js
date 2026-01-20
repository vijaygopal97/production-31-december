/**
 * Cleanup All Test Data
 * Removes all test data created during stress tests
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../backend/.env') });
const mongoose = require('mongoose');

const TEST_MARKERS = [
  'STRESS_TEST_1',
  'STRESS_TEST_1_DIRECT',
  'STRESS_TEST_REAL_FLOW',
  'STRESS_TEST_5MIN',
  'STRESS_TEST_COMPREHENSIVE'
];

async function cleanupAllTestData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      readPreference: "secondaryPreferred",
      maxStalenessSeconds: 90,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    });
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MongoDB connection timeout')), 30000);
      
      if (mongoose.connection.readyState === 1) {
        clearTimeout(timeout);
        mongoose.connection.db.admin().ping().then(() => resolve()).catch(reject);
      } else {
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          mongoose.connection.db.admin().ping().then(() => resolve()).catch(reject);
        });
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const responsesCollection = db.collection('surveyresponses');
    
    // Count test responses
    console.log('🔍 Searching for test data...');
    const count = await responsesCollection.countDocuments({
      'metadata.testMarker': { $in: TEST_MARKERS }
    });
    
    console.log(`📊 Found ${count} test responses\n`);
    
    if (count === 0) {
      console.log('✅ No test data found. Database is clean.\n');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    // Delete test responses
    console.log('🧹 Cleaning up test data...');
    const result = await responsesCollection.deleteMany({
      'metadata.testMarker': { $in: TEST_MARKERS }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} test responses\n`);
    
    // Verify cleanup
    const remaining = await responsesCollection.countDocuments({
      'metadata.testMarker': { $in: TEST_MARKERS }
    });
    
    if (remaining === 0) {
      console.log('✅ All test data cleaned up successfully!\n');
    } else {
      console.log(`⚠️  Warning: ${remaining} test responses still remain\n`);
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  cleanupAllTestData();
}

module.exports = cleanupAllTestData;





