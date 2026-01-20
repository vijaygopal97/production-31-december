/**
 * Manual Cleanup Script for Comprehensive Stress Test
 * This script cleans up all test data created during stress tests
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../backend/.env') });
const mongoose = require('mongoose');
const ComprehensiveStressTest = require('./comprehensive-5min-stress-test.js');

async function manualCleanup() {
  console.log('🧹 Starting manual cleanup of test data...\n');
  
  const test = new ComprehensiveStressTest();
  
  try {
    await test.connectMongoDB();
    
    const cleanupResult = await test.cleanupTestData();
    
    console.log(`\n✅ Cleanup Summary:`);
    console.log(`   - Reverted ${cleanupResult.revertedCount || 0} quality checks`);
    console.log(`   - Deleted ${cleanupResult.deletedCount || 0} test responses`);
    
    await mongoose.disconnect();
    console.log('\n✅ Manual cleanup complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during manual cleanup:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

manualCleanup();




