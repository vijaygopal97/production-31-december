const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

const MEMBER_ID = '3585';
const FULL_NAME = 'PUJA BAR';
const PHONE = '7047471472';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';

const nameParts = FULL_NAME.trim().split(/\s+/);
const FIRST_NAME = nameParts[0] || 'CATI';
const LAST_NAME = nameParts.slice(1).join(' ') || 'Interviewer';
const EMAIL = `cati${MEMBER_ID}@gmail.com`;
const PASSWORD = PHONE;

const UserSchema = require('../models/User').schema;
const SurveySchema = require('../models/Survey').schema;
const CompanySchema = require('../models/Company').schema;

let devConnection, prodConnection, DevUser, ProdUser, DevSurvey, ProdSurvey, DevCompany, ProdCompany;

async function connectDatabases() {
  devConnection = await mongoose.createConnection(DEV_MONGO_URI);
  DevUser = devConnection.model('User', UserSchema);
  DevSurvey = devConnection.model('Survey', SurveySchema);
  DevCompany = devConnection.model('Company', CompanySchema);
  prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
  ProdUser = prodConnection.model('User', UserSchema);
  ProdSurvey = prodConnection.model('Survey', SurveySchema);
  ProdCompany = prodConnection.model('Company', CompanySchema);
  console.log('✅ Connected to both databases\n');
}

async function getReferenceUser(UserModel) {
  let ref = await UserModel.findOne({ userType: 'interviewer', interviewModes: 'CATI (Telephonic interview)', status: 'active' }).populate('company');
  if (!ref) ref = await UserModel.findOne({ userType: 'interviewer', status: 'active' }).populate('company');
  if (!ref) ref = await UserModel.findOne({ userType: 'company_admin', status: 'active' }).populate('company');
  if (!ref) throw new Error('No reference user found');
  return ref;
}

async function getCompanyAdmin(UserModel) {
  return await UserModel.findOne({ userType: 'company_admin', companyCode: COMPANY_CODE, status: 'active' });
}

async function createOrUpdateInterviewer(UserModel, dbName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`👤 Processing ${dbName.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);

  const referenceUser = await getReferenceUser(UserModel);
  let phone = PHONE;
  if (!phone.startsWith('+')) phone = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;

  const existingUser = await UserModel.findOne({ $or: [{ email: EMAIL.toLowerCase() }, { phone }, { memberId: MEMBER_ID }] }).select('+password');

  if (existingUser) {
    console.log(`⚠️  User exists. Updating...`);
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(PASSWORD, salt);
    await UserModel.updateOne({ _id: existingUser._id }, { $set: { firstName: FIRST_NAME, lastName: LAST_NAME, email: EMAIL.toLowerCase(), phone, memberId: MEMBER_ID, password: hashedPassword, userType: 'interviewer', interviewModes: 'CATI (Telephonic interview)', company: referenceUser.company?._id || referenceUser.company, companyCode: referenceUser.companyCode || COMPANY_CODE, status: 'active', isEmailVerified: true, isPhoneVerified: true } });
    const updatedUser = await UserModel.findById(existingUser._id).select('+password');
    const passwordValid = await updatedUser.comparePassword(PASSWORD);
    if (!passwordValid) {
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(PASSWORD, retrySalt);
      await UserModel.updateOne({ _id: existingUser._id }, { $set: { password: retryHashedPassword } });
    }
    console.log(`✅ Updated: ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email})`);
    console.log(`   Member ID: ${updatedUser.memberId}, Mode: ${updatedUser.interviewModes}\n`);
    return updatedUser;
  } else {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(PASSWORD, salt);
    const newUser = new UserModel({ firstName: FIRST_NAME, lastName: LAST_NAME, email: EMAIL.toLowerCase(), phone, memberId: MEMBER_ID, password: hashedPassword, userType: 'interviewer', interviewModes: 'CATI (Telephonic interview)', company: referenceUser.company?._id || referenceUser.company, companyCode: referenceUser.companyCode || COMPANY_CODE, status: 'active', isEmailVerified: true, isPhoneVerified: true });
    const savedUser = await newUser.save();
    const passwordValid = await savedUser.comparePassword(PASSWORD);
    if (!passwordValid) {
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(PASSWORD, retrySalt);
      await UserModel.updateOne({ _id: savedUser._id }, { $set: { password: retryHashedPassword } });
    }
    console.log(`✅ Created: ${savedUser.firstName} ${savedUser.lastName} (${savedUser.email})`);
    console.log(`   Member ID: ${savedUser.memberId}, Mode: ${savedUser.interviewModes}\n`);
    return savedUser;
  }
}

async function assignToSurvey(SurveyModel, interviewerId, assignedById, dbName) {
  const survey = await SurveyModel.findById(SURVEY_ID);
  if (!survey) throw new Error(`Survey not found in ${dbName}`);
  const existing = survey.catiInterviewers?.find(a => a.interviewer.toString() === interviewerId.toString());
  if (existing) {
    console.log(`⚠️  Already assigned to survey\n`);
    return false;
  }
  if (!survey.catiInterviewers) survey.catiInterviewers = [];
  survey.catiInterviewers.push({ interviewer: interviewerId, assignedBy: assignedById, assignedAt: new Date(), status: 'assigned', maxInterviews: 0, completedInterviews: 0 });
  await survey.save();
  console.log(`✅ Assigned to survey successfully!\n`);
  return true;
}

async function processDatabase(UserModel, SurveyModel, dbName) {
  const interviewer = await createOrUpdateInterviewer(UserModel, dbName);
  const companyAdmin = await getCompanyAdmin(UserModel);
  const assignedBy = companyAdmin ? companyAdmin._id : interviewer._id;
  const assigned = await assignToSurvey(SurveyModel, interviewer._id, assignedBy, dbName);
  return { interviewerId: interviewer._id.toString(), name: `${interviewer.firstName} ${interviewer.lastName}`, email: interviewer.email, assigned };
}

async function main() {
  try {
    console.log('🚀 Adding CATI Interviewer 3585\n');
    console.log(`Member ID: ${MEMBER_ID}`);
    console.log(`Name: ${FIRST_NAME} ${LAST_NAME}`);
    console.log(`Email: ${EMAIL}`);
    console.log(`Phone: ${PHONE}`);
    console.log(`Password: ${PASSWORD}\n`);

    await connectDatabases();
    const devResults = await processDatabase(DevUser, DevSurvey, 'development');
    const prodResults = await processDatabase(ProdUser, ProdSurvey, 'production');

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log('\nDEVELOPMENT:');
    console.log(`   Name: ${devResults.name}`);
    console.log(`   Email: ${devResults.email}`);
    console.log(`   Assigned: ${devResults.assigned ? 'Yes' : 'No'}`);
    console.log('\nPRODUCTION:');
    console.log(`   Name: ${prodResults.name}`);
    console.log(`   Email: ${prodResults.email}`);
    console.log(`   Assigned: ${prodResults.assigned ? 'Yes' : 'No'}`);
    console.log(`\n✅ Complete!\n`);

    await devConnection.close();
    await prodConnection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    if (devConnection) await devConnection.close();
    if (prodConnection) await prodConnection.close();
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { main };
