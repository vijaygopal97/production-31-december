/**
 * Phase 5: Quality Agent Atomic Assignment - Optimal Composite Index
 * 
 * Creates optimal composite index for atomic findOneAndUpdate operations
 * This index supports the findOneAndUpdate query with status, interviewMode, survey, selectedAC, and reviewAssignment filters
 * 
 * Run: node scripts/create-qa-atomic-index.js
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function createIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('surveyresponses');
    
    console.log('\n📊 Creating Quality Agent atomic assignment index...\n');
    
    // Optimal composite index for atomic findOneAndUpdate operations
    // This index supports queries with: status + interviewMode + survey + selectedAC + reviewAssignment filters
    // Order: status (equality) -> interviewMode (equality) -> survey (equality) -> selectedAC (equality) -> reviewAssignment (existence/null) -> lastSkippedAt (sort) -> createdAt (sort)
    console.log('Creating index: status + interviewMode + survey + selectedAC + reviewAssignment + lastSkippedAt + createdAt...');
    try {
      await collection.createIndex(
        {
          status: 1,
          interviewMode: 1,
          survey: 1,
          selectedAC: 1,
          'reviewAssignment.assignedTo': 1,
          'reviewAssignment.expiresAt': 1,
          lastSkippedAt: 1,
          createdAt: 1
        },
        {
          name: 'qa_atomic_assignment_idx',
          background: true // Don't block database operations
        }
      );
      console.log('✅ Created: qa_atomic_assignment_idx');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('⚠️  Index already exists: qa_atomic_assignment_idx');
      } else {
        console.error('❌ Error creating qa_atomic_assignment_idx:', error.message);
        throw error;
      }
    }
    
    console.log('\n✅ Quality Agent atomic assignment index creation completed!\n');
    
    // List the index for verification
    console.log('📋 Created index on surveyresponses collection:');
    const indexes = await collection.indexes();
    const qaIndex = indexes.find(idx => idx.name === 'qa_atomic_assignment_idx');
    if (qaIndex) {
      console.log(`   - ${qaIndex.name}: ${JSON.stringify(qaIndex.key)}`);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createIndex();





