/**
 * Migration Script: Add memberId to existing Interviewers and Quality Agents
 * 
 * This script:
 * 1. Finds all existing interviewers and quality agents without memberId
 * 2. Generates unique 6-digit member IDs for each
 * 3. Updates the database
 * 
 * Run with: node backend/scripts/addMemberIdsToExistingUsers.js
 */

const path = require('path');
// Load .env from root directory (same as server.js)
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Generate unique 6-digit member ID
const generateMemberId = async () => {
  let memberId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    // Generate a random 6-digit number (100000 to 999999)
    memberId = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if this memberId already exists
    const existingUser = await User.findOne({ memberId });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique member ID after multiple attempts');
  }

  return memberId;
};

const addMemberIdsToExistingUsers = async () => {
  try {
    // Connect to MongoDB - try multiple environment variable names
    // The server.js uses MONGODB_URI, so we'll use that
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      // Try to read from .env file directly - check multiple locations
      const fs = require('fs');
      const possiblePaths = [
        path.join(__dirname, '../../.env'),
        path.join(__dirname, '../.env'),
        path.join(__dirname, '../../backend/.env'),
        '.env'
      ];
      
      let envPath = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          envPath = possiblePath;
          break;
        }
      }
      
      if (envPath) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const mongoMatch = envContent.match(/MONGODB_URI\s*=\s*(.+)/);
        if (mongoMatch) {
          const uri = mongoMatch[1].trim().replace(/^["']|["']$/g, '');
          console.log('🔌 Connecting to MongoDB using .env file...');
          await mongoose.connect(uri);
        } else {
          throw new Error('MONGODB_URI not found in .env file at ' + envPath);
        }
      } else {
        throw new Error('MONGODB_URI is not defined and .env file not found. Checked: ' + possiblePaths.join(', '));
      }
    } else {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
    }
    console.log('✅ Connected to MongoDB');

    // Find all interviewers and quality agents without memberId
    const usersWithoutMemberId = await User.find({
      userType: { $in: ['interviewer', 'quality_agent'] },
      $or: [
        { memberId: { $exists: false } },
        { memberId: null },
        { memberId: '' }
      ]
    });

    console.log(`📊 Found ${usersWithoutMemberId.length} users without memberId`);

    if (usersWithoutMemberId.length === 0) {
      console.log('✅ All users already have memberId assigned');
      await mongoose.disconnect();
      return;
    }

    // Generate and assign memberId to each user
    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutMemberId) {
      try {
        const memberId = await generateMemberId();
        user.memberId = memberId;
        await user.save();
        successCount++;
        console.log(`✅ Assigned memberId ${memberId} to ${user.firstName} ${user.lastName} (${user.userType})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error assigning memberId to ${user.firstName} ${user.lastName}:`, error.message);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Successfully assigned: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total processed: ${usersWithoutMemberId.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Migration completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the migration
addMemberIdsToExistingUsers();

