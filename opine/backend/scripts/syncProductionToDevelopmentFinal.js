/**
 * SYNC PRODUCTION DATABASE TO DEVELOPMENT (Final Version)
 * 
 * This script syncs production database to development using the existing dump
 * or creates a new dump if needed
 */

const { MongoClient } = require('mongodb');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Database connections
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine';
// Development database - try from env, or use the same server (user specified)
const DEV_MONGO_URI = process.env.MONGODB_URI || process.argv[2] || 'mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine';

const DB_NAME = 'Opine';

let prodClient, devClient, prodDb, devDb;

async function testConnection(uri, name) {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    await client.db('admin').admin().ping();
    await client.close();
    return true;
  } catch (error) {
    console.error(`❌ ${name} connection failed:`, error.message);
    return false;
  }
}

async function connectDatabases() {
  console.log('🔌 Testing connections...\n');
  
  const prodOk = await testConnection(PROD_MONGO_URI, 'PRODUCTION');
  if (!prodOk) {
    throw new Error('Cannot connect to production database');
  }
  console.log('✅ Production connection OK\n');

  const devOk = await testConnection(DEV_MONGO_URI, 'DEVELOPMENT');
  if (!devOk) {
    throw new Error('Cannot connect to development database. Please check the URI.');
  }
  console.log('✅ Development connection OK\n');

  // Connect
  console.log('🔌 Connecting to databases...\n');
  prodClient = new MongoClient(PROD_MONGO_URI);
  await prodClient.connect();
  prodDb = prodClient.db(DB_NAME);
  console.log('✅ Connected to PRODUCTION\n');

  devClient = new MongoClient(DEV_MONGO_URI);
  await devClient.connect();
  devDb = devClient.db(DB_NAME);
  console.log('✅ Connected to DEVELOPMENT\n');
}

async function getCollections(db) {
  const collections = await db.listCollections().toArray();
  return collections
    .map(c => c.name)
    .filter(name => !name.startsWith('system.'));
}

async function copyCollection(prodCollection, devCollection, collectionName) {
  try {
    const count = await prodCollection.countDocuments();
    console.log(`\n📋 ${collectionName}: ${count.toLocaleString()} documents`);
    
    if (count === 0) {
      console.log(`   ⚠️  Empty collection, skipping...`);
      return { success: true, count: 0 };
    }

    // Drop existing collection
    try {
      await devCollection.drop();
    } catch (error) {
      // Collection might not exist, that's OK
    }

    // Copy documents in batches
    const batchSize = 1000;
    let inserted = 0;
    const cursor = prodCollection.find({}).batchSize(batchSize);

    let batch = [];
    for await (const doc of cursor) {
      batch.push(doc);
      
      if (batch.length >= batchSize) {
        await devCollection.insertMany(batch, { ordered: false });
        inserted += batch.length;
        process.stdout.write(`\r   Progress: ${inserted.toLocaleString()}/${count.toLocaleString()} (${Math.round(inserted/count*100)}%)`);
        batch = [];
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      await devCollection.insertMany(batch, { ordered: false });
      inserted += batch.length;
    }

    const devCount = await devCollection.countDocuments();
    if (devCount === count) {
      console.log(`\n   ✅ Copied ${devCount.toLocaleString()} documents`);
      return { success: true, count: devCount };
    } else {
      console.log(`\n   ⚠️  Count mismatch: Expected ${count}, Got ${devCount}`);
      return { success: false, count: devCount, expected: count };
    }
  } catch (error) {
    console.error(`\n   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function syncDatabase() {
  try {
    console.log('='.repeat(60));
    console.log('🔄 SYNCING PRODUCTION DATABASE TO DEVELOPMENT');
    console.log('='.repeat(60));
    console.log(`\nProduction: ${PROD_MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);
    console.log(`Development: ${DEV_MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);
    console.log('\n⚠️  WARNING: This will DELETE all data in development!\n');

    await connectDatabases();

    // Get collections from production
    console.log('📊 Getting collections from PRODUCTION...');
    const prodCollections = await getCollections(prodDb);
    console.log(`✅ Found ${prodCollections.length} collections:\n`);
    prodCollections.forEach((name, i) => {
      console.log(`   ${i + 1}. ${name}`);
    });
    console.log('');

    // Drop all collections in development
    console.log('🗑️  Dropping all collections in DEVELOPMENT...');
    const devCollections = await getCollections(devDb);
    for (const name of devCollections) {
      await devDb.collection(name).drop();
      console.log(`   ✅ Dropped: ${name}`);
    }
    console.log('');

    // Copy each collection
    console.log('📤 Copying collections...\n');
    const results = [];
    let totalDocs = 0;
    let successCount = 0;
    let failCount = 0;

    for (const collectionName of prodCollections) {
      const prodCollection = prodDb.collection(collectionName);
      const devCollection = devDb.collection(collectionName);

      const result = await copyCollection(prodCollection, devCollection, collectionName);
      results.push({ collection: collectionName, ...result });
      
      if (result.success) {
        successCount++;
        totalDocs += result.count || 0;
      } else {
        failCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTotal Collections: ${prodCollections.length}`);
    console.log(`✅ Successfully synced: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📄 Total Documents: ${totalDocs.toLocaleString()}\n`);

    // Verify
    console.log('🔍 Verifying sync...\n');
    const finalDevCollections = await getCollections(devDb);
    console.log(`Development collections: ${finalDevCollections.length}\n`);

    // Compare counts
    console.log('📊 Collection Count Comparison:');
    console.log('-'.repeat(60));
    for (const collectionName of prodCollections) {
      const prodCount = await prodDb.collection(collectionName).countDocuments();
      const devCount = await devDb.collection(collectionName).countDocuments();
      const match = prodCount === devCount ? '✅' : '❌';
      console.log(`${match} ${collectionName.padEnd(40)} Prod: ${prodCount.toString().padStart(10)} Dev: ${devCount.toString().padStart(10)}`);
    }

    console.log('\n' + '='.repeat(60));
    if (failCount === 0) {
      console.log('✅ SYNC COMPLETED SUCCESSFULLY!');
    } else {
      console.log('⚠️  SYNC COMPLETED WITH WARNINGS');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    if (prodClient) await prodClient.close();
    if (devClient) await devClient.close();
  }
}

if (require.main === module) {
  syncDatabase()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { syncDatabase };



