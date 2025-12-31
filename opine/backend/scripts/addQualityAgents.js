const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Survey = require('../models/Survey');

// Function to read Excel file using Python
async function readExcelFile() {
  const { execSync } = require('child_process');
  const excelPath = path.join(__dirname, '../../frontend/src/data/QC Team Details (1).xlsx');
  const pythonScript = path.join(__dirname, 'readQCExcel.py');
  
  try {
    const output = execSync(`python3 ${pythonScript} "${excelPath}"`, { encoding: 'utf-8' });
    return JSON.parse(output.trim());
  } catch (error) {
    console.error('Error reading Excel file:', error);
    throw error;
  }
}

// Function to generate password from name
function generatePassword(name) {
  // Remove spaces, make lowercase, then capitalize first letter of first name only
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'Password123';
  
  const firstName = parts[0].toLowerCase();
  const restOfName = parts.slice(1).join('').toLowerCase();
  return firstName.charAt(0).toUpperCase() + firstName.slice(1) + restOfName;
}

// Function to get next available memberId (incremental)
let currentMemberId = null;
async function getNextMemberId() {
  if (currentMemberId === null) {
    // Initialize: find max memberId
    const maxUser = await User.findOne({ memberId: { $exists: true, $ne: null } })
      .sort({ memberId: -1 })
      .lean();
    
    if (maxUser && maxUser.memberId) {
      currentMemberId = parseInt(maxUser.memberId);
      // Start from 1000 if max is less than 1000, otherwise increment
      currentMemberId = currentMemberId >= 1000 ? currentMemberId + 1 : 1000;
    } else {
      currentMemberId = 1000;
    }
  } else {
    // Increment for next user
    currentMemberId++;
  }
  
  // Check if this memberId already exists
  const existing = await User.findOne({ memberId: currentMemberId.toString() }).lean();
  if (existing) {
    // If exists, find next available
    const allMemberIds = await User.find({ memberId: { $exists: true, $ne: null } })
      .select('memberId')
      .lean();
    const usedIds = new Set(allMemberIds.map(u => parseInt(u.memberId)));
    while (usedIds.has(currentMemberId)) {
      currentMemberId++;
    }
  }
  
  return currentMemberId.toString();
}

// Function to get next available phone number
async function getNextPhoneNumber(startIndex = 0) {
  const basePhone = 9958011900; // Starting phone number
  const existingPhones = await User.find({ phone: { $exists: true } })
    .select('phone')
    .lean();
  
  const existingPhoneNumbers = new Set(existingPhones.map(u => u.phone));
  
  for (let i = startIndex; i < 1000; i++) {
    const phone = `+91${basePhone + i}`;
    if (!existingPhoneNumbers.has(phone)) {
      return phone;
    }
  }
  // Fallback
  return `+91${basePhone + Math.floor(Math.random() * 10000)}`;
}

async function addQualityAgents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Read Excel file
    console.log('📖 Reading Excel file...');
    const excelData = await readExcelFile();
    console.log(`✅ Found ${excelData.length} quality agents in Excel`);

    // Get company admin ID for assignedBy
    const companyAdmin = await User.findOne({ 
      userType: 'company_admin',
      companyCode: 'TEST001'
    }).lean();
    
    if (!companyAdmin) {
      throw new Error('Company admin not found for TEST001');
    }
    console.log(`✅ Found company admin: ${companyAdmin._id}`);

    // Get survey
    const survey = await Survey.findById('68fd1915d41841da463f0d46');
    if (!survey) {
      throw new Error('Survey not found: 68fd1915d41841da463f0d46');
    }
    console.log(`✅ Found survey: ${survey.surveyName}`);

    const createdUsers = [];
    const errors = [];
    let phoneIndex = 0;

    // Process each quality agent
    for (const row of excelData) {
      try {
        const name = row.Name?.trim();
        if (!name || name === 'Total') continue;

        // Parse name into firstName and lastName
        const nameParts = name.split(/\s+/);
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        // Get next memberId
        const memberId = await getNextMemberId();
        
        // Check if user with this memberId already exists
        const existingUser = await User.findOne({ memberId }).lean();
        if (existingUser) {
          console.log(`⚠️  User with memberId ${memberId} already exists, skipping...`);
          createdUsers.push(existingUser);
          continue;
        }
        
        // Generate email
        const email = `${memberId}@gmail.com`;
        
        // Check if email already exists
        const existingEmail = await User.findOne({ email }).lean();
        if (existingEmail) {
          console.log(`⚠️  User with email ${email} already exists, skipping...`);
          createdUsers.push(existingEmail);
          continue;
        }

        // Get phone number
        const phone = await getNextPhoneNumber(phoneIndex++);
        
        // Generate password
        const password = generatePassword(name);
        const hashedPassword = await bcrypt.hash(password, 10);

        // Get CATI and CAPI IDs
        const catiId = row['CATI id'] ? row['CATI id'].toString() : null;
        const capiId = row['CAPI id'] ? row['CAPI id'].toString() : null;

        // Create user
        const userData = {
          firstName,
          lastName,
          email,
          phone,
          password: hashedPassword,
          memberId,
          userType: 'quality_agent',
          companyCode: 'TEST001',
          status: 'active',
          isEmailVerified: true,
          isPhoneVerified: true,
          'QA-capi-ID': capiId,
          'QA-cati-ID': catiId
        };

        const user = new User(userData);
        await user.save();
        
        console.log(`✅ Created user: ${firstName} ${lastName} (${email}) - MemberId: ${memberId}`);
        createdUsers.push(user);

      } catch (error) {
        console.error(`❌ Error creating user for ${row.Name}:`, error.message);
        errors.push({ name: row.Name, error: error.message });
      }
    }

    console.log(`\n📊 Summary: Created ${createdUsers.length} users, ${errors.length} errors`);

    // Assign all quality agents to survey
    if (createdUsers.length > 0) {
      console.log('\n🔗 Assigning quality agents to survey...');
      
      const assignments = createdUsers.map(user => ({
        qualityAgent: user._id,
        assignedBy: companyAdmin._id,
        status: 'assigned',
        assignedACs: [],
        selectedState: survey.assignedQualityAgents?.[0]?.selectedState || null
      }));

      // Add to existing assignments (don't overwrite)
      const existingAssignments = survey.assignedQualityAgents || [];
      const existingAgentIds = new Set(existingAssignments.map(a => a.qualityAgent.toString()));
      
      const newAssignments = assignments.filter(a => !existingAgentIds.has(a.qualityAgent.toString()));
      
      if (newAssignments.length > 0) {
        survey.assignedQualityAgents = [...existingAssignments, ...newAssignments];
        await survey.save();
        console.log(`✅ Assigned ${newAssignments.length} new quality agents to survey`);
      } else {
        console.log('⚠️  All quality agents already assigned to survey');
      }
    }

    // Print summary
    console.log('\n📋 Created Users Summary:');
    createdUsers.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName}: ${user.email} (MemberId: ${user.memberId})`);
    });

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => {
        console.log(`  - ${err.name}: ${err.error}`);
      });
    }

    console.log('\n✅ Process completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
addQualityAgents();



