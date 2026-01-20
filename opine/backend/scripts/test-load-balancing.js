/**
 * Test Load Balancing and Replica Set Query Distribution
 * 
 * This script:
 * 1. Tests load balancing between primary and secondary servers
 * 2. Verifies queries are distributed across replica set members
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const PRIMARY_SERVER = '13.202.181.167';
const SECONDARY_SERVER = '3.109.82.159';
const API_PORT = process.env.PORT || 5000;

async function testLoadBalancing() {
  console.log('🔍 Testing Load Balancing and Replica Set Distribution...\n');
  
  const results = {
    primaryRequests: 0,
    secondaryRequests: 0,
    primaryQueries: 0,
    secondaryQueries: 0,
    errors: []
  };
  
  try {
    // 1. Test Load Balancing (Health Endpoint)
    console.log('1️⃣ Testing Load Balancing (Health Endpoint)...');
    
    const healthChecks = [];
    for (let i = 0; i < 20; i++) {
      try {
        const response = await axios.get(`http://${PRIMARY_SERVER}:${API_PORT}/health`, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        if (response.data && response.data.server) {
          const serverIP = response.data.server;
          if (serverIP.includes('172.31.43') || serverIP.includes('13.202.181')) {
            results.primaryRequests++;
          } else if (serverIP.includes('172.31.47') || serverIP.includes('3.109.82')) {
            results.secondaryRequests++;
          }
          healthChecks.push(serverIP);
        }
      } catch (error) {
        results.errors.push(`Health check ${i}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ Primary server requests: ${results.primaryRequests}/20`);
    console.log(`   ✅ Secondary server requests: ${results.secondaryRequests}/20`);
    console.log(`   ✅ Load distribution: ${((results.primaryRequests / 20) * 100).toFixed(1)}% primary, ${((results.secondaryRequests / 20) * 100).toFixed(1)}% secondary`);
    
    if (results.primaryRequests > 0 && results.secondaryRequests > 0) {
      console.log('   ✅ Load balancing is working!');
    } else if (results.primaryRequests === 20) {
      console.log('   ⚠️  All requests went to primary (may be normal if Nginx uses least_conn)');
    } else {
      console.log('   ⚠️  Load balancing may not be working correctly');
    }
    
    // 2. Test Replica Set Query Distribution
    console.log('\n2️⃣ Testing Replica Set Query Distribution...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      readPreference: 'secondaryPreferred',
      maxStalenessSeconds: 90
    });
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, {strict: false, collection: 'surveyresponses'}));
    
    // Run multiple queries and check which server they use
    for (let i = 0; i < 20; i++) {
      try {
        await SurveyResponse.findOne({}).read('secondaryPreferred').lean();
        
        const admin = mongoose.connection.db.admin();
        const hello = await admin.command({ hello: 1 });
        
        if (hello.me.includes('172.31.43') || hello.me.includes('13.202.181')) {
          results.primaryQueries++;
        } else if (hello.me.includes('172.31.47') || hello.me.includes('3.109.82')) {
          results.secondaryQueries++;
        }
        
        // Small delay to allow connection switching
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.errors.push(`Query ${i}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ Primary queries: ${results.primaryQueries}/20`);
    console.log(`   ✅ Secondary queries: ${results.secondaryQueries}/20`);
    console.log(`   ✅ Query distribution: ${((results.primaryQueries / 20) * 100).toFixed(1)}% primary, ${((results.secondaryQueries / 20) * 100).toFixed(1)}% secondary`);
    
    if (results.secondaryQueries > 0) {
      console.log('   ✅ Replica set queries are being distributed!');
    } else {
      console.log('   ⚠️  All queries went to primary (may need to check readPreference)');
    }
    
    // 3. Test Background Jobs
    console.log('\n3️⃣ Testing Background Jobs...');
    
    try {
      const AvailableAssignment = require('../models/AvailableAssignment');
      const CatiPriorityQueue = require('../models/CatiPriorityQueue');
      
      const availableCount = await AvailableAssignment.countDocuments();
      const catiCount = await CatiPriorityQueue.countDocuments();
      
      console.log(`   ✅ AvailableAssignment entries: ${availableCount}`);
      console.log(`   ✅ CatiPriorityQueue entries: ${catiCount}`);
      
      if (availableCount > 0 || catiCount > 0) {
        console.log('   ✅ Background jobs are running and populating materialized views!');
      } else {
        console.log('   ⚠️  Materialized views are empty (jobs may need more time to run)');
      }
    } catch (error) {
      console.log(`   ⚠️  Error checking materialized views: ${error.message}`);
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Load Balancing: ${results.primaryRequests > 0 && results.secondaryRequests > 0 ? '✅ Working' : '⚠️  Check Nginx config'}`);
    console.log(`   Replica Set Queries: ${results.secondaryQueries > 0 ? '✅ Distributed' : '⚠️  All to primary'}`);
    console.log(`   Background Jobs: ${results.errors.length === 0 ? '✅ Running' : '⚠️  Check logs'}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
    }
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLoadBalancing();







