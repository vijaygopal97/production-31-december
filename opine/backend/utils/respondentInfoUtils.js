/**
 * Respondent info extraction utilities for backend
 * Mirrors frontend logic for extracting AC, demographics, etc. from responses
 */

const { getMainText, findGenderResponse, normalizeGenderResponse } = require('./genderUtils');
const { getACDetails, getDistrictFromAC, getPCFromAC } = require('./acDataHelper');

/**
 * Extract AC from response using the same logic as frontend
 * Priority: selectedAC > selectedPollingStation.acName > questionId='ac-selection' > questionType > questionText
 */
const extractACFromResponse = (responses, responseData) => {
  // Helper to validate if a value is a valid AC name (not yes/no/consent answers)
  const isValidACName = (value) => {
    if (!value || typeof value !== 'string') return false;
    const cleaned = getMainText(value).trim();
    if (!cleaned || cleaned === 'N/A' || cleaned === '') return false;
    
    const lower = cleaned.toLowerCase();
    // Reject common non-AC values
    const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
    if (invalidValues.includes(lower)) return false;
    if (lower.startsWith('yes') || lower.startsWith('no')) return false;
    if (lower.match(/^yes[_\s]/i) || lower.match(/^no[_\s]/i)) return false;
    
    // Must be longer than 2 characters
    if (cleaned.length <= 2) return false;
    
    // Should look like a valid name (has capital letters or multiple words)
    const hasCapitalLetters = /[A-Z]/.test(cleaned);
    const hasMultipleWords = cleaned.split(/\s+/).length > 1;
    const looksLikeName = hasCapitalLetters || hasMultipleWords;
    
    return looksLikeName;
  };

  // Priority 1: Check selectedAC field
  if (responseData?.selectedAC && isValidACName(responseData.selectedAC)) {
    return getMainText(String(responseData.selectedAC)).trim();
  }
  
  // Priority 2: Check selectedPollingStation.acName
  if (responseData?.selectedPollingStation?.acName && isValidACName(responseData.selectedPollingStation.acName)) {
    return getMainText(String(responseData.selectedPollingStation.acName)).trim();
  }
  
  // Priority 3: Check responses array for questionId === 'ac-selection'
  if (responses && Array.isArray(responses)) {
    const acSelectionResponse = responses.find(r => 
      r.questionId === 'ac-selection' && r.response
    );
    if (acSelectionResponse && isValidACName(acSelectionResponse.response)) {
      return getMainText(String(acSelectionResponse.response)).trim();
    }
    
    // Priority 4: Check for questionType that indicates AC selection
    const acTypeResponse = responses.find(r => 
      (r.questionType === 'ac_selection' || 
       r.questionType === 'assembly_constituency' ||
       r.questionType === 'ac') && 
      r.response
    );
    if (acTypeResponse && isValidACName(acTypeResponse.response)) {
      return getMainText(String(acTypeResponse.response)).trim();
    }
    
    // Priority 5: Search by question text containing "assembly" or "constituency"
    // BUT exclude questions that are consent/agreement questions
    const acTextResponses = responses.filter(r => {
      if (!r.questionText || !r.response) return false;
      const questionText = getMainText(r.questionText).toLowerCase();
      const hasAssembly = questionText.includes('assembly');
      const hasConstituency = questionText.includes('constituency');
      
      // Exclude consent/agreement questions
      const isConsentQuestion = questionText.includes('consent') || 
                                questionText.includes('agree') ||
                                questionText.includes('participate') ||
                                questionText.includes('willing') ||
                                questionText.includes('do you') ||
                                questionText.includes('would you');
      
      return (hasAssembly || hasConstituency) && !isConsentQuestion;
    });
    
    // Try each potential AC response and validate it
    for (const acResponse of acTextResponses) {
      if (isValidACName(acResponse.response)) {
        return getMainText(String(acResponse.response)).trim();
      }
    }
  }
  
  return null;
};

/**
 * Helper to find question response by keywords
 */
const findQuestionResponse = (responses, keywords) => {
  if (!responses || !Array.isArray(responses)) return null;
  return responses.find(r => {
    const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
    return keywords.some(keyword => questionText.includes(keyword.toLowerCase()));
  });
};

/**
 * Get main text value (handle translations)
 */
const getMainTextValue = (text) => {
  if (!text) return '';
  if (typeof text === 'string') {
    return getMainText(text);
  }
  if (typeof text === 'object' && text !== null) {
    return getMainText(text.text || text.value || text || '');
  }
  return String(text);
};

/**
 * Extract respondent info from responses (mirrors frontend getRespondentInfo)
 */
const getRespondentInfo = (responses, responseData, survey = null) => {
  if (!responses || !Array.isArray(responses)) {
    const acFromData = responseData?.selectedAC || responseData?.selectedPollingStation?.acName || null;
    const districtFromData = responseData?.selectedPollingStation?.district || null;
    const lokSabhaFromData = responseData?.selectedPollingStation?.lokSabha || null;
    return { 
      name: 'N/A', 
      gender: 'N/A', 
      age: 'N/A', 
      city: 'N/A', 
      district: districtFromData || 'N/A', 
      ac: acFromData || 'N/A', 
      lokSabha: lokSabhaFromData || 'N/A', 
      state: 'N/A' 
    };
  }

  // Helper to find response by question text (ignoring translations)
  const findResponseByQuestionText = (responses, searchTexts) => {
    return responses.find(r => {
      if (!r.questionText) return false;
      const mainText = getMainText(r.questionText).toLowerCase();
      return searchTexts.some(text => mainText.includes(text.toLowerCase()));
    });
  };

  // Get survey ID
  const surveyId = responseData?.survey?._id || responseData?.survey?.id || survey?._id || null;
  const surveyIdStr = surveyId ? String(surveyId) : null;

  // Special handling for survey "68fd1915d41841da463f0d46"
  if (surveyIdStr === '68fd1915d41841da463f0d46') {
    // Find name from name question
    const nameResponse = findResponseByQuestionText(responses, [
      'what is your full name',
      'full name',
      'name'
    ]);
    
    // Find gender - use genderUtils
    let genderResponse = findGenderResponse(responses, survey);
    if (!genderResponse) {
      genderResponse = findResponseByQuestionText(responses, [
        'please note the respondent\'s gender',
        'note the respondent\'s gender',
        'respondent\'s gender',
        'respondent gender',
        'note the gender',
        'gender'
      ]);
    }
    
    // Find age from age question
    const ageResponse = findResponseByQuestionText(responses, [
      'could you please tell me your age',
      'your age in complete years',
      'age in complete years',
      'age'
    ]);

    let city = 'N/A';
    if (responseData?.location?.city) {
      city = responseData.location.city;
    } else {
      const cityResponse = findResponseByQuestionText(responses, [
        'city',
        'location'
      ]);
      city = cityResponse?.response || 'N/A';
    }

    // Extract AC using comprehensive function
    const extractedAC = extractACFromResponse(responses, responseData);
    const acName = extractedAC || 'N/A';
    const district = getDistrictFromAC(acName);
    const lokSabha = getPCFromAC(acName);

    return {
      name: nameResponse?.response || 'N/A',
      gender: genderResponse?.response || 'N/A',
      age: ageResponse?.response || 'N/A',
      city: city,
      district: district,
      ac: acName,
      lokSabha: lokSabha,
      state: 'N/A'
    };
  }

  // Default behavior for other surveys
  const nameResponse = responses.find(r => 
    getMainText(r.questionText || '').toLowerCase().includes('name') || 
    getMainText(r.questionText || '').toLowerCase().includes('respondent') ||
    getMainText(r.questionText || '').toLowerCase().includes('full name')
  );
  
  // Find gender response (checks both gender and registered voter questions)
  const genderResponse = findGenderResponse(responses, survey) || findQuestionResponse(responses, ['gender', 'sex']);
  
  const ageResponse = responses.find(r => 
    getMainText(r.questionText || '').toLowerCase().includes('age') || 
    getMainText(r.questionText || '').toLowerCase().includes('year')
  );

  const acResponse = responses.find(r => 
    r.questionText?.toLowerCase().includes('assembly') ||
    r.questionText?.toLowerCase().includes('constituency')
  );

  let city = 'N/A';
  if (responseData?.location?.city) {
    city = responseData.location.city;
  } else {
    const cityResponse = responses.find(r => 
      r.questionText?.toLowerCase().includes('city') || 
      r.questionText?.toLowerCase().includes('location')
    );
    city = cityResponse?.response || 'N/A';
  }

  // Extract AC
  const extractedAC = extractACFromResponse(responses, responseData);
  const acName = extractedAC || (acResponse?.response ? getMainText(String(acResponse.response)) : 'N/A');
  const district = getDistrictFromAC(acName);
  const lokSabha = getPCFromAC(acName);

  return {
    name: nameResponse?.response || 'N/A',
    gender: genderResponse?.response || 'N/A',
    age: ageResponse?.response || 'N/A',
    city: city,
    district: district,
    ac: acName,
    lokSabha: lokSabha,
    state: 'N/A'
  };
};

module.exports = {
  extractACFromResponse,
  getRespondentInfo,
  findQuestionResponse,
  getMainTextValue
};

