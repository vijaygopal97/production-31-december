// Test case-insensitive memberID matching
const testCases = ['CAPI299', 'capi299', 'Capi299', 'CAPi299', 'cApI299'];

const loginIdentifier = 'CAPI299';
const escapedMemberId = loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(`^${escapedMemberId}$`, 'i');

console.log('Testing case-insensitive memberID login:');
console.log('Original memberID:', loginIdentifier);
console.log('Escaped:', escapedMemberId);
console.log('Regex:', regex);
console.log('');

testCases.forEach(test => {
  const matches = regex.test(test);
  console.log(`"${test}" matches: ${matches ? '✅' : '❌'}`);
});



