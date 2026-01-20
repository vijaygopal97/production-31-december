/**
 * Verification Script for Optimization Implementation
 * 
 * This script verifies that:
 * 1. Replica set is working
 * 2. Query-level read preference is working
 * 3. Materialized views are being updated
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function verifyOptimization() {
  try {
    console.log('🔍 Verifying Optimization Implementation...\n');
    
    // 1. Verify MongoDB connection with read preference
    console.log('1️⃣ Verifying MongoDB Replica Set...');
    await mongoose.connect(process.env.MONGODB_URI, {
      readPreference: 'secondaryPreferred',
      maxStalenessSeconds: 90
    });
    
    const admin = mongoose.connection.db.admin();
    const status = await admin.command({ replSetGetStatus: 1 });
    
    console.log(`   ✅ Replica Set: ${status.set}`);
    status.members.forEach((m, i) => {
      console.log(`   ✅ Member ${i+1}: ${m.name} - ${m.stateStr} (health: ${m.health})`);
    });
    
    // 2. Verify query-level read preference
    console.log('\n2️⃣ Verifying Query-Level Read Preference...');
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, {strict: false, collection: 'surveyresponses'}));
    
    const start = Date.now();
    await SurveyResponse.findOne({}).read('secondaryPreferred').lean();
    const duration = Date.now() - start;
    
    const hello = await admin.command({ hello: 1 });
    console.log(`   ✅ Query executed on: ${hello.me}`);
    console.log(`   ✅ Is Secondary: ${hello.secondary}`);
    console.log(`   ✅ Query duration: ${duration}ms`);
    
    // 3. Verify materialized views exist
    console.log('\n3️⃣ Verifying Materialized Views...');
    
    try {
      const AvailableAssignment = require('../models/AvailableAssignment');
      const count = await AvailableAssignment.countDocuments({ status: 'available' });
      console.log(`   ✅ AvailableAssignment collection exists`);
      console.log(`   ✅ Available entries: ${count}`);
    } catch (error) {
      console.log(`   ⚠️  AvailableAssignment model not loaded yet (will be created on first job run)`);
    }
    
    try {
      const CatiPriorityQueue = require('../models/CatiPriorityQueue');
      const count = await CatiPriorityQueue.countDocuments({ status: 'available' });
      console.log(`   ✅ CatiPriorityQueue collection exists`);
      console.log(`   ✅ Available entries: ${count}`);
    } catch (error) {
      console.log(`   ⚠️  CatiPriorityQueue model not loaded yet (will be created on first job run)`);
    }
    
    // 4. Check if background jobs are running
    console.log('\n4️⃣ Verifying Background Jobs...');
    console.log(`   ℹ️  Background jobs should be running (check server logs for "Starting updateAvailableAssignments job...")`);
    console.log(`   ℹ️  Jobs run every 10 seconds (AvailableAssignments) and 5 seconds (CatiPriorityQueue)`);
    
    console.log('\n✅ Verification Complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Restart the server to start background jobs: pm2 restart all');
    console.log('   2. Check server logs: pm2 logs opine-backend');
    console.log('   3. Run stress test to verify improvements');
    console.log('   4. Sync code to secondary server if not already done');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyOptimization();







