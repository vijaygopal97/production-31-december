const axios = require('axios');
const baseURL = 'http://localhost:5000';

const testLogins = [
  { email: 'cati3586@gmail.com', password: '8250400240', name: 'ISRAJ AHMED FAKIR' },
  { email: 'cati3587@gmail.com', password: '6296752358', name: 'RIMA KHATUN' },
  { email: 'cati3588@gmail.com', password: '8509159662', name: 'ISMAIL SEIKH' },
  { email: 'cati3589@gmail.com', password: '9062951396', name: 'MANARANJAN NASKAR' }
];

(async () => {
  console.log('🔐 Testing logins through login endpoint on PRODUCTION...\n');
  let successCount = 0;
  let failCount = 0;
  
  for (const test of testLogins) {
    try {
      const response = await axios.post(`${baseURL}/api/auth/login`, {
        email: test.email,
        password: test.password
      });
      if (response.data.success) {
        console.log(`✅ ${test.name} (${test.email}): Login SUCCESS`);
        console.log(`   User ID: ${response.data.data.user._id}`);
        console.log(`   Member ID: ${response.data.data.user.memberId || 'N/A'}\n`);
        successCount++;
      } else {
        console.log(`❌ ${test.name} (${test.email}): Login FAILED - ${response.data.message}\n`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} (${test.email}): Login FAILED - ${error.response?.data?.message || error.message}\n`);
      failCount++;
    }
  }
  
  console.log('='.repeat(80));
  console.log(`\n📊 Login Test Summary:`);
  console.log(`   ✅ Success: ${successCount}/4`);
  console.log(`   ❌ Failed: ${failCount}/4`);
})();

