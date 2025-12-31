#!/usr/bin/env node

/**
 * Create MongoDB user for development database
 * Uses the same connection method as the backend
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function createUser() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      console.error('❌ MONGODB_URI not found in .env');
      process.exit(1);
    }
    
    console.log('📋 Using URI:', uri.replace(/:[^:@]+@/, ':****@')); // Hide password
    
    // Connect to MongoDB
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
    
    // Get admin database
    const adminDb = mongoose.connection.db.admin();
    
    // Try to create user in admin database
    try {
      await adminDb.command({
        createUser: 'opine_user',
        pwd: 'OpineApp2024Secure',
        roles: [
          { role: 'readWrite', db: 'Opine' },
          { role: 'dbAdmin', db: 'Opine' }
        ]
      });
      console.log('✅ User opine_user created successfully in admin database');
    } catch (createError) {
      if (createError.message && createError.message.includes('already exists')) {
        console.log('ℹ️  User opine_user already exists in admin database');
      } else {
        console.error('❌ Error creating user in admin:', createError.message);
        
        // Try creating in Opine database instead
        try {
          const opineDb = mongoose.connection.db;
          await opineDb.command({
            createUser: 'opine_user',
            pwd: 'OpineApp2024Secure',
            roles: [
              { role: 'readWrite', db: 'Opine' },
              { role: 'dbAdmin', db: 'Opine' }
            ]
          });
          console.log('✅ User opine_user created successfully in Opine database');
        } catch (opineError) {
          if (opineError.message && opineError.message.includes('already exists')) {
            console.log('ℹ️  User opine_user already exists in Opine database');
          } else {
            console.error('❌ Error creating user in Opine:', opineError.message);
            throw opineError;
          }
        }
      }
    }
    
    // Test the user
    console.log('🧪 Testing user authentication...');
    await mongoose.disconnect();
    
    const testUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//opine_user:OpineApp2024Secure@');
    await mongoose.connect(testUri);
    console.log('✅ User authentication test successful!');
    
    await mongoose.disconnect();
    console.log('✅ User created and verified successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createUser();




