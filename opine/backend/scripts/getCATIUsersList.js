/**
 * Script to get CATI users list in format: Member ID - Name - Phone
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const phones = [
  '8250049424', '8370823975', '8509524647', '7063239381', '7719219779',
  '8250316305', '6295242103', '8944848649', '7384638012', '7407236511',
  '9382115873', '8967215263', '8597638130', '9064376368', '9046720791',
  '9332948136', '9647732765', '8167029266', '9064006902', '9775768489',
  '7478824785', '9593889417', '8293506338', '7679392167', '7501264295',
  '6295623404', '8391845069'
];

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    const users = await User.find({ phone: { $in: phones } })
      .select('memberId firstName lastName phone')
      .sort({ memberId: 1 });
    
    console.log('Member ID - Name - Phone');
    console.log('='.repeat(60));
    
    users.forEach(u => {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      console.log(`${u.memberId} - ${name} - ${u.phone}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

main();



