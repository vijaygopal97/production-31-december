const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SurveyResponse = require('../models/SurveyResponse');

// Phone number to search for (can be passed as command line argument)
const PHONE_NUMBER = process.argv[2] || '7602865547';
// Response ID to check (optional, for reference)
const REJECTED_RESPONSE_ID = process.argv[3] || null;

// Phone question text patterns
const PHONE_QUESTION_TEXT = 'Would you like to share your mobile number with us? We assure you we shall keep it confidential and shall use only for quality control purposes.';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Extract phone number from response
 */
function extractPhoneNumber(responses) {
  if (!responses || !Array.isArray(responses)) {
    return null;
  }

  // Search for the phone number question in responses
  // Priority: exact match first, then partial matches
  const phoneResponse = responses.find(r => {
    const questionText = r.questionText || r.question?.text || '';
    // Exact match first
    if (questionText === PHONE_QUESTION_TEXT) {
      return true;
    }
    // Then check for key phrases
    return questionText.includes('mobile number') || 
           questionText.includes('phone number') ||
           questionText.toLowerCase().includes('share your mobile') ||
           questionText.toLowerCase().includes('quality control purposes');
  });

  if (phoneResponse && phoneResponse.response !== null && phoneResponse.response !== undefined) {
    // Extract phone number from response
    let phoneValue = phoneResponse.response;
    
    // Skip if response is empty, "0", or indicates no answer
    if (phoneValue === '' || phoneValue === '0' || phoneValue === 0 || phoneValue === null) {
      return null;
    }
    
    // Handle different response formats
    if (Array.isArray(phoneValue)) {
      phoneValue = phoneValue[0];
    }
    
    if (typeof phoneValue === 'object' && phoneValue !== null) {
      // If response is an object, try to get the value
      phoneValue = phoneValue.phone || phoneValue.value || phoneValue.answer || phoneValue.text || Object.values(phoneValue)[0];
    }
    
    // Convert to string and normalize (remove spaces, dashes, etc.)
    const phoneStr = String(phoneValue).trim().replace(/[\s\-\(\)]/g, '');
    
    // Return if it's a valid phone number (contains digits and has reasonable length)
    if (phoneStr && /^\d+$/.test(phoneStr) && phoneStr.length >= 10) {
      return phoneStr;
    }
  }
  
  return null;
}

/**
 * Find duplicate responses with the same phone number
 */
async function findDuplicateResponse() {
  try {
    console.log('\n🔍 Searching for responses with phone number across ALL surveys and ALL statuses...');
    console.log(`📱 Phone Number: ${PHONE_NUMBER}`);
    console.log(`📝 Phone Question: "${PHONE_QUESTION_TEXT}"\n`);

    let excludedResponseId = null;
    
    // If a rejected response ID is provided, get it for reference
    if (REJECTED_RESPONSE_ID) {
      const rejectedResponse = await SurveyResponse.findOne({ responseId: REJECTED_RESPONSE_ID })
        .select('_id responseId survey responses createdAt status');

      if (rejectedResponse) {
        console.log(`✅ Found reference response:`);
        console.log(`   - MongoDB ID: ${rejectedResponse._id}`);
        console.log(`   - Response ID: ${rejectedResponse.responseId}`);
        console.log(`   - Survey ID: ${rejectedResponse.survey}`);
        console.log(`   - Status: ${rejectedResponse.status}`);
        console.log(`   - Created At: ${rejectedResponse.createdAt}\n`);

        // Verify the phone number in the rejected response
        const rejectedPhone = extractPhoneNumber(rejectedResponse.responses);
        if (rejectedPhone) {
          const normalizedRejected = rejectedPhone.replace(/[\s\-\(\)]/g, '');
          const normalizedTarget = PHONE_NUMBER.replace(/[\s\-\(\)]/g, '');
          console.log(`📱 Phone number in reference response: ${rejectedPhone} (normalized: ${normalizedRejected})`);
          if (normalizedRejected !== normalizedTarget) {
            console.log(`⚠️  Warning: Phone number in reference response (${rejectedPhone}) doesn't match target (${PHONE_NUMBER})`);
          }
        } else {
          console.log(`⚠️  Warning: Could not extract phone number from reference response`);
        }
        console.log('');
        excludedResponseId = rejectedResponse._id;
      } else {
        console.log(`⚠️  Reference response ID not found, continuing search...\n`);
      }
    }

    // Get ALL responses from ALL surveys and ALL statuses
    console.log('🔍 Searching through ALL survey responses...\n');
    const query = excludedResponseId 
      ? { _id: { $ne: excludedResponseId } }
      : {};
    
    const allResponses = await SurveyResponse.find(query)
      .select('_id responseId survey responses createdAt status')
      .sort({ createdAt: 1 });

    console.log(`📊 Found ${allResponses.length} total responses to check (excluding rejected response)\n`);

    // Search for responses with matching phone number
    const matchingResponses = [];
    let checkedCount = 0;
    let phoneFoundCount = 0;

    for (const response of allResponses) {
      checkedCount++;
      const phoneNumber = extractPhoneNumber(response.responses);
      
      if (phoneNumber) {
        phoneFoundCount++;
        // Normalize phone number for comparison
        const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
        const normalizedTarget = PHONE_NUMBER.replace(/[\s\-\(\)]/g, '');
        
        if (normalizedPhone === normalizedTarget) {
          matchingResponses.push({
            _id: response._id.toString(),
            responseId: response.responseId,
            survey: response.survey.toString(),
            createdAt: response.createdAt,
            status: response.status,
            phoneNumber: phoneNumber
          });
        }
      }
      
      // Progress update every 1000 responses
      if (checkedCount % 1000 === 0) {
        console.log(`   Checked ${checkedCount} responses, found ${phoneFoundCount} with phone numbers, ${matchingResponses.length} matches so far...`);
      }
    }

    console.log(`\n✅ Checked ${checkedCount} responses`);
    console.log(`   - Responses with phone numbers: ${phoneFoundCount}`);
    console.log(`   - Matching phone number ${PHONE_NUMBER}: ${matchingResponses.length}\n`);

    // Display results
    if (matchingResponses.length === 0) {
      console.log('❌ No duplicate responses found with the same phone number.\n');
    } else {
      console.log(`✅ Found ${matchingResponses.length} duplicate response(s) with phone number ${PHONE_NUMBER}:\n`);
      console.log('='.repeat(80));
      
      matchingResponses.forEach((match, index) => {
        console.log(`\n${index + 1}. Response ID: ${match.responseId || match._id}`);
        console.log(`   MongoDB ID: ${match._id}`);
        console.log(`   Survey ID: ${match.survey}`);
        console.log(`   Status: ${match.status}`);
        console.log(`   Created At: ${match.createdAt}`);
        console.log(`   Phone Number: ${match.phoneNumber}`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('\n📋 Summary:');
      console.log(`   - Rejected Response ID: ${REJECTED_RESPONSE_ID}`);
      console.log(`   - Phone Number: ${PHONE_NUMBER}`);
      console.log(`   - Duplicate responses found: ${matchingResponses.length}`);
      
      if (matchingResponses.length > 0) {
        console.log(`\n✅ Duplicate Response IDs:`);
        matchingResponses.forEach((match, index) => {
          const responseId = match.responseId || match._id;
          console.log(`   ${index + 1}. ${responseId} (Status: ${match.status}, Created: ${match.createdAt.toISOString()})`);
        });
      }
    }

    return matchingResponses;

  } catch (error) {
    console.error('❌ Error finding duplicate response:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await connectDB();
    const results = await findDuplicateResponse();
    
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { findDuplicateResponse };

