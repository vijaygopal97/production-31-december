/**
 * Script to update CATI interviewer names from Excel file
 * Updates names in both Development and Production databases
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Correct names from Excel file
const correctNames = {
  '500': 'KABINA KHATUN',
  '501': 'PRIYA SHANKAR',
  '502': 'PRANJAL SUTRADHAR',
  '503': 'ANTARA PRADHAN',
  '504': 'LAKSHYA THAPA',
  '505': 'ASHTHA SHAH',
  '506': 'PRIYANKA PATHAK',
  '507': 'HRITESH TAMANG',
  '508': 'HIRANMOY PANDIT',
  '509': 'SUBHA MALLIK',
  '510': 'Jahanara Khatoon',
  '511': 'ANIMESH ROY',
  '512': 'SAMIRAN DAS',
  '513': 'RAJAT ROY',
  '514': 'PRATIBHA SHA',
  '515': 'APARNA SARKAR',
  '516': 'KANIKA KERKETTA',
  '517': 'SUSMITA SAHA',
  '518': 'KAKALI MAJUMDER',
  '519': 'TITHI BISWAS',
  '520': 'PUJA KUNDU',
  '521': 'SUPANNA MURMU',
  '522': 'BRISTI HALDER',
  '523': 'NUPUR MONDAL',
  '524': 'PUJA DAS',
  '525': 'MIM PARVIN',
  '526': 'ANASBIN JAMAN'
};

const updateNames = async (serverName, mongoUri) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 ${serverName} Server`);
  console.log('='.repeat(80));
  
  try {
    console.log(`🔌 Connecting to MongoDB...`);
    console.log(`   URI: ${mongoUri ? mongoUri.replace(/\/\/.*@/, '//***@') : 'Not set'}`);
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected to ${serverName} MongoDB\n`);
    
    const changes = [];
    const noChanges = [];
    const notFound = [];
    
    for (const [memberId, correctName] of Object.entries(correctNames)) {
      const user = await User.findOne({ memberId: memberId });
      
      if (!user) {
        notFound.push({ memberId, correctName });
        console.log(`⚠️  Member ID ${memberId} (${correctName}) - NOT FOUND`);
        continue;
      }
      
      const existingFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const nameParts = correctName.split(/\s+/);
      const correctFirstName = nameParts[0] || '';
      const correctLastName = nameParts.slice(1).join(' ') || '';
      const correctFullName = `${correctFirstName} ${correctLastName}`.trim();
      
      // Normalize names for comparison (case-insensitive, trim)
      const existingNormalized = existingFullName.toUpperCase().trim();
      const correctNormalized = correctFullName.toUpperCase().trim();
      
      if (existingNormalized !== correctNormalized) {
        // Update the name
        user.firstName = correctFirstName;
        user.lastName = correctLastName;
        await user.save({ runValidators: false });
        
        changes.push({
          memberId,
          oldName: existingFullName,
          newName: correctFullName,
          email: user.email
        });
        
        console.log(`✅ Updated Member ID ${memberId}:`);
        console.log(`   Old: ${existingFullName}`);
        console.log(`   New: ${correctFullName}`);
        console.log(`   Email: ${user.email}\n`);
      } else {
        noChanges.push({
          memberId,
          name: existingFullName,
          email: user.email
        });
        console.log(`✓ Member ID ${memberId} (${existingFullName}) - Already correct\n`);
      }
    }
    
    await mongoose.disconnect();
    
    return { changes, noChanges, notFound };
    
  } catch (error) {
    console.error(`❌ Error on ${serverName}:`, error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    throw error;
  }
};

const main = async () => {
  console.log('🚀 Starting CATI Name Update Process\n');
  console.log('='.repeat(80));
  
  // Development server
  const devUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!devUri) {
    console.error('❌ MONGO_URI or MONGODB_URI not set in environment variables');
    process.exit(1);
  }
  const devResults = await updateNames('Development', devUri);
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\n✅ DEVELOPMENT SERVER:');
  console.log(`   Names Changed: ${devResults.changes.length}`);
  console.log(`   Already Correct: ${devResults.noChanges.length}`);
  console.log(`   Not Found: ${devResults.notFound.length}`);
  
  // Detailed changes
  if (devResults.changes.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 DETAILED CHANGES');
    console.log('='.repeat(80));
    
    console.log('\n🔧 DEVELOPMENT SERVER CHANGES:');
    devResults.changes.forEach(change => {
      console.log(`   Member ID ${change.memberId}: "${change.oldName}" → "${change.newName}" (${change.email})`);
    });
  }
  
  console.log('\n⚠️  Production update will be run separately via SSH');
  console.log('   Run this script on production server to update production database.\n');
  
  console.log('\n✅ Process completed!\n');
};

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



