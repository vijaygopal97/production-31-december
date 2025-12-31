#!/usr/bin/env node
/**
 * Server Health Monitoring Script
 * Checks system resources, database connectivity, and application performance
 */

const os = require('os');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

async function checkSystemHealth() {
  console.log('='.repeat(80));
  console.log('🔍 SERVER HEALTH REPORT');
  console.log('='.repeat(80));
  console.log(`📅 Generated: ${new Date().toISOString()}\n`);

  // System Resources
  console.log('📊 SYSTEM RESOURCES');
  console.log('-'.repeat(80));
  const totalMem = os.totalmem() / 1024 / 1024 / 1024;
  const freeMem = os.freemem() / 1024 / 1024 / 1024;
  const usedMem = totalMem - freeMem;
  const memUsagePercent = (usedMem / totalMem * 100).toFixed(2);
  
  console.log(`Memory: ${usedMem.toFixed(2)}GB / ${totalMem.toFixed(2)}GB (${memUsagePercent}% used)`);
  console.log(`CPU Cores: ${os.cpus().length}`);
  console.log(`Load Average: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}`);
  console.log(`Uptime: ${(os.uptime() / 3600).toFixed(2)} hours`);
  
  // Get process info
  try {
    const pm2List = execSync('pm2 list --no-color', { encoding: 'utf8' });
    console.log('\n📦 PM2 PROCESSES:');
    console.log('-'.repeat(80));
    console.log(pm2List);
  } catch (e) {
    console.log('\n⚠️  PM2 not available or error reading PM2 status');
  }

  // Database Connectivity
  console.log('\n🗄️  DATABASE CONNECTIVITY');
  console.log('-'.repeat(80));
  
  // Local MongoDB
  try {
    const start = Date.now();
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    const connectTime = Date.now() - start;
    const stats = await mongoose.connection.db.stats();
    console.log(`✅ Local MongoDB: Connected (${connectTime}ms)`);
    console.log(`   Collections: ${stats.collections}`);
    console.log(`   Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Index Size: ${(stats.indexSize / 1024 / 1024).toFixed(2)}MB`);
    
    // Check connection pool
    const poolSize = mongoose.connection.getClient().topology?.s?.pool?.totalConnectionCount || 'N/A';
    console.log(`   Connection Pool: ${poolSize}`);
    
    await mongoose.connection.close();
  } catch (e) {
    console.log(`❌ Local MongoDB: ${e.message}`);
  }

  // Production MongoDB
  try {
    const start = Date.now();
    const prodConn = await mongoose.createConnection(PROD_MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    const connectTime = Date.now() - start;
    
    const pingStart = Date.now();
    await prodConn.db.admin().ping();
    const pingTime = Date.now() - pingStart;
    
    console.log(`✅ Production MongoDB: Connected (${connectTime}ms, ping: ${pingTime}ms)`);
    await prodConn.close();
  } catch (e) {
    console.log(`❌ Production MongoDB: ${e.message}`);
  }

  // Network
  console.log('\n🌐 NETWORK STATUS');
  console.log('-'.repeat(80));
  try {
    const pingResult = execSync('ping -c 3 13.202.181.167 2>&1 | tail -1', { encoding: 'utf8' });
    console.log(`Production Server Ping: ${pingResult.trim()}`);
  } catch (e) {
    console.log('⚠️  Could not ping production server');
  }

  // Disk Space
  console.log('\n💾 DISK USAGE');
  console.log('-'.repeat(80));
  try {
    const dfResult = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const parts = dfResult.trim().split(/\s+/);
    console.log(`Root Partition: ${parts[2]} used / ${parts[1]} total (${parts[4]} used)`);
  } catch (e) {
    console.log('⚠️  Could not check disk usage');
  }

  // Recent Errors
  console.log('\n⚠️  RECENT ERRORS (Last 10)');
  console.log('-'.repeat(80));
  try {
    const pm2Logs = execSync('pm2 logs opine-backend --lines 50 --nostream 2>&1 | grep -E "Error|error|ERROR" | tail -10', { encoding: 'utf8' });
    if (pm2Logs.trim()) {
      console.log(pm2Logs);
    } else {
      console.log('✅ No recent errors found');
    }
  } catch (e) {
    console.log('⚠️  Could not retrieve error logs');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Health check complete');
  console.log('='.repeat(80));
}

// Run health check
checkSystemHealth()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  });

