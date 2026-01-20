const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const Survey = require('../models/Survey');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SURVEY_ID = '68fd1915d41841da463f0d46';
const EXCEL_FILE_PATH = '/var/www/Report-Generation/ac224_output.xlsx';
const TARGET_AC_NAME = 'Kharagpur Sadar';

async function processAC224Contacts() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the survey
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName}`);

    // Read Excel file
    console.log(`\n📖 Reading Excel file: ${EXCEL_FILE_PATH}`);
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON - same format as uploadRespondentContacts
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: ['name', 'countryCode', 'phone', 'email', 'address', 'city', 'ac', 'pc', 'ps'],
      defval: '',
      raw: true
    });
    
    console.log(`📊 Total rows from Excel: ${data.length}`);

    // Filter out header rows (same logic as uploadRespondentContacts)
    const headerValues = ['name', 'country code', 'phone', 'email', 'address', 'city', 'ac', 'pc', 'ps'];
    const filteredData = data.filter(row => {
      const nameStr = row.name ? row.name.toString().toLowerCase().trim() : '';
      const phoneStr = row.phone ? row.phone.toString().toLowerCase().trim() : '';
      
      if (headerValues.includes(nameStr) || headerValues.includes(phoneStr)) {
        return false;
      }
      
      if (nameStr === 'name' || phoneStr === 'phone') {
        return false;
      }
      
      return true;
    });

    console.log(`📊 Filtered rows (after removing headers): ${filteredData.length}`);

    // Process contacts - same format as uploadRespondentContacts
    const contacts = [];
    const errors = [];

    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const actualIndex = i + 2; // +2 for header row and 0-index

      // Validate required fields
      if (!row.name || !row.phone) {
        errors.push(`Row ${actualIndex}: Missing name or phone`);
        continue;
      }

      // Clean phone number (same logic as uploadRespondentContacts)
      let cleanPhone = String(row.phone).trim().replace(/[^\d]/g, '');
      
      if (!cleanPhone || cleanPhone === '') {
        errors.push(`Row ${actualIndex}: Invalid phone number`);
        continue;
      }
      
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push(`Row ${actualIndex}: Invalid phone number format. Phone must be 10-15 digits (got ${cleanPhone.length} digits)`);
        continue;
      }
      
      if (!/^\d+$/.test(cleanPhone)) {
        errors.push(`Row ${actualIndex}: Phone number contains non-numeric characters`);
        continue;
      }

      // Handle country code
      let countryCode = '';
      if (row.countryCode !== null && row.countryCode !== undefined && row.countryCode !== '') {
        const countryCodeStr = String(row.countryCode).trim();
        countryCode = countryCodeStr.startsWith('+') ? countryCodeStr.substring(1) : countryCodeStr;
        countryCode = countryCode.replace(/[^\d]/g, '');
      }

      // Create contact object - CRITICAL: Set AC to "Kharagpur Sadar" for all contacts
      const contact = {
        name: row.name.toString().trim(),
        countryCode: countryCode || undefined,
        phone: cleanPhone,
        email: row.email ? row.email.toString().trim() : '',
        address: row.address ? row.address.toString().trim() : '',
        city: row.city ? row.city.toString().trim() : '',
        ac: TARGET_AC_NAME, // CRITICAL: Set AC to "Kharagpur Sadar" for all contacts
        pc: row.pc ? row.pc.toString().trim() : '',
        ps: row.ps ? row.ps.toString().trim() : '',
        addedAt: new Date().toISOString(),
        addedBy: 'system'
      };

      contacts.push(contact);
    }

    console.log(`\n✅ Processed ${contacts.length} valid contacts`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors encountered`);
      if (errors.length <= 20) {
        errors.forEach(err => console.log(`  - ${err}`));
      }
    }

    if (contacts.length === 0) {
      console.log('❌ No valid contacts to add');
      process.exit(0);
    }

    // STEP 1: Read existing contacts from JSON file (same as saveRespondentContacts)
    const jsonFilePath = path.join('/var/www/opine', 'data', 'respondent-contacts', `${SURVEY_ID}.json`);
    const jsonDir = path.dirname(jsonFilePath);
    
    // Ensure directory exists
    await fs.mkdir(jsonDir, { recursive: true });

    let allContacts = [];
    try {
      const fileContent = await fs.readFile(jsonFilePath, 'utf8');
      allContacts = JSON.parse(fileContent);
      if (!Array.isArray(allContacts)) {
        allContacts = [];
      }
      console.log(`📖 Read ${allContacts.length} existing contacts from JSON file`);
    } catch (fileError) {
      console.log(`📝 JSON file doesn't exist yet, will create new one`);
      allContacts = [];
    }

    // STEP 2: Filter out duplicates by phone number (same as saveRespondentContacts)
    const existingPhones = new Set(allContacts.map(c => c.phone).filter(Boolean));
    const newContacts = contacts.filter(c => !existingPhones.has(c.phone));

    console.log(`\n📊 Contacts analysis:`);
    console.log(`  - Total from Excel: ${contacts.length}`);
    console.log(`  - Existing in JSON: ${allContacts.length}`);
    console.log(`  - New contacts to add: ${newContacts.length}`);
    console.log(`  - Duplicates skipped: ${contacts.length - newContacts.length}`);

    if (newContacts.length === 0) {
      console.log('✅ All contacts already exist in JSON file');
    } else {
      // STEP 3: Add new contacts to JSON file (same as saveRespondentContacts)
      allContacts = [...newContacts, ...allContacts];
      const jsonString = JSON.stringify(allContacts, null, 2);
      await fs.writeFile(jsonFilePath, jsonString, 'utf8');
      console.log(`✅ Added ${newContacts.length} contacts to JSON file: ${jsonFilePath}`);
    }

    // STEP 4: Update survey to reference JSON file if not already set (same as saveRespondentContacts)
    if (!survey.respondentContactsFile) {
      await Survey.findByIdAndUpdate(SURVEY_ID, {
        respondentContactsFile: `data/respondent-contacts/${SURVEY_ID}.json`
      });
      console.log(`✅ Updated survey to reference JSON file`);
    }

    // STEP 5: Update AC name to "Kharagpur Sadar" for existing contacts in JSON file
    let updatedACCount = 0;
    const phonesToUpdate = new Set(contacts.map(c => c.phone));
    for (const contact of allContacts) {
      if (phonesToUpdate.has(contact.phone) && contact.ac !== TARGET_AC_NAME) {
        contact.ac = TARGET_AC_NAME;
        updatedACCount++;
      }
    }

    if (updatedACCount > 0) {
      const jsonString = JSON.stringify(allContacts, null, 2);
      await fs.writeFile(jsonFilePath, jsonString, 'utf8');
      console.log(`✅ Updated AC name to "${TARGET_AC_NAME}" for ${updatedACCount} existing contacts in JSON file`);
    }

    // STEP 6: Create queue entries for ALL contacts from Excel (both new and existing)
    // Check for duplicate phones in queue
    const existingQueuePhones = await CatiRespondentQueue.distinct(
      'respondentContact.phone',
      { survey: SURVEY_ID }
    );
    const existingQueuePhonesSet = new Set(existingQueuePhones.filter(Boolean));
    console.log(`📊 Found ${existingQueuePhonesSet.size} existing phone numbers in queue`);

    // CRITICAL: Create queue entries for ALL contacts from Excel that aren't in queue yet
    // This includes both newContacts and existing contacts that might not be in queue
    const contactsForQueue = contacts.filter(contact => {
      const phone = contact.phone || '';
      return phone && !existingQueuePhonesSet.has(phone);
    });

    console.log(`\n📊 Queue creation analysis:`);
    console.log(`  - Total contacts from Excel: ${contacts.length}`);
    console.log(`  - Already in queue: ${contacts.length - contactsForQueue.length}`);
    console.log(`  - Need to add to queue: ${contactsForQueue.length}`);

      if (contactsForQueue.length > 0) {
        // Create queue entries (same format as saveRespondentContacts)
        const queueEntries = contactsForQueue.map(contact => ({
          survey: SURVEY_ID,
          respondentContact: {
            name: contact.name || '',
            countryCode: contact.countryCode || '',
            phone: contact.phone || '',
            email: contact.email || '',
            address: contact.address || '',
            city: contact.city || '',
            ac: contact.ac || '', // This will be "Kharagpur Sadar"
            pc: contact.pc || '',
            ps: contact.ps || ''
          },
          status: 'pending',
          currentAttemptNumber: 0
        }));

        // Process in batches (same as saveRespondentContacts)
        const BATCH_SIZE = 5000;
        let totalInserted = 0;
        let totalBatches = Math.ceil(queueEntries.length / BATCH_SIZE);
        console.log(`\n📦 Processing ${queueEntries.length} queue entries in ${totalBatches} batches of ${BATCH_SIZE}...`);

        for (let i = 0; i < queueEntries.length; i += BATCH_SIZE) {
          const batch = queueEntries.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

          try {
            await CatiRespondentQueue.insertMany(batch, {
              ordered: false,
              lean: false
            });
            totalInserted += batch.length;
            console.log(`✅ Batch ${batchNumber}/${totalBatches} completed: ${batch.length} entries inserted (Total: ${totalInserted}/${queueEntries.length})`);

            // Small delay between batches
            if (i + BATCH_SIZE < queueEntries.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (batchError) {
            console.error(`⚠️ Error inserting batch ${batchNumber}:`, batchError.message);
            if (batchError.writeErrors && batchError.writeErrors.length > 0) {
              console.error(`⚠️ ${batchError.writeErrors.length} entries failed in batch ${batchNumber}`);
            }
          }
        }

        console.log(`\n✅ Queue creation completed: ${totalInserted}/${queueEntries.length} entries inserted successfully`);
    } else {
      console.log(`ℹ️ All ${contacts.length} contacts from Excel are already in queue`);
    }

    // STEP 7: Update AC name in existing queue entries
    console.log(`\n🔄 Updating AC name in existing queue entries...`);
    const updateResult = await CatiRespondentQueue.updateMany(
      {
        survey: SURVEY_ID,
        'respondentContact.phone': { $in: contacts.map(c => c.phone) },
        'respondentContact.ac': { $ne: TARGET_AC_NAME }
      },
      {
        $set: {
          'respondentContact.ac': TARGET_AC_NAME
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`✅ Updated AC name to "${TARGET_AC_NAME}" for ${updateResult.modifiedCount} existing queue entries`);
    } else {
      console.log(`ℹ️ No queue entries needed AC update (already correct)`);
    }

    // STEP 8: Verify AC name in queue
    console.log(`\n🔍 Verification:`);
    const kharagpurCount = await CatiRespondentQueue.countDocuments({
      survey: SURVEY_ID,
      status: 'pending',
      'respondentContact.ac': TARGET_AC_NAME
    });
    console.log(`  - Pending "Kharagpur Sadar" contacts in queue: ${kharagpurCount}`);

    const totalPending = await CatiRespondentQueue.countDocuments({
      survey: SURVEY_ID,
      status: 'pending'
    });
    console.log(`  - Total pending contacts in queue: ${totalPending}`);

    // Generate summary report
    const summary = {
      generatedAt: new Date().toISOString(),
      excelFile: EXCEL_FILE_PATH,
      surveyId: SURVEY_ID,
      targetACName: TARGET_AC_NAME,
      totalRowsInExcel: data.length,
      filteredRows: filteredData.length,
      validContacts: contacts.length,
      errors: errors.length,
      existingInJSON: allContacts.length - newContacts.length,
      newContactsAdded: newContacts.length,
      duplicatesSkipped: contacts.length - newContacts.length,
      queueEntriesCreated: contactsForQueue?.length || 0,
      pendingKharagpurCount: kharagpurCount,
      totalPendingInQueue: totalPending,
      errors: errors.slice(0, 100) // Limit errors in report
    };

    const reportPath = path.join(__dirname, `../reports/ac224-contacts-processing-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\n✅ Summary report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(70));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Added ${newContacts.length} contacts to JSON file`);
    console.log(`✅ Created ${contactsForQueue?.length || 0} queue entries`);
    console.log(`✅ All contacts have AC set to: "${TARGET_AC_NAME}"`);
    console.log(`✅ Pending "Kharagpur Sadar" contacts in queue: ${kharagpurCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error processing contacts:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
processAC224Contacts();

