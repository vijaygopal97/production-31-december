const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Survey = require('../models/Survey');

// Quality agents data with exact memberIds from development
const qualityAgentsData = [
  { name: 'Priyanka', catiId: '2009', capiId: '101', memberId: '1001', phone: '+919958011901' },
  { name: 'Jaidev Haldhar', catiId: '2013', capiId: '122', memberId: '1006', phone: '+919958011902' },
  { name: 'Prashant Majee', catiId: '2015', capiId: '125', memberId: '1007', phone: '+919958011903' },
  { name: 'Kaushik Biswas', catiId: '2016', capiId: '126', memberId: '1008', phone: '+919958011904' },
  { name: 'Rumi Santra', catiId: '2018', capiId: '102', memberId: '1009', phone: '+919958011905' },
  { name: 'Aditya kumar Sarkar', catiId: '2023', capiId: '132', memberId: '1010', phone: '+919958011906' },
  { name: 'Subhanker Das Gupta', catiId: '2011', capiId: '120', memberId: '1011', phone: '+919958011907' },
  { name: 'Neelam', catiId: '2036', capiId: '143', memberId: '1012', phone: '+919958011908' },
  { name: 'Abhijeet Sarkar', catiId: '2001', capiId: '113', memberId: '1013', phone: '+919958011909' },
  { name: 'Biswajit Sarkar', catiId: '2021', capiId: '130', memberId: '1014', phone: '+919958011910' },
  { name: 'Anima Ghosh', catiId: '2004', capiId: '103', memberId: '1015', phone: '+919958011911' },
  { name: 'Subroto Das', catiId: '2019', capiId: '128', memberId: '1016', phone: '+919958011912' },
  { name: 'Souvik Saha', catiId: '2020', capiId: '129', memberId: '1017', phone: '+919958011913' },
  { name: 'Ravindranath Basak', catiId: '2028', capiId: '105', memberId: '1018', phone: '+919958011914' },
  { name: 'Suman De', catiId: '2002', capiId: '114', memberId: '1019', phone: '+919958011915' },
  { name: 'Suman Mali', catiId: '2008', capiId: '118', memberId: '1020', phone: '+919958011916' },
  { name: 'Rohan Parsad', catiId: '2033', capiId: '133', memberId: '1021', phone: '+919958011917' },
  { name: 'Tanishka Sarkar', catiId: '2004', capiId: '100', memberId: '1022', phone: '+919958011918' },
  { name: 'Jyoti Roy', catiId: null, capiId: null, memberId: '1023', phone: '+919958011919' }
];

function generatePassword(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'Password123';
  const firstName = parts[0].toLowerCase();
  const restOfName = parts.slice(1).join('').toLowerCase();
  return firstName.charAt(0).toUpperCase() + firstName.slice(1) + restOfName;
}

async function addQualityAgentsToProduction() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const companyAdmin = await User.findOne({ 
      userType: 'company_admin',
      companyCode: 'TEST001'
    }).lean();
    
    if (!companyAdmin) {
      throw new Error('Company admin not found for TEST001');
    }
    console.log(`✅ Found company admin: ${companyAdmin._id}`);

    const survey = await Survey.findById('68fd1915d41841da463f0d46');
    if (!survey) {
      throw new Error('Survey not found: 68fd1915d41841da463f0d46');
    }
    console.log(`✅ Found survey: ${survey.surveyName}`);

    const createdUsers = [];
    const errors = [];

    for (const agentData of qualityAgentsData) {
      try {
        const name = agentData.name.trim();
        const nameParts = name.split(/\s+/);
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        const memberId = agentData.memberId;
        const email = `${memberId}@gmail.com`;
        
        const existingUser = await User.findOne({ memberId }).lean();
        if (existingUser) {
          console.log(`⚠️  User with memberId ${memberId} already exists, skipping...`);
          createdUsers.push(existingUser);
          continue;
        }

        const password = generatePassword(name);
        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
          firstName,
          lastName,
          email,
          phone: agentData.phone,
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
        createdUsers.push({ ...userData, password, _id: user._id });

      } catch (error) {
        console.error(`❌ Error creating user for ${agentData.name}:`, error.message);
        errors.push({ name: agentData.name, error: error.message });
      }
    }

    console.log(`\n📊 Summary: Created ${createdUsers.length} users, ${errors.length} errors`);

    if (createdUsers.length > 0) {
      console.log('\n🔗 Assigning quality agents to survey...');
      
      const userIds = createdUsers.map(u => u._id).filter(Boolean);
      const existingAssignments = survey.assignedQualityAgents || [];
      const existingAgentIds = new Set(existingAssignments.map(a => a.qualityAgent.toString()));
      
      const newAssignments = userIds
        .filter(id => !existingAgentIds.has(id.toString()))
        .map(id => ({
          qualityAgent: id,
          assignedBy: companyAdmin._id,
          status: 'assigned',
          assignedACs: [],
          selectedState: survey.assignedQualityAgents?.[0]?.selectedState || null
        }));
      
      if (newAssignments.length > 0) {
        survey.assignedQualityAgents = [...existingAssignments, ...newAssignments];
        await survey.save();
        console.log(`✅ Assigned ${newAssignments.length} new quality agents to survey`);
      } else {
        console.log('⚠️  All quality agents already assigned to survey');
      }
    }

    console.log('\n📋 Quality Agent User Details (with passwords):');
    console.log('='.repeat(100));
    createdUsers.forEach((user, index) => {
      const fullName = `${user.firstName} ${user.lastName}`;
      console.log(`\n${index + 1}. ${fullName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Member ID: ${user.memberId}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   CAPI ID: ${user['QA-capi-ID'] || 'N/A'}`);
      console.log(`   CATI ID: ${user['QA-cati-ID'] || 'N/A'}`);
      console.log('-'.repeat(100));
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

addQualityAgentsToProduction();



