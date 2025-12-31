/**
 * SYNC PRODUCTION DATABASE TO DEVELOPMENT (Node.js Version)
 * 
 * This script uses mongodump and mongorestore via child_process to sync databases
 * Falls back to direct MongoDB operations if tools are not available
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { MongoClient } = require('mongodb');

const execAsync = promisify(exec);

// Database connections
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine';
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://opine_user:OpineApp2024Secure@localhost:27017/Opine?authSource=admin';

const DB_NAME = 'Opine';
const DUMP_DIR = `/tmp/mongodb_sync_${Date.now()}`;

async function checkMongoTools() {
  try {
    await execAsync('which mongodump');
    await execAsync('which mongorestore');
    return true;
  } catch (error) {
    return false;
  }
}

async function syncWithMongoTools() {
  console.log('📦 Using mongodump/mongorestore for sync...\n');

  // Create dump directory
  await fs.mkdir(DUMP_DIR, { recursive: true });
  console.log(`✅ Created dump directory: ${DUMP_DIR}\n`);

  // Step 1: Dump production
  console.log('📥 Step 1: Dumping PRODUCTION database...');
  console.log('   This may take several minutes...\n');

  const dumpProcess = spawn('mongodump', [
    '--uri', PROD_MONGO_URI,
    '--out', DUMP_DIR
  ], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    dumpProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Production database dumped successfully\n');
        resolve();
      } else {
        reject(new Error(`mongodump exited with code ${code}`));
      }
    });
    dumpProcess.on('error', reject);
  });

  // Step 2: Drop development collections
  console.log('🗑️  Step 2: Dropping all collections in DEVELOPMENT database...\n');

  const dropProcess = spawn('mongo', [
    DEV_MONGO_URI,
    '--quiet',
    '--eval',
    `db.getCollectionNames().forEach(function(c) {
      if (c.indexOf('system.') !== 0) {
        print('Dropping: ' + c);
        db[c].drop();
      }
    });
    print('✅ All collections dropped');`
  ], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    dropProcess.on('close', (code) => {
      // Even if mongo fails, continue with restore (mongorestore --drop will handle it)
      console.log('\n✅ Collections dropped (or will be dropped by mongorestore)\n');
      resolve();
    });
    dropProcess.on('error', () => {
      console.log('⚠️  Could not use mongo shell, mongorestore --drop will handle it\n');
      resolve();
    });
  });

  // Step 3: Restore to development
  console.log('📤 Step 3: Restoring to DEVELOPMENT database...');
  console.log('   This may take several minutes...\n');

  const restoreProcess = spawn('mongorestore', [
    '--uri', DEV_MONGO_URI,
    '--drop',
    '--nsInclude', `${DB_NAME}.*`,
    path.join(DUMP_DIR, DB_NAME)
  ], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    restoreProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Development database restored successfully\n');
        resolve();
      } else {
        reject(new Error(`mongorestore exited with code ${code}`));
      }
    });
    restoreProcess.on('error', reject);
  });

  // Cleanup
  console.log('🧹 Cleaning up dump files...');
  await fs.rm(DUMP_DIR, { recursive: true, force: true });
  console.log('✅ Cleanup complete\n');
}

async function syncWithDirectMongo() {
  console.log('📦 Using direct MongoDB operations for sync...\n');

  let prodClient, devClient, prodDb, devDb;

  try {
    // Connect to databases
    console.log('🔌 Connecting to PRODUCTION...');
    prodClient = new MongoClient(PROD_MONGO_URI);
    await prodClient.connect();
    prodDb = prodClient.db(DB_NAME);
    console.log('✅ Connected to PRODUCTION\n');

    console.log('🔌 Connecting to DEVELOPMENT...');
    devClient = new MongoClient(DEV_MONGO_URI);
    await devClient.connect();
    devDb = devClient.db(DB_NAME);
    console.log('✅ Connected to DEVELOPMENT\n');

    // Get all collections from production
    console.log('📊 Getting collections from PRODUCTION...');
    const prodCollections = await prodDb.listCollections().toArray();
    const collectionNames = prodCollections
      .map(c => c.name)
      .filter(name => !name.startsWith('system.'));
    
    console.log(`✅ Found ${collectionNames.length} collections:\n`);
    collectionNames.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
    console.log('');

    // Drop all collections in development
    console.log('🗑️  Dropping all collections in DEVELOPMENT...');
    const devCollections = await devDb.listCollections().toArray();
    const devCollectionNames = devCollections
      .map(c => c.name)
      .filter(name => !name.startsWith('system.'));
    
    for (const name of devCollectionNames) {
      await devDb.collection(name).drop();
      console.log(`   ✅ Dropped: ${name}`);
    }
    console.log('');

    // Copy each collection
    let totalDocs = 0;
    for (const collectionName of collectionNames) {
      console.log(`📋 Copying: ${collectionName}`);
      
      const prodCollection = prodDb.collection(collectionName);
      const devCollection = devDb.collection(collectionName);
      
      const count = await prodCollection.countDocuments();
      console.log(`   Documents: ${count.toLocaleString()}`);
      
      if (count === 0) {
        console.log(`   ⚠️  Empty collection, skipping...\n`);
        continue;
      }

      // Use aggregation pipeline for efficient copying
      const cursor = prodCollection.find({});
      const batchSize = 1000;
      let batch = [];
      let inserted = 0;

      for await (const doc of cursor) {
        batch.push(doc);
        
        if (batch.length >= batchSize) {
          await devCollection.insertMany(batch, { ordered: false });
          inserted += batch.length;
          process.stdout.write(`\r   Progress: ${inserted.toLocaleString()}/${count.toLocaleString()} (${Math.round(inserted/count*100)}%)`);
          batch = [];
        }
      }

      // Insert remaining documents
      if (batch.length > 0) {
        await devCollection.insertMany(batch, { ordered: false });
        inserted += batch.length;
      }

      const devCount = await devCollection.countDocuments();
      if (devCount === count) {
        console.log(`\n   ✅ Copied ${devCount.toLocaleString()} documents\n`);
        totalDocs += devCount;
      } else {
        console.log(`\n   ⚠️  Count mismatch: Expected ${count}, Got ${devCount}\n`);
      }
    }

    console.log(`\n✅ Sync complete! Total documents: ${totalDocs.toLocaleString()}\n`);

  } finally {
    if (prodClient) await prodClient.close();
    if (devClient) await devClient.close();
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔄 SYNCING PRODUCTION DATABASE TO DEVELOPMENT');
  console.log('='.repeat(60));
  console.log('\n⚠️  WARNING: This will DELETE all data in development!');
  console.log(`\nProduction: ${PROD_MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Development: ${DEV_MONGO_URI.replace(/:[^:@]+@/, ':****@')}\n`);

  try {
    // Try using mongodump/mongorestore first (faster for large databases)
    const hasTools = await checkMongoTools();
    
    if (hasTools) {
      console.log('✅ MongoDB tools found, using mongodump/mongorestore\n');
      await syncWithMongoTools();
    } else {
      console.log('⚠️  MongoDB tools not found, using direct MongoDB operations\n');
      await syncWithDirectMongo();
    }

    console.log('='.repeat(60));
    console.log('✅ SYNC COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { syncWithDirectMongo, syncWithMongoTools };



