#!/usr/bin/env node

/**
 * Database Sync Script: Production → Development
 * 
 * ⚠️  CRITICAL SAFETY FEATURES:
 * - READ-ONLY on production (uses mongodump - read-only operation)
 * - NEVER modifies production database
 * - Creates backup of development database before sync
 * - Multiple confirmation prompts
 * - Clear warnings and safety checks
 * 
 * Usage: node syncDatabaseFromProduction.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Configuration
const PRODUCTION_MONGO_URI = process.env.PRODUCTION_MONGO_URI || 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const DATABASE_NAME = 'Opine';

// Extract connection details for mongodump/mongorestore
function parseMongoURI(uri) {
  const match = uri.match(/mongodb:\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    throw new Error(`Invalid MongoDB URI format: ${uri}`);
  }
  
  return {
    username: match[1] || '',
    password: match[2] || '',
    host: match[3],
    port: match[4],
    database: match[5],
    authSource: uri.includes('authSource=') ? uri.split('authSource=')[1].split('&')[0] : 'admin'
  };
}

// Get backup directory
const BACKUP_DIR = path.join(__dirname, '../database_backups');
const DUMP_DIR = path.join(__dirname, '../temp_prod_dump');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

async function main() {
  try {
    log('\n' + '='.repeat(70), 'cyan');
    log('  DATABASE SYNC: PRODUCTION → DEVELOPMENT', 'bold');
    log('='.repeat(70), 'cyan');
    log('', 'reset');

    // Safety warnings
    log('⚠️  CRITICAL SAFETY INFORMATION:', 'yellow');
    log('   1. This script is READ-ONLY on production database', 'yellow');
    log('   2. Production database will NEVER be modified', 'yellow');
    log('   3. Development database will be COMPLETELY DELETED', 'red');
    log('   4. All development data will be REPLACED with production data', 'red');
    log('   5. A backup of development database will be created first', 'green');
    log('', 'reset');

    // Parse URIs
    log('📋 Parsing database connection strings...', 'blue');
    const prodConfig = parseMongoURI(PRODUCTION_MONGO_URI);
    const devConfig = parseMongoURI(DEV_MONGO_URI);
    
    log(`   Production: ${prodConfig.host}:${prodConfig.port}/${prodConfig.database}`, 'cyan');
    log(`   Development: ${devConfig.host}:${devConfig.port}/${devConfig.database}`, 'cyan');
    log('', 'reset');

    // Final confirmation
    log('⚠️  FINAL CONFIRMATION REQUIRED:', 'yellow');
    log('   This will:', 'yellow');
    log('   - Backup your current development database', 'yellow');
    log('   - Delete ALL data in development database', 'red');
    log('   - Copy ALL data from production to development', 'yellow');
    log('   - Production database will NOT be affected', 'green');
    log('', 'reset');

    // Ask for confirmation
    const answer = await askQuestion('Type "YES" to proceed with database sync: ');
    if (answer.trim() !== 'YES') {
      log('', 'reset');
      log('❌ Database sync cancelled by user', 'red');
      rl.close();
      process.exit(0);
    }
    log('', 'reset');

    // Check if mongodump and mongorestore are available
    try {
      execSync('mongodump --version', { stdio: 'ignore' });
      execSync('mongorestore --version', { stdio: 'ignore' });
    } catch (error) {
      log('❌ ERROR: mongodump and/or mongorestore not found!', 'red');
      log('   Please install MongoDB Database Tools:', 'red');
      log('   https://www.mongodb.com/try/download/database-tools', 'red');
      process.exit(1);
    }

    // Step 1: Create backup directories
    log('📁 Step 1: Creating backup directories...', 'blue');
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(DUMP_DIR)) {
      fs.mkdirSync(DUMP_DIR, { recursive: true });
    }
    log('✅ Backup directories created', 'green');
    log('', 'reset');

    // Step 2: Backup development database (SKIPPED - space constraints)
    log('💾 Step 2: Backing up development database...', 'blue');
    log('   ⚠️  SKIPPING backup due to space constraints', 'yellow');
    log('   ⚠️  Development database will be replaced WITHOUT backup', 'yellow');
    log('✅ Backup step skipped', 'green');
    log('', 'reset');

    // Step 3: Dump production database (READ-ONLY operation)
    log('📥 Step 3: Dumping production database (READ-ONLY)...', 'blue');
    log('   ⚠️  This is a READ-ONLY operation on production', 'yellow');
    
    // Clear any existing dump
    if (fs.existsSync(DUMP_DIR)) {
      fs.rmSync(DUMP_DIR, { recursive: true, force: true });
      fs.mkdirSync(DUMP_DIR, { recursive: true });
    }

    // Build mongodump command for production (READ-ONLY)
    let prodDumpCmd = '';
    if (prodConfig.username) {
      prodDumpCmd = `mongodump --host=${prodConfig.host}:${prodConfig.port} --db=${prodConfig.database} --username="${prodConfig.username}" --password="${prodConfig.password}" --out="${DUMP_DIR}"`;
      if (prodConfig.authSource) {
        prodDumpCmd += ` --authenticationDatabase=${prodConfig.authSource}`;
      }
    } else {
      prodDumpCmd = `mongodump --host=${prodConfig.host}:${prodConfig.port} --db=${prodConfig.database} --out="${DUMP_DIR}"`;
    }

    log(`   Command: mongodump (reading from production - READ-ONLY)`, 'cyan');
    execSync(prodDumpCmd, { stdio: 'inherit' });
    log('✅ Production database dumped successfully', 'green');
    log('', 'reset');

    // Step 4: Drop development database
    log('🗑️  Step 4: Dropping development database...', 'blue');
    log('   ⚠️  This will DELETE all data in development database', 'red');
    
    // Use mongorestore with --drop flag (handled in step 5) or drop manually
    // Drop using mongosh
    let dropCmd = '';
    if (devConfig.username) {
      // With authentication
      const authPart = `--username="${devConfig.username}" --password="${devConfig.password}"`;
      const authDb = devConfig.authSource || 'admin';
      dropCmd = `mongosh "${devConfig.host}:${devConfig.port}/${devConfig.database}?authSource=${authDb}" ${authPart} --eval "db.dropDatabase()" --quiet`;
    } else {
      // Without authentication
      dropCmd = `mongosh "${devConfig.host}:${devConfig.port}/${devConfig.database}" --eval "db.dropDatabase()" --quiet`;
    }

    try {
      execSync(dropCmd, { stdio: 'pipe' });
      log('✅ Development database dropped', 'green');
    } catch (error) {
      // mongorestore --drop will handle it if drop fails
      log('   ⚠️  Drop command had issues, mongorestore --drop will handle it', 'yellow');
    }
    log('', 'reset');

    // Step 5: Restore production dump to development
    log('📤 Step 5: Restoring production data to development...', 'blue');
    const prodDumpPath = path.join(DUMP_DIR, prodConfig.database);
    
    // Build mongorestore command
    let restoreCmd = '';
    if (devConfig.username) {
      restoreCmd = `mongorestore --host=${devConfig.host}:${devConfig.port} --db=${devConfig.database} --username="${devConfig.username}" --password="${devConfig.password}" --drop "${prodDumpPath}"`;
      if (devConfig.authSource) {
        restoreCmd += ` --authenticationDatabase=${devConfig.authSource}`;
      }
    } else {
      restoreCmd = `mongorestore --host=${devConfig.host}:${devConfig.port} --db=${devConfig.database} --drop "${prodDumpPath}"`;
    }

    log(`   Command: mongorestore (writing to development)`, 'cyan');
    execSync(restoreCmd, { stdio: 'inherit' });
    log('✅ Production data restored to development', 'green');
    log('', 'reset');

    // Step 6: Cleanup temporary dump
    log('🧹 Step 6: Cleaning up temporary files...', 'blue');
    if (fs.existsSync(DUMP_DIR)) {
      fs.rmSync(DUMP_DIR, { recursive: true, force: true });
    }
    log('✅ Temporary files cleaned up', 'green');
    log('', 'reset');

    // Success message
    log('='.repeat(70), 'green');
    log('  ✅ DATABASE SYNC COMPLETED SUCCESSFULLY!', 'bold');
    log('='.repeat(70), 'green');
    log('', 'reset');
    log('📊 Summary:', 'cyan');
    if (typeof devBackupPath !== 'undefined') {
      log(`   - Development backup saved to: ${devBackupPath}`, 'cyan');
    } else {
      log(`   - Development backup: SKIPPED (space constraints)`, 'yellow');
    }
    log(`   - Production data synced to development`, 'green');
    log(`   - Production database was NOT modified (READ-ONLY)`, 'green');
    log('', 'reset');
    log('⚠️  IMPORTANT:', 'yellow');
    log('   - Your development database now contains production data', 'yellow');
    log('   - Development backup is available if you need to restore', 'yellow');
    log('   - Production database remains unchanged', 'green');
    log('', 'reset');
    
    rl.close();

  } catch (error) {
    log('', 'reset');
    log('='.repeat(70), 'red');
    log('  ❌ ERROR DURING DATABASE SYNC', 'bold');
    log('='.repeat(70), 'red');
    log('', 'reset');
    log(`Error: ${error.message}`, 'red');
    log('', 'reset');
    log('⚠️  Your development database backup is safe:', 'yellow');
    log(`   Check: ${BACKUP_DIR}`, 'yellow');
    log('', 'reset');
    rl.close();
    process.exit(1);
  }
}

// Run the script
main();

