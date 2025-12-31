const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Survey = require('../models/Survey');

// Quality agents data from Excel (with passwords)
const qualityAgentsData = [
  { name: 'Priyanka', catiId: '2009', capiId: '101', memberId: '1001' },
  { name: 'Jaidev Haldhar', catiId: '2013', capiId: '122', memberId: '1006' },
  { name: 'Prashant Majee', catiId: '2015', capiId: '125', memberId: '1007' },
  { name: 'Kaushik Biswas', catiId: '2016', capiId: '126', memberId: '1008' },
  { name: 'Rumi Santra', catiId: '2018', capiId: '102', memberId: '1009' },
  { name: 'Aditya kumar Sarkar', catiId: '2023', capiId: '132', memberId: '1010' },
  { name: 'Subhanker Das Gupta', catiId: '2011', capiId: '120', memberId: '1011' },
  { name: 'Neelam', catiId: '2036', capiId: '143', memberId: '1012' },
  { name: 'Abhijeet Sarkar', catiId: '2001', capiId: '113', memberId: '1013' },
  { name: 'Biswajit Sarkar', catiId: '2021', capiId: '130', memberId: '1014' },
  { name: 'Anima Ghosh', catiId: '2004', capiId: '103', memberId: '1015' },
  { name: 'Subroto Das', catiId: '2019', capiId: '128', memberId: '1016' },
  { name: 'Souvik Saha', catiId: '2020', capiId: '129', memberId: '1017' },
  { name: 'Ravindranath Basak', catiId: '2028', capiId: '105', memberId: '1018' },
  { name: 'Suman De', catiId: '2002', capiId: '114', memberId: '1019' },
  { name: 'Suman Mali', catiId: '2008', capiId: '118', memberId: '1020' },
  { name: 'Rohan Parsad', catiId: '2033', capiId: '133', memberId: '1021' },
  { name: 'Tanishka Sarkar', catiId: '2004', capiId: '100', memberId: '1022' },
  { name: 'Jyoti Roy', catiId: null, capiId: null, memberId: '1023' }
];

// Function to generate password from name
function generatePassword(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'Password123';
  
  const firstName = parts[0].toLowerCase();
  const restOfName = parts.slice(1).join('').toLowerCase();
  return firstName.charAt(0).toUpperCase() + firstName.slice(1) + restOfName;
}

// Function to get next available phone number
async function getNextPhoneNumber(startIndex = 0) {
  const basePhone = 9958011900;
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
  return `+91${basePhone + Math.floor(Math.random() * 10000)}`;
}

async function addQualityAgentsToProduction() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

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
    for (const agentData of qualityAgentsData) {
      try {
        const name = agentData.name.trim();
        if (!name) continue;

        // Parse name into firstName and lastName
        const nameParts = name.split(/\s+/);
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        const memberId = agentData.memberId;
        const email = `${memberId}@gmail.com`;
        
        // Check if user already exists
        const existingUser = await User.findOne({ memberId }).lean();
        if (existingUser) {
          console.log(`⚠️  User with memberId ${memberId} already exists, skipping...`);
          createdUsers.push(existingUser);
          continue;
        }

        // Check if email exists
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
          'QA-capi-ID': agentData.capiId,
          'QA-cati-ID': agentData.catiId
        };

        const user = new User(userData);
        await user.save();
        
        console.log(`✅ Created user: ${firstName} ${lastName} (${email}) - MemberId: ${memberId}`);
        createdUsers.push({ ...userData, password }); // Store plain password for output

      } catch (error) {
        console.error(`❌ Error creating user for ${agentData.name}:`, error.message);
        errors.push({ name: agentData.name, error: error.message });
      }
    }

    console.log(`\n📊 Summary: Created ${createdUsers.length} users, ${errors.length} errors`);

    // Assign all quality agents to survey
    if (createdUsers.length > 0) {
      console.log('\n🔗 Assigning quality agents to survey...');
      
      const assignments = createdUsers.map(user => ({
        qualityAgent: user._id || (user.memberId ? await User.findOne({ memberId: user.memberId }).select('_id').lean() : null),
        assignedBy: companyAdmin._id,
        status: 'assigned',
        assignedACs: [],
        selectedState: survey.assignedQualityAgents?.[0]?.selectedState || null
      })).filter(a => a.qualityAgent);

      // Get actual user IDs
      const userIds = await User.find({ 
        memberId: { $in: createdUsers.map(u => u.memberId) }
      }).select('_id memberId').lean();
      
      const memberIdToUserId = {};
      userIds.forEach(u => {
        memberIdToUserId[u.memberId] = u._id;
      });

      const newAssignments = createdUsers
        .filter(u => memberIdToUserId[u.memberId])
        .map(u => ({
          qualityAgent: memberIdToUserId[u.memberId],
          assignedBy: companyAdmin._id,
          status: 'assigned',
          assignedACs: [],
          selectedState: survey.assignedQualityAgents?.[0]?.selectedState || null
        }));

      // Add to existing assignments (don't overwrite)
      const existingAssignments = survey.assignedQualityAgents || [];
      const existingAgentIds = new Set(existingAssignments.map(a => a.qualityAgent.toString()));
      
      const uniqueNewAssignments = newAssignments.filter(a => !existingAgentIds.has(a.qualityAgent.toString()));
      
      if (uniqueNewAssignments.length > 0) {
        survey.assignedQualityAgents = [...existingAssignments, ...uniqueNewAssignments];
        await survey.save();
        console.log(`✅ Assigned ${uniqueNewAssignments.length} new quality agents to survey`);
      } else {
        console.log('⚠️  All quality agents already assigned to survey');
      }
    }

    // Print user details with passwords
    console.log('\n📋 Quality Agent User Details (with passwords):');
    console.log('='.repeat(80));
    createdUsers.forEach(user => {
      const password = generatePassword(user.firstName + ' ' + user.lastName);
      console.log(`\nName: ${user.firstName} ${user.lastName}`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${password}`);
      console.log(`Member ID: ${user.memberId}`);
      console.log(`Phone: ${user.phone}`);
      console.log(`CAPI ID: ${user['QA-capi-ID'] || 'N/A'}`);
      console.log(`CATI ID: ${user['QA-cati-ID'] || 'N/A'}`);
      console.log('-'.repeat(80));
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
addQualityAgentsToProduction();



