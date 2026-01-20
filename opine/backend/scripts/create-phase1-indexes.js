/**
 * Phase 1: Quick Wins - Database Index Creation Script
 * 
 * Creates compound indexes for getNextReviewAssignment optimization
 * 
 * Run: node scripts/create-phase1-indexes.js
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function createIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('surveyresponses');
    
    console.log('\n📊 Creating Phase 1 indexes...\n');
    
    // Index 1: Compound index for AC filtering in quality agent assignments
    // This dramatically improves query performance when filtering by selectedAC
    console.log('Creating index: survey + status + selectedAC + reviewAssignment.assignedTo...');
    try {
      await collection.createIndex(
        {
          survey: 1,
          status: 1,
          selectedAC: 1,
          'reviewAssignment.assignedTo': 1
        },
        {
          name: 'phase1_ac_assignment_idx',
          background: true // Don't block database operations
        }
      );
      console.log('✅ Created: phase1_ac_assignment_idx');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('⚠️  Index already exists: phase1_ac_assignment_idx');
      } else {
        console.error('❌ Error creating phase1_ac_assignment_idx:', error.message);
      }
    }
    
    // Index 2: Compound index for interviewMode + status + survey
    // This improves query performance for CAPI/CATI mode filtering
    console.log('Creating index: status + interviewMode + survey + reviewAssignment...');
    try {
      await collection.createIndex(
        {
          status: 1,
          interviewMode: 1,
          survey: 1,
          'reviewAssignment.assignedTo': 1,
          'reviewAssignment.expiresAt': 1
        },
        {
          name: 'phase1_interviewmode_assignment_idx',
          background: true
        }
      );
      console.log('✅ Created: phase1_interviewmode_assignment_idx');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('⚠️  Index already exists: phase1_interviewmode_assignment_idx');
      } else {
        console.error('❌ Error creating phase1_interviewmode_assignment_idx:', error.message);
      }
    }
    
    // Index 3: Compound index for queue query with selectedAC
    // This improves performance when querying available responses with AC filtering
    console.log('Creating index: status + survey + interviewMode + selectedAC + qcBatch...');
    try {
      await collection.createIndex(
        {
          status: 1,
          survey: 1,
          interviewMode: 1,
          selectedAC: 1,
          qcBatch: 1,
          isSampleResponse: 1,
          lastSkippedAt: 1,
          createdAt: 1
        },
        {
          name: 'phase1_queue_ac_idx',
          background: true
        }
      );
      console.log('✅ Created: phase1_queue_ac_idx');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('⚠️  Index already exists: phase1_queue_ac_idx');
      } else {
        console.error('❌ Error creating phase1_queue_ac_idx:', error.message);
      }
    }
    
    console.log('\n✅ Phase 1 indexes creation completed!\n');
    
    // List all indexes for verification
    console.log('📋 Current indexes on surveyresponses collection:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createIndexes();





