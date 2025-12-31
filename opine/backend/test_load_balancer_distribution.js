const axios = require('axios');
const { performance } = require('perf_hooks');

// Test configuration
const BASE_URL = 'https://convo.convergentview.com'; // Through Nginx load balancer
const CONCURRENT_INTERVIEWERS = 200;
const surveyId = '68fd1915d41841da463f0d46';

// We'll need to get real auth tokens, but for now let's test the endpoints
// that don't require auth or use a test token

async function testLoadBalancerDistribution() {
  try {
    console.log('=== LOAD BALANCER DISTRIBUTION TEST ===');
    console.log('Testing 200 concurrent CATI interviewers through Nginx load balancer\n');
    
    const startTime = performance.now();
    const serverDistribution = {
      '127.0.0.1:5000': 0,      // Current Server
      '13.233.231.180:5000': 0, // Server 1
      '3.109.186.86:5000': 0    // Server 2
    };
    
    const results = {
      successful: 0,
      failed: 0,
      totalRequests: 0
    };
    
    // Test health endpoints to see which server responds
    const healthPromises = [];
    
    for (let i = 0; i < CONCURRENT_INTERVIEWERS; i++) {
      healthPromises.push(
        (async () => {
          try {
            // Hit health endpoint through load balancer
            const response = await axios.get(`${BASE_URL}/api/health`, {
              timeout: 10000,
              validateStatus: () => true // Accept any status
            });
            
            results.totalRequests++;
            
            if (response.status === 200 && response.data) {
              const server = response.data.server || 'unknown';
              
              // Map server IP to our tracking
              if (server.includes('13.202.181.167') || server.includes('127.0.0.1')) {
                serverDistribution['127.0.0.1:5000']++;
              } else if (server.includes('13.233.231.180')) {
                serverDistribution['13.233.231.180:5000']++;
              } else if (server.includes('3.109.186.86')) {
                serverDistribution['3.109.186.86:5000']++;
              }
              
              results.successful++;
            } else {
              results.failed++;
            }
          } catch (err) {
            results.failed++;
            results.totalRequests++;
          }
        })()
      );
    }
    
    console.log('⏳ Sending 200 concurrent requests through load balancer...\n');
    await Promise.all(healthPromises);
    
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;
    
    // Calculate percentages
    const total = Object.values(serverDistribution).reduce((a, b) => a + b, 0);
    
    console.log('✅ TEST COMPLETE!\n');
    console.log('📊 LOAD BALANCER DISTRIBUTION:');
    console.log(`   Current Server (127.0.0.1:5000):`);
    console.log(`     Requests: ${serverDistribution['127.0.0.1:5000']} (${total > 0 ? ((serverDistribution['127.0.0.1:5000'] / total) * 100).toFixed(1) : '0.0'}%)`);
    console.log(`   Server 1 (13.233.231.180:5000):`);
    console.log(`     Requests: ${serverDistribution['13.233.231.180:5000']} (${total > 0 ? ((serverDistribution['13.233.231.180:5000'] / total) * 100).toFixed(1) : '0.0'}%)`);
    console.log(`   Server 2 (3.109.186.86:5000):`);
    console.log(`     Requests: ${serverDistribution['3.109.186.86:5000']} (${total > 0 ? ((serverDistribution['3.109.186.86:5000'] / total) * 100).toFixed(1) : '0.0'}%)`);
    console.log(`   Total Successful: ${results.successful}`);
    console.log(`   Total Failed: ${results.failed}`);
    console.log(`   Total Time: ${duration.toFixed(2)} seconds`);
    console.log(`   Requests/Second: ${(results.totalRequests / duration).toFixed(2)}`);
    
    console.log('\n📈 LOAD BALANCER ANALYSIS:');
    const server1Count = serverDistribution['13.233.231.180:5000'];
    const server2Count = serverDistribution['3.109.186.86:5000'];
    const currentCount = serverDistribution['127.0.0.1:5000'];
    
    if (server1Count > 0 || server2Count > 0) {
      console.log('   ✅ SUCCESS: Load is being distributed across multiple servers!');
      console.log(`   ✅ Server 1 handled: ${server1Count} requests`);
      console.log(`   ✅ Server 2 handled: ${server2Count} requests`);
      console.log(`   ✅ Current Server handled: ${currentCount} requests`);
      console.log('   ✅ Load balancer is working correctly!');
    } else {
      console.log('   ⚠️  WARNING: All requests going to current server');
      console.log('   ℹ️  This could mean:');
      console.log('      - Server 1 and Server 2 backends are not accessible');
      console.log('      - Nginx is marking them as failed');
      console.log('      - Load balancer configuration needs adjustment');
    }
    
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

testLoadBalancerDistribution();






