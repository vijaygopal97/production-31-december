import { getMainText } from './translations';

/**
 * Check if a question is a gender question (including equivalence with registered voter question)
 * @param {Object} question - Question object
 * @returns {boolean} - True if question is a gender question
 */
export const isGenderQuestion = (question) => {
  if (!question) return false;
  const questionText = getMainText(question.text || '').toLowerCase();
  const questionId = question.id || '';
  
  // Check for fixed gender question ID
  if (questionId.includes('fixed_respondent_gender')) {
    return true;
  }
  
  // Check for gender question text
  if (questionText.includes('what is your gender') || questionText.includes('gender')) {
    return true;
  }
  
  // Check for registered voter question (equivalent to gender question)
  if (questionText.includes('are you a registered voter') || 
      questionText.includes('registered voter') ||
      questionText.includes('নিবন্ধিত ভোটার') ||
      questionText.includes('বিধানসভা কেন্দ্র')) {
    return true;
  }
  
  return false;
};

/**
 * Check if a question is an age question
 * @param {Object} question - Question object
 * @returns {boolean} - True if question is an age question
 */
export const isAgeQuestion = (question) => {
  if (!question) return false;
  const questionText = getMainText(question.text || '').toLowerCase();
  const questionId = question.id || '';
  
  // Check for fixed age question ID
  if (questionId.includes('fixed_respondent_age')) {
    return true;
  }
  
  // Check for age question text (ignoring translations)
  if (questionText.includes('could you please tell me your age') || 
      questionText.includes('tell me your age') ||
      questionText.includes('what is your age') ||
      questionText.includes('your age in complete years') ||
      questionText.includes('age in complete years')) {
    return true;
  }
  
  return false;
};

/**
 * Normalize gender response to handle translations (Male {পুরুষ}, Female {মহিলা})
 * @param {any} response - Response value (can be string, object, or array)
 * @returns {string} - Normalized gender value ('male', 'female', or original normalized value)
 */
export const normalizeGenderResponse = (response) => {
  if (!response) return '';
  
  // Handle array responses
  if (Array.isArray(response)) {
    response = response[0] || '';
  }
  
  // Handle object responses
  if (typeof response === 'object' && response !== null) {
    response = response.value || response.text || response;
  }
  
  // Convert to string and get main text (strip translations)
  const responseStr = String(response);
  const mainText = getMainText(responseStr).toLowerCase().trim();
  
  // Check for Male variations (with or without translation)
  if (mainText === 'male' || mainText === 'পুরুষ' || 
      (responseStr.toLowerCase().includes('male') && responseStr.toLowerCase().includes('পুরুষ'))) {
    return 'male';
  }
  
  // Check for Female variations (with or without translation)
  if (mainText === 'female' || mainText === 'মহিলা' ||
      (responseStr.toLowerCase().includes('female') && responseStr.toLowerCase().includes('মহিলা'))) {
    return 'female';
  }
  
  // Return normalized main text
  return mainText;
};

/**
 * Find gender response from responses array (checks both gender and registered voter questions)
 * @param {Array} responses - Array of response objects
 * @param {Object} survey - Survey object (optional, for finding questions)
 * @returns {Object|null} - Gender response object or null
 */
export const findGenderResponse = (responses, survey = null) => {
  if (!responses || !Array.isArray(responses)) return null;
  
  // First, try to find by question ID
  let genderResponse = responses.find(r => {
    const questionId = r.questionId || r.question?.id || '';
    return questionId.includes('fixed_respondent_gender');
  });
  
  if (genderResponse) return genderResponse;
  
  // Second, try to find by question text (gender question)
  genderResponse = responses.find(r => {
    const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
    return questionText.includes('what is your gender') || questionText.includes('gender');
  });
  
  if (genderResponse) return genderResponse;
  
  // Third, try to find registered voter question (equivalent)
  genderResponse = responses.find(r => {
    const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
    return questionText.includes('are you a registered voter') || 
           questionText.includes('registered voter') ||
           questionText.includes('নিবন্ধিত ভোটার') ||
           questionText.includes('বিধানসভা কেন্দ্র');
  });
  
  if (genderResponse) return genderResponse;
  
  // Fourth, if survey is provided, find by question in survey
  if (survey && survey.sections) {
    for (const section of survey.sections) {
      if (section.questions) {
        for (const question of section.questions) {
          if (isGenderQuestion(question)) {
            const foundResponse = responses.find(r => {
              const rQuestionId = r.questionId || r.question?.id || '';
              return rQuestionId === question.id;
            });
            if (foundResponse) return foundResponse;
          }
        }
      }
    }
  }
  
  return null;
};

