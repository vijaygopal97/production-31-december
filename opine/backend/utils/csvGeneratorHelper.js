const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');
const assemblyConstituenciesData = require('../data/assemblyConstituencies.json');
const acRegionDistrictMapping = require('../data/ac_region_district_mapping.json');

// Directory to store generated CSV files
const CSV_STORAGE_DIR = path.join(__dirname, '../generated-csvs');

/**
 * Generate CSV file for a survey and save it
 * @param {string} surveyId - Survey ID
 * @param {string} downloadMode - 'codes' or 'responses'
 */
const generateCSVForSurvey = async (surveyId, downloadMode = 'codes') => {
  try {
    console.log(`📄 Generating CSV for survey ${surveyId}, mode: ${downloadMode}`);
    
    // Fetch survey with full population
    const survey = await Survey.findById(surveyId).lean();
    if (!survey) {
      throw new Error(`Survey ${surveyId} not found`);
    }
    
    // Fetch responses using aggregation pipeline (more efficient for large datasets)
    // This matches the default state when opening /responses-v2 page: 'approved_rejected_pending'
    const mongoose = require('mongoose');
    
    // Build aggregation pipeline similar to getSurveyResponsesV2
    const pipeline = [];
    
    // Stage 1: Match filter
    const matchFilter = { 
      survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId,
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval', 'approved', 'rejected', 'pending_approval'] }
    };
    pipeline.push({ $match: matchFilter });
    
    // Stage 2: Sort by createdAt ascending (oldest first) for CSV
    pipeline.push({ $sort: { createdAt: 1 } });
    
    // Stage 3: Lookup interviewer details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'interviewer',
        foreignField: '_id',
        as: 'interviewerDetails'
      }
    });
    pipeline.push({
      $unwind: {
        path: '$interviewerDetails',
        preserveNullAndEmptyArrays: true
      }
    });
    
    // Stage 4: Project fields needed for CSV generation
    pipeline.push({
      $project: {
        _id: 1,
        survey: 1,
        interviewer: 1,
        status: 1,
        interviewMode: 1,
        createdAt: 1,
        updatedAt: 1,
        responses: 1,
        selectedAC: 1,
        selectedPollingStation: 1,
        location: 1,
        verificationData: 1,
        audioRecording: 1,
        qcBatch: 1,
        responseId: 1,
        call_id: 1,
        // Map interviewerDetails to interviewer for compatibility
        interviewer: {
          firstName: { $ifNull: ['$interviewerDetails.firstName', ''] },
          lastName: { $ifNull: ['$interviewerDetails.lastName', ''] },
          email: { $ifNull: ['$interviewerDetails.email', ''] },
          memberId: { $ifNull: ['$interviewerDetails.memberId', ''] },
          memberID: { $ifNull: ['$interviewerDetails.memberId', ''] }
        }
      }
    });
    
    // Execute aggregation with allowDiskUse for large datasets
    console.log(`📊 Fetching responses using aggregation pipeline...`);
    const responses = await SurveyResponse.aggregate(pipeline, {
      allowDiskUse: true,
      maxTimeMS: 600000 // 10 minutes timeout for large datasets
    });
    
    console.log(`📊 Found ${responses.length} responses`);
    
    if (responses.length === 0) {
      console.log(`⚠️  No responses found for survey ${surveyId}`);
      await saveEmptyCSV(surveyId, downloadMode);
      return;
    }
    
    // Responses are already sorted oldest first (createdAt: 1)
    const sortedResponses = responses;
    
    // Generate CSV content
    const csvContent = await generateCSVContent(survey, sortedResponses, downloadMode, surveyId);
    
    // Save CSV file
    await saveCSVFile(surveyId, downloadMode, csvContent);
    
    console.log(`✅ CSV file saved for survey ${surveyId}, mode: ${downloadMode}`);
  } catch (error) {
    console.error(`❌ Error generating CSV for survey ${surveyId}:`, error);
    throw error;
  }
};

/**
 * Generate CSV content - FULL PORT FROM FRONTEND
 */
const generateCSVContent = async (survey, sortedResponses, downloadMode, surveyId) => {
  const surveyIdStr = String(surveyId || survey?._id || survey?.id || '');
  
  // Helper function to get main text (removes translation markers)
  // Handles formats: "Main Text {Translation}", "Main Text {T1{T2{T3}}}", "[en:English][hi:Hindi]"
  const getMainText = (text) => {
    if (!text) return '';
    const textStr = String(text);
    
    // First, remove [en:...] format translation markers
    let cleaned = textStr.replace(/\[.*?\]/g, '').trim();
    
    // Then, handle {Translation} format - extract text before first opening brace
    // This handles formats like "yes_{হ্যাঁ}", "television_news_{টেলিভিশন_সংবাদ}"
    const openBraceIndex = cleaned.indexOf('{');
    if (openBraceIndex !== -1) {
      cleaned = cleaned.substring(0, openBraceIndex).trim();
      // Remove trailing underscores (common in format like "yes_{...}")
      cleaned = cleaned.replace(/_+$/, '').trim();
    }
    
    return cleaned;
  };
  
  // Helper function to check if option is "Others"
  const isOthersOption = (optText) => {
    if (!optText) return false;
    const normalized = String(optText).toLowerCase().trim();
    return normalized === 'other' || 
           normalized === 'others' || 
           (normalized.includes('other') && (normalized.includes('specify') || normalized.includes('please') || normalized.includes('(specify)')));
  };
  
  // Helper function to extract "Others" text from response
  const extractOthersText = (responseValue) => {
    if (!responseValue) return null;
    const responseStr = String(responseValue);
    if (responseStr.startsWith('Others: ')) {
      return responseStr.substring(8);
    }
    return null;
  };
  
  // Helper function to format response display text
  const formatResponseDisplay = (response, surveyQuestion) => {
    if (!response || response === null || response === undefined) {
      return 'No response';
    }
    if (Array.isArray(response)) {
      if (response.length === 0) return 'No selections';
      const displayTexts = response.map(value => {
        if (surveyQuestion && surveyQuestion.options) {
          const option = surveyQuestion.options.find(opt => opt.value === value);
          return option ? getMainText(option.text || option.value || value) : value;
        }
        return value;
      });
      return displayTexts.join(', ');
    }
    if (typeof response === 'string' || typeof response === 'number') {
      if (surveyQuestion && surveyQuestion.options) {
        const option = surveyQuestion.options.find(opt => opt.value === response);
        return option ? getMainText(option.text || option.value || response.toString()) : response.toString();
      }
      return response.toString();
    }
    return JSON.stringify(response);
  };
  
  // Get all questions from survey
  const getAllSurveyQuestions = (survey) => {
    if (!survey) return [];
    const actualSurvey = survey.survey || survey;
    let allQuestions = [];
    
    if (actualSurvey?.sections && Array.isArray(actualSurvey.sections)) {
      actualSurvey.sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          allQuestions.push(...section.questions);
        }
      });
    }
    
    if (actualSurvey?.questions && Array.isArray(actualSurvey.questions)) {
      allQuestions.push(...actualSurvey.questions);
    }
    
    allQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
    return allQuestions;
  };
  
  // Helper function to check if question is AC or polling station selection
  const isACOrPollingStationQuestion = (question) => {
    if (question.id === 'ac-selection') return true;
    if (question.type === 'polling_station') return true;
    const questionText = question.text || question.questionText || '';
    if (questionText.toLowerCase().includes('select assembly constituency') || 
        questionText.toLowerCase().includes('select polling station')) {
      return true;
    }
    return false;
  };
  
  // Helper function to get AC code from AC name
  const extractNumericACCode = (acCode) => {
    if (!acCode || acCode === 'N/A') return 'N/A';
    const acCodeStr = String(acCode).trim();
    const numericPart = acCodeStr.replace(/^[^0-9]+/, '');
    const finalCode = numericPart.replace(/^0+/, '') || '0';
    return finalCode;
  };
  
  const getACCodeFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituenciesData.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => {
          if (!ac || !ac.acName) return false;
          const acNameLower = String(ac.acName).toLowerCase();
          const searchNameLower = acNameStr.toLowerCase();
          return ac.acName === acName || acNameLower === searchNameLower;
        });
        if (constituency) {
          if (constituency.acCode) {
            return extractNumericACCode(constituency.acCode);
          }
          if (constituency.numericCode) {
            return extractNumericACCode(constituency.numericCode);
          }
        }
      }
    }
    return 'N/A';
  };
  
  // Helper function to get district from AC
  const getDistrictFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituenciesData.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => {
          if (!ac || !ac.acName) return false;
          const acNameLower = String(ac.acName).toLowerCase();
          const searchNameLower = acNameStr.toLowerCase();
          return ac.acName === acName || acNameLower === searchNameLower;
        });
        if (constituency && constituency.district) {
          return constituency.district;
        }
      }
    }
    return 'N/A';
  };
  
  // Helper function to get Lok Sabha from AC
  const getLokSabhaFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituenciesData.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => {
          if (!ac || !ac.acName) return false;
          const acNameLower = String(ac.acName).toLowerCase();
          const searchNameLower = acNameStr.toLowerCase();
          return ac.acName === acName || acNameLower === searchNameLower;
        });
        if (constituency && constituency.lokSabha) {
          return constituency.lokSabha;
        }
      }
    }
    return 'N/A';
  };
  
  // Helper function to extract polling station code and name
  const extractPollingStationCodeAndName = (stationValue) => {
    let stationCode = 'N/A';
    let stationName = 'N/A';
    
    if (!stationValue || stationValue === 'N/A') {
      return { stationCode, stationName };
    }
    
    const stationStr = String(stationValue).trim();
    
    if (stationStr.includes(' - ')) {
      const parts = stationStr.split(' - ');
      if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
        const codeMatch = parts[1].match(/^(\d+)/);
        if (codeMatch) {
          stationCode = codeMatch[1];
        }
        stationName = parts.slice(2).join(' - ');
      } else if (parts.length === 2) {
        const codeMatch = parts[0].match(/^(\d+)/);
        if (codeMatch) {
          stationCode = codeMatch[1];
          stationName = parts[1];
        } else {
          stationName = stationStr;
        }
      } else {
        stationName = stationStr;
      }
    } else {
      const codeMatch = stationStr.match(/^(\d+)/);
      if (codeMatch) {
        stationCode = codeMatch[1];
        stationName = stationStr.substring(codeMatch[0].length).replace(/^[\s.-]+/, '');
      } else {
        stationName = stationStr;
      }
    }
    
    return { stationCode: stationCode === 'N/A' ? '' : stationCode, stationName: stationName === 'N/A' ? '' : stationName };
  };
  
  // Helper function to get question code from template mapping
  const getQuestionCodeFromTemplate = (question, questionNumber) => {
    if (!question) return `q${questionNumber}`;
    
    const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
    const qNum = questionNumber;
    
    if (question.id) {
      const questionId = String(question.id).toLowerCase();
      if (questionId.includes('religion') || questionId === 'resp_religion') return 'resp_religion';
      if (questionId.includes('social_cat') || questionId === 'resp_social_cat') return 'resp_social_cat';
      if (questionId.includes('caste') || questionId === 'resp_caste_jati') return 'resp_caste_jati';
      if (questionId.includes('female_edu') || questionId === 'resp_female_edu') return 'resp_female_edu';
      if (questionId.includes('male_edu') || questionId === 'resp_male_edu') return 'resp_male_edu';
      if (questionId.includes('occupation') || questionId === 'resp_occupation') return 'resp_occupation';
      if (questionId.includes('mobile') || questionId === 'resp_mobile') return 'resp_mobile';
      if (questionId.includes('name') && !questionId.includes('caste')) return 'resp_name';
    }
    
    if (questionText.includes('religion') && questionText.includes('belong to')) return 'resp_religion';
    if (questionText.includes('social category') && questionText.includes('belong to')) return 'resp_social_cat';
    if (questionText.includes('caste') && (questionText.includes('tell me') || questionText.includes('jati'))) return 'resp_caste_jati';
    if (questionText.includes('female') && questionText.includes('education') && 
        (questionText.includes('most educated') || questionText.includes('highest educational'))) return 'resp_female_edu';
    if (questionText.includes('male') && questionText.includes('education') && 
        (questionText.includes('most educated') || questionText.includes('highest educational'))) return 'resp_male_edu';
    if (questionText.includes('occupation') && questionText.includes('chief wage earner')) return 'resp_occupation';
    if ((questionText.includes('mobile number') || questionText.includes('phone number')) && 
        questionText.includes('share')) return 'resp_mobile';
    if (questionText.includes('share your name') && questionText.includes('confidential')) return 'resp_name';
    if (questionText.includes('contact you in future') || 
        (questionText.includes('future') && questionText.includes('similar surveys'))) return 'thanks_future';
    
    return `q${qNum}`;
  };
  
  // Helper function to check if a value matches an option
  const optionMatches = (option, value) => {
    if (!option || value === null || value === undefined) return false;
    const optValue = typeof option === 'object' ? (option.value || option.text) : option;
    
    if (optValue === value || String(optValue) === String(value)) {
      return true;
    }
    
    const optMainText = getMainText(String(optValue));
    const valueMainText = getMainText(String(value));
    
    if (optMainText && valueMainText && optMainText === valueMainText) {
      return true;
    }
    
    if (typeof option === 'object' && option.code !== null && option.code !== undefined) {
      const optCode = String(option.code);
      const valueStr = String(value);
      if (optCode === valueStr || optCode === valueMainText) {
        return true;
      }
    }
    
    return false;
  };
  
  // Helper function to get status code
  const getStatusCode = (status) => {
    if (!status) return '';
    const statusUpper = String(status).toUpperCase();
    if (statusUpper === 'APPROVED' || statusUpper === 'VALID') return '10';
    if (statusUpper === 'REJECTED') return '20';
    if (statusUpper === 'PENDING_APPROVAL' || statusUpper === 'UNDER_QC' || statusUpper === 'UNDER QC') return '40';
    if (statusUpper === 'ABANDONED' || statusUpper === 'TERMINATED') return '0';
    return '';
  };
  
  // Helper function to get rejection reason code
  const getRejectionReasonCode = (response) => {
    if (!response || response.status !== 'Rejected' && response.status !== 'rejected') {
      return '';
    }
    
    const verificationData = response.verificationData || {};
    const autoRejectionReasons = verificationData.autoRejectionReasons || [];
    const criteria = verificationData.criteria || verificationData.verificationCriteria || {};
    const feedback = verificationData.feedback || '';
    const feedbackLower = feedback.toLowerCase();
    
    if (autoRejectionReasons.length > 0) {
      if (autoRejectionReasons.includes('duration')) return '1';
      if (autoRejectionReasons.includes('gps_distance')) return '2';
      if (autoRejectionReasons.includes('duplicate_phone')) return '3';
    }
    
    if (criteria.audioStatus !== null && criteria.audioStatus !== undefined && criteria.audioStatus !== '') {
      const audioStatus = String(criteria.audioStatus);
      if (!['1', '4', '7'].includes(audioStatus)) return '4';
    }
    
    if (criteria.genderMatching !== null && criteria.genderMatching !== undefined && criteria.genderMatching !== '') {
      const genderMatching = String(criteria.genderMatching);
      if (genderMatching !== '1') return '5';
    }
    
    if (criteria.previousElectionsMatching !== null && 
        criteria.previousElectionsMatching !== undefined && 
        criteria.previousElectionsMatching !== '') {
      const prevElections = String(criteria.previousElectionsMatching);
      if (prevElections.includes('2021')) return '6';
      if (prevElections.includes('2024')) return '7';
    }
    
    if (criteria.preferenceMatching !== null && 
        criteria.preferenceMatching !== undefined && 
        criteria.preferenceMatching !== '') {
      const prefMatching = String(criteria.preferenceMatching);
      if (prefMatching !== '1') return '8';
    }
    
    if (feedbackLower.includes('interviewer performance') || feedbackLower.includes('interviewer quality')) {
      return '9';
    }
    
    return '';
  };
  
  // Helper function to extract AC and polling station from responses
  const getACAndPollingStationFromResponses = (responses) => {
    if (!responses || !Array.isArray(responses)) {
      return { ac: null, pollingStation: null, groupName: null };
    }
    
    let ac = null;
    let pollingStation = null;
    let groupName = null;
    
    responses.forEach((responseItem) => {
      if (responseItem.questionId === 'ac-selection') {
        ac = responseItem.response || null;
      }
      
      if (responseItem.questionText?.toLowerCase().includes('select polling station') ||
          responseItem.questionType === 'polling_station') {
        const stationResponse = responseItem.response;
        if (stationResponse) {
          if (typeof stationResponse === 'string' && stationResponse.includes(' - ')) {
            const parts = stationResponse.split(' - ');
            if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
              groupName = parts[0] || null;
              pollingStation = parts.slice(1).join(' - ');
            } else if (parts.length === 2 && parts[0].toLowerCase().startsWith('group')) {
              groupName = parts[0] || null;
              pollingStation = parts[1] || stationResponse;
            } else {
              pollingStation = stationResponse;
            }
          } else {
            pollingStation = stationResponse;
          }
        }
      }
      
      if (responseItem.questionId === 'polling-station-group' ||
          responseItem.questionText?.toLowerCase().includes('select group')) {
        groupName = responseItem.response || null;
      }
    });
    
    return { ac, pollingStation, groupName };
  };
  
  // Get all survey questions
  const allSurveyQuestions = getAllSurveyQuestions(survey);
  
  if (allSurveyQuestions.length === 0) {
    throw new Error('No survey questions found');
  }
  
  // Filter out AC selection and polling station questions
  let regularQuestions = allSurveyQuestions
    .filter(q => !isACOrPollingStationQuestion(q))
    .sort((a, b) => {
      const orderA = a.order !== null && a.order !== undefined ? parseInt(a.order) : 9999;
      const orderB = b.order !== null && b.order !== undefined ? parseInt(b.order) : 9999;
      if (!isNaN(orderA) && !isNaN(orderB)) {
        return orderA - orderB;
      }
      return 0;
    });
  
  // For survey 68fd1915d41841da463f0d46, filter out "Professional Degree" option from Q13
  if (surveyIdStr === '68fd1915d41841da463f0d46') {
    regularQuestions = regularQuestions.map(question => {
      const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
      if (questionText.includes('three most pressing issues') && questionText.includes('west bengal')) {
        if (question.options && Array.isArray(question.options)) {
          const filteredOptions = question.options.filter(opt => {
            const optText = typeof opt === 'object' ? getMainText(opt.text || opt.label || opt.value || '') : getMainText(String(opt));
            const optTextLower = String(optText).toLowerCase();
            return !optTextLower.includes('professional degree');
          });
          return {
            ...question,
            options: filteredOptions
          };
        }
      }
      return question;
    });
  }
  
  if (regularQuestions.length === 0) {
    throw new Error('No regular survey questions found');
  }
  
  // Build headers with two rows: titles and codes
  const metadataTitleRow = [];
  const metadataCodeRow = [];
  
  // Metadata columns
  metadataTitleRow.push('Serial Number');
  metadataCodeRow.push('serial_no');
  metadataTitleRow.push('Response ID');
  metadataCodeRow.push('Response ID');
  metadataTitleRow.push('Interview Mode');
  metadataCodeRow.push('MODE');
  metadataTitleRow.push('Interviewer Name');
  metadataCodeRow.push('int_name');
  metadataTitleRow.push('Interviewer ID');
  metadataCodeRow.push('int_id');
  metadataTitleRow.push('Interviewer Email');
  metadataCodeRow.push('Email_Id');
  metadataTitleRow.push('Supervisor Name');
  metadataCodeRow.push('sup_name');
  metadataTitleRow.push('Supervisor ID');
  metadataCodeRow.push('sup_id');
  metadataTitleRow.push('Response Date');
  metadataCodeRow.push('survey_date');
  metadataTitleRow.push('Response Date Time');
  metadataCodeRow.push('survey_datetime');
  metadataTitleRow.push('Status');
  metadataCodeRow.push('Status');
  metadataTitleRow.push('Assembly Constituency code');
  metadataCodeRow.push('ac_code');
  metadataTitleRow.push('Assembly Constituency (AC)');
  metadataCodeRow.push('ac_name');
  metadataTitleRow.push('Parliamentary Constituency Code');
  metadataCodeRow.push('pc_code');
  metadataTitleRow.push('Parliamentary Constituency (PC)');
  metadataCodeRow.push('pc_name');
  metadataTitleRow.push('District Code');
  metadataCodeRow.push('district_code');
  metadataTitleRow.push('District');
  metadataCodeRow.push('district_code');
  metadataTitleRow.push('Region Code');
  metadataCodeRow.push('region_code');
  metadataTitleRow.push('Region Name');
  metadataCodeRow.push('region_name');
  metadataTitleRow.push('Polling Station Code');
  metadataCodeRow.push('rt_polling_station_no');
  metadataTitleRow.push('Polling Station Name');
  metadataCodeRow.push('rt_polling_station_name');
  metadataTitleRow.push('GPS Coordinates');
  metadataCodeRow.push('rt_gps_coordinates');
  metadataTitleRow.push('Call ID');
  metadataCodeRow.push('Call_ID');
  
  // Build question headers with multi-select handling
  const questionTitleRow = [];
  const questionCodeRow = [];
  const questionMultiSelectMap = new Map();
  const questionOthersMap = new Map();
  
  regularQuestions.forEach((question, index) => {
    const questionText = question.text || question.questionText || `Question ${index + 1}`;
    const mainQuestionText = getMainText(questionText);
    const questionNumber = index + 1;
    const questionCode = getQuestionCodeFromTemplate(question, questionNumber);
    
    questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText}`);
    questionCodeRow.push(questionCode);
    
    const isMultiSelect = (question.type === 'multiple_choice' || question.type === 'multi_select') 
      && question.settings?.allowMultiple === true 
      && question.options 
      && question.options.length > 0;
    
    const hasOthersOption = question.options && question.options.some(opt => {
      const optText = typeof opt === 'object' ? (opt.text || opt.label || opt.value) : opt;
      const optTextStr = String(optText || '').toLowerCase().trim();
      return isOthersOption(optTextStr) || 
             (optTextStr.includes('other') && (optTextStr.includes('specify') || optTextStr.includes('please')));
    });
    
    const hasIndependentOption = question.options && question.options.some(opt => {
      const optText = typeof opt === 'object' ? opt.text : opt;
      const optLower = String(optText).toLowerCase();
      return optLower.includes('independent') && !optLower.includes('other');
    });
    
    questionOthersMap.set(index, hasOthersOption);
    
    if (isMultiSelect) {
      const regularOptions = [];
      let othersOption = null;
      let othersOptionIndex = -1;
      
      question.options.forEach((option, optIndex) => {
        const optText = typeof option === 'object' ? option.text : option;
        const optTextStr = String(optText || '').trim();
        if (isOthersOption(optTextStr) || optTextStr.toLowerCase().includes('other') && (optTextStr.toLowerCase().includes('specify') || optTextStr.toLowerCase().includes('please'))) {
          othersOption = option;
          othersOptionIndex = optIndex;
        } else {
          regularOptions.push(option);
        }
      });
      
      questionMultiSelectMap.set(index, {
        isMultiSelect: true,
        options: regularOptions,
        othersOption: othersOption,
        othersOptionIndex: othersOptionIndex,
        questionText: mainQuestionText,
        questionNumber,
        questionCode
      });
      
      let regularOptionIndex = 0;
      regularOptions.forEach((option) => {
        const optText = typeof option === 'object' ? option.text : option;
        const optMainText = getMainText(optText);
        const optionNum = regularOptionIndex + 1;
        const optCode = `Q${questionNumber}_${optionNum}`;
        regularOptionIndex++;
        
        questionTitleRow.push(`Q${questionNumber}. ${mainQuestionText} - ${optMainText}`);
        questionCodeRow.push(optCode);
      });
      
      if (hasOthersOption) {
        questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others Choice`);
        // Changed from _oth_choice to _44 format
        questionCodeRow.push(`${questionCode}_44`);
        
        questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
        // Keep _oth format for the text column
        questionCodeRow.push(`${questionCode}_oth`);
      }
    } else {
      if (hasOthersOption) {
        questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
        // Changed from _oth to _44 format
        questionCodeRow.push(`${questionCode}_44`);
      }
      
      if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
        questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Independent (Please specify)`);
        questionCodeRow.push(`${questionCode}_ind`);
      }
    }
  });
  
  // Combine metadata and question headers
  const allTitleRow = [...metadataTitleRow, ...questionTitleRow];
  let allCodeRow = [...metadataCodeRow, ...questionCodeRow]; // Use let because it gets reassigned for survey-specific transformations
  
  // Add Status, QC, and Rejection columns at the end
  allTitleRow.push('Status (0= terminated, 10=valid, 20=rejected, 40=under qc)');
  allCodeRow.push('status_code');
  allTitleRow.push('Qc Completion date');
  allCodeRow.push('qc_completion_date');
  allTitleRow.push('Assigned to QC ( 1 can mean those whih are assigned to audio qc and 2 can mean those which are not yet assigned)');
  allCodeRow.push('assigned_to_qc');
  allTitleRow.push('Reason for rejection (1= short duration, 2= gps rejection, 3= duplicate phone numbers, 4= audio status, 5= gender mismatch, 6=2021 AE, 7=2024 GE, 8= Pref, 9=Interviewer performance)');
  allCodeRow.push('rejection_reason');
  
  // Apply transformations for survey 68fd1915d41841da463f0d46
  if (surveyIdStr === '68fd1915d41841da463f0d46') {
    // 1. Convert all uppercase Q to lowercase q in column codes
    allCodeRow = allCodeRow.map(code => {
      if (typeof code === 'string') {
        // Replace uppercase Q with lowercase q (e.g., Q10 → q10, Q10_5 → q10_5)
        return code.replace(/Q(\d+)/g, 'q$1');
      }
      return code;
    });
    
    // 2. Apply specific column name replacements for this survey
    const columnReplacements = {
      'q1': 'resp_age',
      'q2': 'resp_registered_voter',
      'q3': 'resp_gender',
      'q10_5': 'q10_99',
      'q11_10': 'q11_11',
      'q11_11': 'q11_13',
      'q11_12': 'q11_14',
      'q11_13': 'q11_15',
      'q11_14': 'q11_99',
      'q12_4': 'q12_5',
      'q12_5': 'q12_6',
      'q12_6': 'q12_7',
      'q12_7': 'q12_8',
      'q12_8': 'q12_9',
      'q12_9': 'q12_11',
      'q12_10': 'q12_12',
      'q12_11': 'q12_14',
      'q12_12': 'q12_99'
    };
    
    allCodeRow = allCodeRow.map(code => {
      if (typeof code === 'string' && code in columnReplacements) {
        return columnReplacements[code];
      }
      return code;
    });
    
    // 3. Change _oth_choice format to _44 (e.g., q4_oth_choice → q4_44)
    // This should already be handled above, but ensure any remaining _oth patterns are converted
    allCodeRow = allCodeRow.map(code => {
      if (typeof code === 'string' && code.includes('_oth_choice')) {
        return code.replace(/_oth_choice$/, '_44');
      }
      // Also handle any _oth patterns that might exist
      if (typeof code === 'string' && code.match(/_[a-z]*_oth$/)) {
        return code.replace(/_oth$/, '_44');
      }
      return code;
    });
  } else {
    // For other surveys, still ensure lowercase q (but don't apply replacements)
    allCodeRow = allCodeRow.map(code => {
      if (typeof code === 'string') {
        return code.replace(/Q(\d+)/g, 'q$1');
      }
      return code;
    });
    
    // Change _oth_choice to _44 format for all surveys
    allCodeRow = allCodeRow.map(code => {
      if (typeof code === 'string' && code.includes('_oth_choice')) {
        return code.replace(/_oth_choice$/, '_44');
      }
      // Also handle _oth pattern for Others columns
      if (typeof code === 'string' && code.match(/^[a-z]+\d+_oth$/)) {
        return code.replace(/_oth$/, '_44');
      }
      return code;
    });
  }
  
  // Pre-fetch supervisor names by memberId
  const uniqueSupervisorIDs = new Set();
  sortedResponses.forEach(response => {
    if (response.responses && Array.isArray(response.responses)) {
      const supervisorIdResponse = response.responses.find(r => r.questionId === 'supervisor-id');
      if (supervisorIdResponse && supervisorIdResponse.response !== null && supervisorIdResponse.response !== undefined && supervisorIdResponse.response !== '') {
        const supervisorID = String(supervisorIdResponse.response).trim();
        if (supervisorID && supervisorID !== '') {
          uniqueSupervisorIDs.add(supervisorID);
        }
      }
    }
  });
  
  // Fetch supervisor names
  const supervisorDataMap = new Map();
  if (uniqueSupervisorIDs.size > 0) {
    try {
      const supervisorPromises = Array.from(uniqueSupervisorIDs).map(async (supervisorID) => {
        try {
          const supervisor = await User.findOne({
            $or: [
              { memberId: supervisorID },
              { memberID: supervisorID }
            ]
          }).lean();
          
          if (supervisor && (supervisor.firstName || supervisor.lastName)) {
            const supervisorName = `${supervisor.firstName || ''} ${supervisor.lastName || ''}`.trim();
            return { memberId: supervisorID, name: supervisorName };
          }
        } catch (error) {
          console.warn(`Could not fetch supervisor ${supervisorID}:`, error.message);
        }
        return { memberId: supervisorID, name: '' };
      });
      
      const supervisorResults = await Promise.all(supervisorPromises);
      supervisorResults.forEach(supervisor => {
        if (supervisor.memberId) {
          supervisorDataMap.set(supervisor.memberId, supervisor.name);
        }
      });
    } catch (error) {
      console.error('Error fetching supervisor data:', error);
    }
  }
  
  // Create CSV data rows
  const csvData = sortedResponses.map((response, rowIndex) => {
    const { ac: acFromResponse, pollingStation: pollingStationFromResponse } = getACAndPollingStationFromResponses(response.responses);
    
    const cleanValue = (value) => {
      if (value === 'N/A' || value === null || value === undefined) return '';
      return value;
    };
    
    const displayACRaw = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || '';
    const displayAC = displayACRaw || '';
    
    let displayPC = response.selectedPollingStation?.pcName || '';
    if (!displayPC && displayAC) {
      const pcFromAC = getLokSabhaFromAC(displayAC);
      displayPC = cleanValue(pcFromAC) || '';
    }
    
    let displayDistrict = response.selectedPollingStation?.district || '';
    if (!displayDistrict && displayAC) {
      const districtFromAC = getDistrictFromAC(displayAC);
      displayDistrict = cleanValue(districtFromAC) || '';
    }
    
    const acCodeRaw = getACCodeFromAC(displayAC);
    const acCode = cleanValue(acCodeRaw) || '';
    
    const pollingStationValue = pollingStationFromResponse || response.selectedPollingStation?.stationName;
    
    let pcCode = '';
    let districtCode = '';
    let regionCode = '';
    let regionName = '';
    
    // Use JSON mapping for region_code, region_name, and district_code based on AC code
    if (acCode && acCode !== '') {
      const acMapping = acRegionDistrictMapping[acCode];
      if (acMapping) {
        districtCode = cleanValue(acMapping.district_code) || '';
        regionCode = cleanValue(acMapping.region_code) || '';
        regionName = cleanValue(acMapping.region_name) || '';
      }
      
      // Try to get pcCode from polling station data if available
      // For now, leave empty as we don't have polling station API in backend
      pcCode = '';
    }
    
    const { stationCode: stationCodeRaw, stationName: stationNameRaw } = extractPollingStationCodeAndName(pollingStationValue);
    const stationCode = cleanValue(stationCodeRaw) || '';
    const stationName = cleanValue(stationNameRaw) || '';
    
    // Format date in IST
    const responseDateUTC = new Date(response.createdAt || response.endTime || response.createdAt);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const responseDateIST = new Date(responseDateUTC.getTime() + istOffset);
    
    const istYear = responseDateIST.getUTCFullYear();
    const istMonth = String(responseDateIST.getUTCMonth() + 1).padStart(2, '0');
    const istDay = String(responseDateIST.getUTCDate()).padStart(2, '0');
    const formattedDateOnly = `${istYear}-${istMonth}-${istDay}`;
    
    const istHours = String(responseDateIST.getUTCHours()).padStart(2, '0');
    const istMinutes = String(responseDateIST.getUTCMinutes()).padStart(2, '0');
    const istSeconds = String(responseDateIST.getUTCSeconds()).padStart(2, '0');
    const formattedDateTime = `${formattedDateOnly} ${istHours}:${istMinutes}:${istSeconds}`;
    
    // Extract supervisor ID from responses array
    let supervisorID = '';
    if (response.responses && Array.isArray(response.responses)) {
      const supervisorIdResponse = response.responses.find(r => r.questionId === 'supervisor-id');
      if (supervisorIdResponse && supervisorIdResponse.response !== null && supervisorIdResponse.response !== undefined && supervisorIdResponse.response !== '') {
        supervisorID = String(supervisorIdResponse.response).trim();
      }
    }
    
    // Get supervisor name from pre-fetched data
    const supervisorName = supervisorID && supervisorDataMap.has(supervisorID) 
      ? supervisorDataMap.get(supervisorID) 
      : '';
    
    // Get interviewer data
    const interviewerDetails = response.interviewer || {};
    const interviewerName = interviewerDetails.firstName || interviewerDetails.lastName
      ? `${interviewerDetails.firstName || ''} ${interviewerDetails.lastName || ''}`.trim()
      : '';
    const interviewerID = interviewerDetails.memberId || interviewerDetails.memberID || '';
    const interviewerEmail = interviewerDetails.email || '';
    
    // Build metadata row
    const metadata = [
      rowIndex + 1,
      cleanValue(response.responseId || response._id?.toString().slice(-8)),
      cleanValue(response.interviewMode?.toUpperCase()),
      cleanValue(interviewerName || null),
      cleanValue(interviewerID),
      cleanValue(interviewerEmail),
      cleanValue(supervisorName),
      cleanValue(supervisorID),
      formattedDateOnly,
      formattedDateTime,
      cleanValue(response.status),
      cleanValue(acCode),
      cleanValue(displayAC),
      cleanValue(pcCode),
      cleanValue(displayPC),
      cleanValue(districtCode),
      cleanValue(displayDistrict),
      cleanValue(regionCode),
      cleanValue(regionName),
      cleanValue(stationCode),
      cleanValue(stationName),
      response.interviewMode?.toUpperCase() === 'CATI' ? '' : (response.location ? `(${response.location.latitude?.toFixed(4)}, ${response.location.longitude?.toFixed(4)})` : ''),
      response.call_id || ''
    ];
    
    // Extract answers for each question
    const answers = [];
    
    regularQuestions.forEach((surveyQuestion, questionIndex) => {
      let matchingAnswer = null;
      
      if (surveyQuestion.id) {
        matchingAnswer = response.responses?.find(r => 
          r.questionId === surveyQuestion.id
        );
      }
      
      if (!matchingAnswer && surveyQuestion.text) {
        matchingAnswer = response.responses?.find(r => {
          const rText = getMainText(r.questionText || '');
          const sText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
          return rText === sText || r.questionText === surveyQuestion.text || r.questionText === surveyQuestion.questionText;
        });
      }
      
      const multiSelectInfo = questionMultiSelectMap.get(questionIndex);
      const hasOthersOption = questionOthersMap.get(questionIndex);
      const questionCode = multiSelectInfo?.questionCode || getQuestionCodeFromTemplate(surveyQuestion, questionIndex + 1);
      
      // Check if this is Q13 (three most pressing issues) for filtering Professional Degree
      const questionText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '').toLowerCase();
      const isQ13 = surveyIdStr === '68fd1915d41841da463f0d46' && 
                    questionText.includes('three most pressing issues') && 
                    questionText.includes('west bengal');
      
      if (multiSelectInfo && multiSelectInfo.isMultiSelect) {
        // Multi-select question handling
        let selectedValues = [];
        let othersText = '';
        
        if (matchingAnswer && !matchingAnswer.isSkipped && matchingAnswer.response) {
          const responseValue = matchingAnswer.response;
          
          if (Array.isArray(responseValue)) {
            selectedValues = responseValue;
          } else if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
            const responseStr = String(responseValue);
            // If it's a comma-separated string, split it into individual values
            // Handle formats like "value1_{trans1}, value2_{trans2}"
            if (responseStr.includes(',')) {
              // Split by comma, but be careful with commas inside braces
              // Simple approach: split by comma and trim each part
              selectedValues = responseStr.split(',').map(v => v.trim()).filter(v => v !== '');
            } else {
              selectedValues = [responseValue];
            }
          }
        }
        
        // For Q13, filter out "Professional Degree"
        if (isQ13) {
          selectedValues = selectedValues.filter(val => {
            const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
            const valLower = valStr.toLowerCase().replace(/[_\s-]/g, ' ').trim();
            return !(valLower.includes('professional') && valLower.includes('degree'));
          });
        }
        
        let isOthersSelected = false;
        selectedValues.forEach(val => {
          const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
          const isOthers = surveyQuestion.options.some(opt => {
            const optText = typeof opt === 'object' ? opt.text : opt;
            return isOthersOption(optText) && optionMatches(opt, val);
          }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
          
          if (isOthers) {
            isOthersSelected = true;
            if (valStr.startsWith('Others: ')) {
              othersText = valStr.substring(8).trim();
            } else {
              const othersTextValue = extractOthersText(val);
              if (othersTextValue) {
                othersText = othersTextValue;
              }
            }
          }
        });
        
        let mainResponse = '';
        if (selectedValues.length > 0) {
          if (downloadMode === 'codes') {
            mainResponse = selectedValues.map(val => {
              const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
              const isOthers = surveyQuestion.options.some(opt => {
                const optText = typeof opt === 'object' ? opt.text : opt;
                return isOthersOption(optText) && optionMatches(opt, val);
              }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
              
              if (isOthers) {
                return '44';
              }
              
              // For Q13, skip "Professional_degree" values
              if (isQ13) {
                const valStrForCheck = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                const valLowerForCheck = valStrForCheck.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                if (valLowerForCheck.includes('professional') && valLowerForCheck.includes('degree')) {
                  return null;
                }
              }
              
              let option = surveyQuestion.options.find(opt => optionMatches(opt, val));
              
              if (!option) {
                const valMainText = getMainText(String(val));
                option = surveyQuestion.options.find(opt => {
                  const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                  const optMainText = getMainText(String(optValue));
                  return optMainText === valMainText && valMainText !== '';
                });
              }
              
              if (option) {
                if (option.code !== null && option.code !== undefined && option.code !== '') {
                  return String(option.code);
                } else if (option.value) {
                  const mainValue = getMainText(String(option.value));
                  if (!/^\d+$/.test(mainValue)) {
                    const matchingOpt = surveyQuestion.options.find(opt => {
                      const optMainText = getMainText(String(opt.value || opt.text || ''));
                      return optMainText === mainValue;
                    });
                    if (matchingOpt && matchingOpt.code) {
                      return String(matchingOpt.code);
                    } else {
                      // Special handling for thanks_future: "yes,_you_can" should be "1"
                      if (questionCode === 'thanks_future') {
                        const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                        if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                          return '1';
                        }
                      }
                      return mainValue;
                    }
                  } else {
                    return mainValue;
                  }
                } else {
                  const mainValue = getMainText(String(val));
                  // Special handling for thanks_future
                  if (questionCode === 'thanks_future') {
                    const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                    if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                      return '1';
                    }
                  }
                  // For Q13, skip "Professional_degree" values
                  if (isQ13) {
                    const valLower = mainValue.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                    if (valLower.includes('professional') && valLower.includes('degree')) {
                      return null;
                    }
                  }
                  return mainValue || String(val);
                }
              }
              
              // Option not found - try to extract main text and match again
              const mainValue = getMainText(String(val));
              
              // Try one more time to find matching option by main text
              const matchingOptByMainText = surveyQuestion.options.find(opt => {
                const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                const optMainText = getMainText(String(optValue));
                return optMainText === mainValue && mainValue !== '';
              });
              
              if (matchingOptByMainText) {
                if (matchingOptByMainText.code !== null && matchingOptByMainText.code !== undefined && matchingOptByMainText.code !== '') {
                  return String(matchingOptByMainText.code);
                }
              }
              
              // Special handling for thanks_future
              if (questionCode === 'thanks_future') {
                const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                  return '1';
                }
              }
              // For Q13, skip "Professional_degree" values
              if (isQ13) {
                const valLower = mainValue.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                if (valLower.includes('professional') && valLower.includes('degree')) {
                  return null;
                }
              }
              return mainValue || String(val);
            }).filter(code => code !== null).join(', ');
          } else {
            const filteredValues = selectedValues.filter(val => {
              const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
              const isOthers = surveyQuestion.options.some(opt => {
                const optText = typeof opt === 'object' ? opt.text : opt;
                return isOthersOption(optText) && optionMatches(opt, val);
              }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
              return !isOthers;
            });
            if (isOthersSelected) {
              mainResponse = filteredValues.length > 0 
                ? formatResponseDisplay(filteredValues, surveyQuestion) + ', Others'
                : 'Others';
            } else {
              mainResponse = formatResponseDisplay(selectedValues, surveyQuestion);
            }
          }
        } else if (matchingAnswer && matchingAnswer.isSkipped) {
          mainResponse = '';
        } else {
          mainResponse = '';
        }
        
        // Add main response column first
        answers.push(mainResponse);
        
        // Add Yes/No columns for each REGULAR option
        const questionCodeForMatching = multiSelectInfo.questionCode || questionCode;
        multiSelectInfo.options.forEach((option, optIndex) => {
          const optText = typeof option === 'object' ? option.text : option;
          if (isOthersOption(optText)) {
            return;
          }
          const optValue = typeof option === 'object' ? (option.value || option.text) : option;
          const isSelected = selectedValues.some(val => {
            const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
            if (valStr.startsWith('Others: ') || isOthersOption(valStr)) {
              return false;
            }
            if (optionMatches(option, val)) {
              return true;
            }
            const valMainText = getMainText(String(valStr));
            const optMainText = getMainText(String(optValue));
            if (valMainText && optMainText && valMainText === optMainText) {
              return true;
            }
            // Special handling for thanks_future
            if (questionCodeForMatching === 'thanks_future') {
              const valLower = valMainText.toLowerCase().replace(/[,_]/g, ' ').trim();
              const optLower = optMainText.toLowerCase().replace(/[,_]/g, ' ').trim();
              if (valLower.includes('yes') && optLower.includes('yes') && 
                  (valLower.includes('you') || valLower.includes('can'))) {
                return true;
              }
            }
            return false;
          });
          
          if (downloadMode === 'codes') {
            answers.push(isSelected ? '1' : '0');
          } else {
            answers.push(isSelected ? 'Yes' : 'No');
          }
        });
        
        if (hasOthersOption) {
          // Add _oth_choice column: 1 if mainResponse contains "44", 0 otherwise
          const mainResponseStr = String(mainResponse || '').trim();
          let containsOthersCode = false;
          if (mainResponseStr === '44') {
            containsOthersCode = true;
          } else if (mainResponseStr.includes(',')) {
            const codes = mainResponseStr.split(',').map(c => c.trim());
            containsOthersCode = codes.includes('44');
          } else {
            containsOthersCode = /\b44\b/.test(mainResponseStr);
          }
          const othChoiceValue = containsOthersCode ? '1' : '0';
          answers.push(othChoiceValue);
          
          // Add _oth column (Others text)
          answers.push(othersText || '');
        }
      } else {
        // Single choice or other question types
        let questionResponse = '';
        let othersText = '';
        
        if (matchingAnswer) {
          if (matchingAnswer.isSkipped) {
            questionResponse = '';
          } else {
            const responseValue = matchingAnswer.response;
            const hasResponseContent = (val) => {
              if (!val && val !== 0) return false;
              if (Array.isArray(val)) return val.length > 0;
              if (typeof val === 'object') return Object.keys(val).length > 0;
              return val !== '' && val !== null && val !== undefined;
            };
            
            if (!hasResponseContent(responseValue)) {
              questionResponse = '';
            } else {
              const responseStr = String(responseValue);
              const isOthersResponse = responseStr.startsWith('Others: ') || 
                (hasOthersOption && surveyQuestion.options && surveyQuestion.options.some(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return isOthersOption(optText) && optionMatches(opt, responseValue);
                }));
              
              if (isOthersResponse) {
                if (responseStr.startsWith('Others: ')) {
                  othersText = responseStr.substring(8).trim();
                } else {
                  const othersTextValue = extractOthersText(responseValue);
                  if (othersTextValue) {
                    othersText = othersTextValue;
                  }
                }
                
                if (downloadMode === 'codes') {
                  questionResponse = '44';
                } else {
                  questionResponse = 'Others';
                }
              } else {
                if (downloadMode === 'codes' && surveyQuestion.options) {
                  let option = surveyQuestion.options.find(opt => optionMatches(opt, responseValue));
                  
                  if (!option) {
                    const responseMainText = getMainText(String(responseValue));
                    option = surveyQuestion.options.find(opt => {
                      const optValue = typeof option === 'object' ? (opt.value || opt.text) : opt;
                      const optMainText = getMainText(String(optValue));
                      return optMainText === responseMainText && responseMainText !== '';
                    });
                  }
                  
                  if (option) {
                    if (option.code !== null && option.code !== undefined && option.code !== '') {
                      questionResponse = String(option.code);
                    } else if (option.value) {
                      const mainValue = getMainText(String(option.value));
                      if (!/^\d+$/.test(mainValue)) {
                        const matchingOpt = surveyQuestion.options.find(opt => {
                          const optMainText = getMainText(String(opt.value || opt.text || ''));
                          return optMainText === mainValue;
                        });
                        if (matchingOpt && matchingOpt.code) {
                          questionResponse = String(matchingOpt.code);
                        } else {
                          // Special handling for thanks_future
                          if (questionCode === 'thanks_future') {
                            const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                            if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                              questionResponse = '1';
                            } else {
                              questionResponse = mainValue;
                            }
                          } else {
                            questionResponse = mainValue;
                          }
                        }
                      } else {
                        questionResponse = mainValue;
                      }
                    } else {
                      const mainValue = getMainText(String(responseValue));
                      // Special handling for thanks_future
                      if (questionCode === 'thanks_future') {
                        const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                        if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                          questionResponse = '1';
                        } else {
                          questionResponse = mainValue || String(responseValue);
                        }
                      } else {
                        questionResponse = mainValue || String(responseValue);
                      }
                    }
                  } else {
                    // Option not found - try to extract main text and match again
                    const mainValue = getMainText(String(responseValue));
                    
                    // Try one more time to find matching option by main text
                    const matchingOptByMainText = surveyQuestion.options.find(opt => {
                      const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                      const optMainText = getMainText(String(optValue));
                      return optMainText === mainValue && mainValue !== '';
                    });
                    
                    if (matchingOptByMainText) {
                      if (matchingOptByMainText.code !== null && matchingOptByMainText.code !== undefined && matchingOptByMainText.code !== '') {
                        questionResponse = String(matchingOptByMainText.code);
                      } else {
                        questionResponse = mainValue || String(responseValue);
                      }
                    } else if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
                      const responseStr = String(responseValue);
                      if (/^\d+$/.test(responseStr.trim())) {
                        questionResponse = responseStr.trim();
                      } else {
                        questionResponse = mainValue || responseStr;
                      }
                    } else {
                      questionResponse = mainValue || String(responseValue);
                    }
                  }
                } else {
                  if (surveyQuestion.options) {
                    questionResponse = formatResponseDisplay(responseValue, surveyQuestion);
                  } else {
                    questionResponse = String(responseValue);
                  }
                }
              }
            }
          }
        }
        
        const mainQuestionResponse = questionResponse !== null && questionResponse !== undefined ? String(questionResponse) : '';
        answers.push(mainQuestionResponse);
        
        if (hasOthersOption) {
          let othersTextValue = '';
          if (othersText && othersText.trim() !== '') {
            if (!othersText.match(/^\d+$/)) {
              if (othersText !== mainQuestionResponse) {
                othersTextValue = othersText;
              }
            }
          }
          answers.push(othersTextValue);
        }
        
        const hasIndependentOption = surveyQuestion.options && surveyQuestion.options.some(opt => {
          const optText = typeof opt === 'object' ? opt.text : opt;
          const optLower = String(optText).toLowerCase();
          return optLower.includes('independent') && !optLower.includes('other');
        });
        
        if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
          let independentText = '';
          if (matchingAnswer && matchingAnswer.response) {
            const responseValue = matchingAnswer.response;
            const responseStr = String(responseValue).toLowerCase();
            const isIndependentResponse = responseStr.includes('independent') || 
                surveyQuestion.options.some(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return String(optText).toLowerCase().includes('independent') && optionMatches(opt, responseValue);
                });
            
            if (isIndependentResponse) {
              if (String(responseValue).startsWith('Others: ') || String(responseValue).startsWith('Independent: ')) {
                const independentTextValue = extractOthersText(responseValue);
                independentText = independentTextValue || '';
              }
            }
          }
          answers.push(independentText || '');
        }
      }
    });
    
    // Add QC and status columns
    const statusCode = getStatusCode(response.status);
    const qcCompletionDate = response.verificationData?.reviewedAt 
      ? new Date(response.verificationData.reviewedAt).toLocaleDateString('en-US')
      : '';
    
    let assignedToQC = '';
    
    if (response.status === 'Approved' || response.status === 'Rejected') {
      assignedToQC = '';
    } else if (response.status === 'Pending_Approval' || response.status === 'pending_approval') {
      const qcBatch = response.qcBatch;
      const isSampleResponse = response.isSampleResponse || false;
      
      if (qcBatch) {
        let batchStatus = null;
        let remainingDecision = null;
        
        if (typeof qcBatch === 'object' && qcBatch.status) {
          batchStatus = qcBatch.status;
          remainingDecision = qcBatch.remainingDecision?.decision;
        } else if (response.qcBatchStatus) {
          batchStatus = response.qcBatchStatus;
          remainingDecision = response.qcBatchRemainingDecision;
        }
        
        if (batchStatus) {
          if (batchStatus === 'queued_for_qc' ||
              (isSampleResponse && (batchStatus === 'qc_in_progress' || batchStatus === 'completed')) ||
              (!isSampleResponse && remainingDecision === 'queued_for_qc')) {
            assignedToQC = '1';
          } else if (batchStatus === 'collecting' ||
                     (batchStatus === 'processing' && !isSampleResponse)) {
            assignedToQC = '2';
          } else {
            assignedToQC = '2';
          }
        } else {
          assignedToQC = '2';
        }
      } else {
        assignedToQC = '2';
      }
    }
    
    const rejectionReasonCode = getRejectionReasonCode(response);
    
    return [...metadata, ...answers, statusCode, qcCompletionDate, assignedToQC, rejectionReasonCode];
  });
  
  // Build CSV content
  const csvRows = [];
  
  // For survey 68fd1915d41841da463f0d46, only code row is used (no title row)
  // This matches the frontend behavior for this specific survey
  if (surveyIdStr !== '68fd1915d41841da463f0d46') {
    csvRows.push(allTitleRow);
  }
  
  // Add code row (always present)
  csvRows.push(allCodeRow);
  
  // Add data rows
  csvRows.push(...csvData);
  
  const csvContent = csvRows
    .map(row => row.map(field => {
      const fieldStr = String(field || '');
      return `"${fieldStr.replace(/"/g, '""')}"`;
    }).join(','))
    .join('\n');
  
  return csvContent;
};

/**
 * Save CSV file
 */
const saveCSVFile = async (surveyId, downloadMode, csvContent) => {
  const surveyDir = path.join(CSV_STORAGE_DIR, surveyId);
  if (!fs.existsSync(surveyDir)) {
    fs.mkdirSync(surveyDir, { recursive: true });
  }
  
  const filename = downloadMode === 'codes' ? 'responses_codes.csv' : 'responses_responses.csv';
  const filepath = path.join(surveyDir, filename);
  
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
  
  fs.writeFileSync(filepath, csvContent, 'utf8');
  
  // Helper function to format date in IST
  const formatDateIST = (date, dateOnly = false) => {
    if (!date) return '';
    const d = new Date(date);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    
    if (dateOnly) {
      return `${year}-${month}-${day}`;
    }
    
    const hours = String(istDate.getUTCHours()).padStart(2, '0');
    const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };
  
  const metadata = {
    lastUpdated: new Date().toISOString(),
    lastUpdatedIST: formatDateIST(new Date(), false),
    mode: downloadMode,
    surveyId: surveyId
  };
  
  fs.writeFileSync(
    path.join(surveyDir, `${downloadMode}_metadata.json`),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );
  
  console.log(`📝 Metadata saved: ${downloadMode}_metadata.json`);
  console.log(`   Last Updated: ${metadata.lastUpdatedIST}`);
};

/**
 * Save empty CSV file
 */
const saveEmptyCSV = async (surveyId, downloadMode) => {
  const surveyDir = path.join(CSV_STORAGE_DIR, surveyId);
  if (!fs.existsSync(surveyDir)) {
    fs.mkdirSync(surveyDir, { recursive: true });
  }
  
  const filename = downloadMode === 'codes' ? 'responses_codes.csv' : 'responses_responses.csv';
  const filepath = path.join(surveyDir, filename);
  
  const csvContent = 'Serial Number,Response ID\n';
  fs.writeFileSync(filepath, csvContent, 'utf8');
  
  const metadata = {
    lastUpdated: new Date().toISOString(),
    lastUpdatedIST: formatDateIST(new Date(), false),
    mode: downloadMode,
    surveyId: surveyId,
    isEmpty: true
  };
  
  fs.writeFileSync(
    path.join(surveyDir, `${downloadMode}_metadata.json`),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );
};

/**
 * Get CSV file info
 */
const getCSVFileInfo = (surveyId) => {
  const surveyDir = path.join(CSV_STORAGE_DIR, surveyId);
  
  const codesMetadataPath = path.join(surveyDir, 'codes_metadata.json');
  const responsesMetadataPath = path.join(surveyDir, 'responses_metadata.json');
  
  const info = {
    codes: null,
    responses: null
  };
  
  if (fs.existsSync(codesMetadataPath)) {
    info.codes = JSON.parse(fs.readFileSync(codesMetadataPath, 'utf8'));
  }
  
  if (fs.existsSync(responsesMetadataPath)) {
    info.responses = JSON.parse(fs.readFileSync(responsesMetadataPath, 'utf8'));
  }
  
  return info;
};

module.exports = {
  generateCSVForSurvey,
  getCSVFileInfo,
  CSV_STORAGE_DIR
};
