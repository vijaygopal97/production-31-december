const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');

// Get MongoDB URI from environment or use default
const mongoUri = process.env.MONGODB_URI || 'mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine';

// Connect to MongoDB
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 300000,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const findNAACResponses = async () => {
  try {
    // Get survey ID from command line or use default
    const surveyId = process.argv[2] || '68fd1915d41841da463f0d46';
    console.log(`🔍 Finding responses with N/A AC for survey: ${surveyId}\n`);

    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      console.error('❌ Survey not found');
      process.exit(1);
    }

    // Build match filter (same as getACWiseStatsV2)
    const matchFilter = {
      survey: new mongoose.Types.ObjectId(surveyId),
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    };

    // Fetch all responses that match the filter
    console.log('📊 Fetching responses...');
    const responses = await SurveyResponse.find(matchFilter)
      .select('_id selectedAC selectedPollingStation responses status createdAt interviewMode interviewer')
      .lean();

    console.log(`📊 Total responses found: ${responses.length}\n`);

    // AC extraction logic (same as aggregation pipeline)
    const extractAC = (response) => {
      // Priority 1: selectedAC
      if (response.selectedAC && 
          response.selectedAC !== '' && 
          response.selectedAC !== 'N/A' &&
          response.selectedAC.trim().length > 2) {
        return response.selectedAC.trim();
      }

      // Priority 2: selectedPollingStation.acName
      if (response.selectedPollingStation?.acName && 
          response.selectedPollingStation.acName !== '' && 
          response.selectedPollingStation.acName !== 'N/A' &&
          response.selectedPollingStation.acName.trim().length > 2) {
        return response.selectedPollingStation.acName.trim();
      }

      // Priority 3: responses array - questionId === 'ac-selection'
      if (response.responses && Array.isArray(response.responses)) {
        const acSelectionResponse = response.responses.find(r => r.questionId === 'ac-selection');
        if (acSelectionResponse && acSelectionResponse.response) {
          let acValue = '';
          if (Array.isArray(acSelectionResponse.response)) {
            acValue = acSelectionResponse.response[0] || '';
          } else {
            acValue = acSelectionResponse.response || '';
          }
          
          // Strip translation braces
          if (typeof acValue === 'string') {
            const openBraceIndex = acValue.indexOf('{');
            if (openBraceIndex !== -1) {
              acValue = acValue.substring(0, openBraceIndex).trim();
            } else {
              acValue = acValue.trim();
            }
          } else {
            acValue = String(acValue).trim();
          }

          if (acValue && acValue !== '' && acValue !== 'N/A' && acValue.length > 2) {
            // Validate: not common invalid values
            const lower = acValue.toLowerCase();
            const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
            if (!invalidValues.includes(lower) && !lower.match(/^yes[\s_]|^no[\s_]/)) {
              return acValue;
            }
          }
        }

        // Priority 4: questionType === 'ac_selection' || 'assembly_constituency' || 'ac'
        const acTypeResponse = response.responses.find(r => 
          (r.questionType === 'ac_selection' || 
           r.questionType === 'assembly_constituency' ||
           r.questionType === 'ac') && 
          r.response
        );
        if (acTypeResponse) {
          let acValue = '';
          if (Array.isArray(acTypeResponse.response)) {
            acValue = acTypeResponse.response[0] || '';
          } else {
            acValue = acTypeResponse.response || '';
          }
          
          // Strip translation braces
          if (typeof acValue === 'string') {
            const openBraceIndex = acValue.indexOf('{');
            if (openBraceIndex !== -1) {
              acValue = acValue.substring(0, openBraceIndex).trim();
            } else {
              acValue = acValue.trim();
            }
          } else {
            acValue = String(acValue).trim();
          }

          if (acValue && acValue !== '' && acValue !== 'N/A' && acValue.length > 2) {
            const lower = acValue.toLowerCase();
            const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
            if (!invalidValues.includes(lower) && !lower.match(/^yes[\s_]|^no[\s_]/)) {
              return acValue;
            }
          }
        }

        // Priority 5: questionText contains "assembly" or "constituency"
        const acTextResponses = response.responses.filter(r => {
          if (!r.questionText || !r.response) return false;
          const questionText = (r.questionText || '').toLowerCase();
          const hasAssembly = questionText.includes('assembly');
          const hasConstituency = questionText.includes('constituency');
          const isConsentQuestion = questionText.includes('consent') || 
                                    questionText.includes('agree') ||
                                    questionText.includes('participate') ||
                                    questionText.includes('willing');
          return (hasAssembly || hasConstituency) && !isConsentQuestion;
        });

        for (const acResponse of acTextResponses) {
          let acValue = '';
          if (Array.isArray(acResponse.response)) {
            acValue = acResponse.response[0] || '';
          } else {
            acValue = acResponse.response || '';
          }
          
          // Strip translation braces
          if (typeof acValue === 'string') {
            const openBraceIndex = acValue.indexOf('{');
            if (openBraceIndex !== -1) {
              acValue = acValue.substring(0, openBraceIndex).trim();
            } else {
              acValue = acValue.trim();
            }
          } else {
            acValue = String(acValue).trim();
          }

          if (acValue && acValue !== '' && acValue !== 'N/A' && acValue.length > 2) {
            const lower = acValue.toLowerCase();
            const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
            if (!invalidValues.includes(lower) && !lower.match(/^yes[\s_]|^no[\s_]/)) {
              return acValue;
            }
          }
        }
      }

      return null;
    };

    // Find responses with N/A AC
    const naResponses = [];
    responses.forEach(response => {
      const extractedAC = extractAC(response);
      if (!extractedAC) {
        naResponses.push({
          _id: response._id,
          selectedAC: response.selectedAC,
          selectedPollingStation: response.selectedPollingStation,
          status: response.status,
          createdAt: response.createdAt,
          interviewMode: response.interviewMode,
          interviewer: response.interviewer,
          hasResponsesArray: response.responses && Array.isArray(response.responses),
          responsesCount: response.responses ? response.responses.length : 0,
          // Find AC-related responses for debugging
          acRelatedResponses: response.responses ? response.responses.filter(r => {
            const questionId = (r.questionId || '').toLowerCase();
            const questionType = (r.questionType || '').toLowerCase();
            const questionText = (r.questionText || '').toLowerCase();
            return questionId.includes('ac') || 
                   questionId === 'ac-selection' ||
                   questionType.includes('ac') ||
                   questionType === 'ac_selection' ||
                   questionType === 'assembly_constituency' ||
                   questionText.includes('assembly') ||
                   questionText.includes('constituency');
          }).map(r => ({
            questionId: r.questionId,
            questionType: r.questionType,
            questionText: r.questionText ? r.questionText.substring(0, 100) : null,
            response: Array.isArray(r.response) ? r.response[0] : r.response
          })) : []
        });
      }
    });

    console.log(`\n📋 Found ${naResponses.length} responses with N/A AC:\n`);
    console.log('='.repeat(100));
    
    // Group by reason
    const byReason = {
      noSelectedAC: [],
      noPollingStationAC: [],
      noResponsesArray: [],
      noACInResponses: [],
      invalidACValue: []
    };

    naResponses.forEach(resp => {
      if (!resp.selectedAC && !resp.selectedPollingStation?.acName && (!resp.responses || resp.responses.length === 0)) {
        byReason.noResponsesArray.push(resp._id);
      } else if (!resp.selectedAC && !resp.selectedPollingStation?.acName && resp.acRelatedResponses.length === 0) {
        byReason.noACInResponses.push(resp._id);
      } else if (!resp.selectedAC && !resp.selectedPollingStation?.acName) {
        byReason.noSelectedAC.push(resp._id);
      } else if (resp.acRelatedResponses.length > 0) {
        byReason.invalidACValue.push(resp._id);
      } else {
        byReason.noPollingStationAC.push(resp._id);
      }
    });

    console.log('\n📊 Breakdown by reason:');
    console.log(`  - No selectedAC, no pollingStation.acName, no responses array: ${byReason.noResponsesArray.length}`);
    console.log(`  - No selectedAC, no pollingStation.acName, no AC in responses: ${byReason.noACInResponses.length}`);
    console.log(`  - No selectedAC, no pollingStation.acName: ${byReason.noSelectedAC.length}`);
    console.log(`  - Has AC-related responses but invalid values: ${byReason.invalidACValue.length}`);
    console.log(`  - No pollingStation.acName: ${byReason.noPollingStationAC.length}`);

    console.log('\n\n📝 Object IDs of all N/A AC responses:\n');
    naResponses.forEach((resp, index) => {
      console.log(`${index + 1}. ${resp._id}`);
      console.log(`   Status: ${resp.status}`);
      console.log(`   Created: ${resp.createdAt}`);
      console.log(`   Mode: ${resp.interviewMode || 'N/A'}`);
      console.log(`   selectedAC: ${resp.selectedAC || 'null'}`);
      console.log(`   pollingStation.acName: ${resp.selectedPollingStation?.acName || 'null'}`);
      console.log(`   Has responses array: ${resp.hasResponsesArray}`);
      console.log(`   Responses count: ${resp.responsesCount}`);
      if (resp.acRelatedResponses.length > 0) {
        console.log(`   AC-related responses found: ${resp.acRelatedResponses.length}`);
        resp.acRelatedResponses.forEach((acResp, idx) => {
          console.log(`     ${idx + 1}. questionId: ${acResp.questionId || 'N/A'}, questionType: ${acResp.questionType || 'N/A'}`);
          console.log(`        response: ${JSON.stringify(acResp.response).substring(0, 100)}`);
        });
      }
      console.log('');
    });

    // Export to JSON file
    const fs = require('fs');
    const outputFile = `na_ac_responses_${surveyId}_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      surveyId,
      totalResponses: responses.length,
      naResponsesCount: naResponses.length,
      breakdown: {
        noResponsesArray: byReason.noResponsesArray.length,
        noACInResponses: byReason.noACInResponses.length,
        noSelectedAC: byReason.noSelectedAC.length,
        invalidACValue: byReason.invalidACValue.length,
        noPollingStationAC: byReason.noPollingStationAC.length
      },
      objectIds: naResponses.map(r => r._id.toString()),
      details: naResponses
    }, null, 2));
    console.log(`\n💾 Detailed results saved to: ${outputFile}`);

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

findNAACResponses();

