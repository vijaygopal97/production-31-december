const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MongoDB URI not found in environment variables');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('mongo')).join(', '));
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to production database');
    
    const db = mongoose.connection.db;
    const collection = db.collection('surveyresponses');
    
    // Find the rejected response
    const rejectedResponse = await collection.findOne({ 
      responseId: '9a0c8d71-1440-4508-bd07-2fe4ad744c09'
    });
    
    if (!rejectedResponse) {
      console.log('❌ Response not found with responseId: 9a0c8d71-1440-4508-bd07-2fe4ad744c09');
      process.exit(1);
    }
    
    console.log('\n📋 Rejected Response Details:');
    console.log('Response ID (_id):', rejectedResponse._id);
    console.log('Response ID (responseId):', rejectedResponse.responseId);
    console.log('Survey ID:', rejectedResponse.survey);
    console.log('Status:', rejectedResponse.status);
    console.log('Rejection Reason:', rejectedResponse.rejectionReason || rejectedResponse.feedback || rejectedResponse.autoRejectionReason || 'Not specified');
    
    // Find phone number in responses array
    let phoneNumber = null;
    if (rejectedResponse.responses && Array.isArray(rejectedResponse.responses)) {
      const phoneResponse = rejectedResponse.responses.find(r => {
        const text = (r.questionText || '').toLowerCase();
        return text.includes('phone') || text.includes('mobile') || text.includes('contact') || text.includes('number');
      });
      phoneNumber = phoneResponse?.response;
    }
    
    phoneNumber = phoneNumber || rejectedResponse.respondentPhoneNumber || rejectedResponse.phoneNumber || rejectedResponse.respondent?.phoneNumber;
    
    if (!phoneNumber) {
      console.log('\n❌ Phone number not found');
      console.log('Available fields:', Object.keys(rejectedResponse).slice(0, 20).join(', '));
      if (rejectedResponse.responses && rejectedResponse.responses.length > 0) {
        console.log('\nSample responses:');
        rejectedResponse.responses.slice(0, 5).forEach((r, i) => {
          console.log(`  ${i+1}. Question: ${(r.questionText || '').substring(0, 60)}...`);
          console.log(`     Response: ${JSON.stringify(r.response)}`);
        });
      }
      process.exit(1);
    }
    
    // Clean phone number
    const cleanPhone = String(phoneNumber).replace(/[\s\-+\(\)]/g, '');
    const phoneWithoutCountry = cleanPhone.replace(/^91/, '');
    
    console.log('\n📞 Phone Number Found:', phoneNumber);
    console.log('📞 Clean Phone Number:', cleanPhone);
    console.log('📞 Phone without country code:', phoneWithoutCountry);
    
    // Find all responses with the same phone number
    const allResponses = await collection.find({
      $or: [
        { 'responses.response': phoneNumber },
        { 'responses.response': cleanPhone },
        { 'responses.response': phoneWithoutCountry },
        { 'responses.response': { $regex: phoneWithoutCountry, $options: 'i' } },
        { respondentPhoneNumber: phoneNumber },
        { respondentPhoneNumber: cleanPhone },
        { phoneNumber: phoneNumber },
        { phoneNumber: cleanPhone }
      ]
    }).sort({ createdAt: 1 }).toArray();
    
    console.log('\n🔍 Found', allResponses.length, 'responses with the same phone number:');
    console.log('\n' + '='.repeat(80));
    
    allResponses.forEach((resp, index) => {
      const isRejected = (resp.responseId === '9a0c8d71-1440-4508-bd07-2fe4ad744c09');
      console.log('\n' + (index + 1) + '. Response ID:', resp.responseId || resp._id);
      console.log('   Survey ID:', resp.survey);
      console.log('   Status:', resp.status, isRejected ? '(THIS ONE - REJECTED)' : '');
      console.log('   Created At:', resp.createdAt);
      console.log('   Interviewer:', resp.interviewer ? (resp.interviewer.firstName || '') + ' ' + (resp.interviewer.lastName || '') : 'N/A');
      console.log('   Rejection Reason:', resp.rejectionReason || resp.feedback || resp.autoRejectionReason || 'N/A');
      
      if (resp.responses && Array.isArray(resp.responses)) {
        const phoneResp = resp.responses.find(r => {
          const text = (r.questionText || '').toLowerCase();
          return text.includes('phone') || text.includes('mobile') || text.includes('contact');
        });
        if (phoneResp) {
          console.log('   Phone from responses:', phoneResp.response);
        }
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Total responses with phone ${phoneNumber}: ${allResponses.length}`);
    console.log(`   Rejected responses: ${allResponses.filter(r => r.status === 'Rejected').length}`);
    console.log(`   Approved responses: ${allResponses.filter(r => r.status === 'Approved').length}`);
    console.log(`   Pending responses: ${allResponses.filter(r => r.status === 'Pending_Approval').length}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });

