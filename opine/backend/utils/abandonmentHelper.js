/**
 * Helper functions for detecting abandoned interviews
 * Backend-only logic that works for all app versions
 */

/**
 * Check if the registered voter question is answered "No"
 * This should mark the interview as abandoned (not auto-rejected)
 * @param {Array} responses - Array of response objects
 * @param {String} surveyId - Survey ID (optional, for survey-specific logic)
 * @returns {Object|null} - Object with { isNotRegisteredVoter: boolean, reason: string } or null
 */
function checkRegisteredVoterResponse(responses, surveyId = null) {
  if (!responses || !Array.isArray(responses)) {
    return null;
  }

  // Find the registered voter question
  // Question text: "Are you a registered voter in this assembly Constituency?"
  const voterResponse = responses.find(r => {
    const questionText = (r.questionText || r.question?.text || '').toLowerCase();
    return (questionText.includes('are you a registered voter') && 
            questionText.includes('assembly constituency')) ||
           (questionText.includes('নিবন্ধিত ভোটার') && 
            questionText.includes('বিধানসভা কেন্দ্র'));
  });

  if (!voterResponse || voterResponse.response === null || voterResponse.response === undefined) {
    return null;
  }

  // For survey "68fd1915d41841da463f0d46": Check responseCodes or response value
  const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';
  if (surveyId && surveyId.toString() === TARGET_SURVEY_ID) {
    // Check responseCodes field (can be string, array, or null)
    let responseCode = null;
    if (voterResponse.responseCodes !== null && voterResponse.responseCodes !== undefined) {
      if (Array.isArray(voterResponse.responseCodes)) {
        responseCode = voterResponse.responseCodes[0] || null;
      } else {
        responseCode = voterResponse.responseCodes;
      }
      responseCode = responseCode ? String(responseCode).trim() : null;
    }
    
    // Check response value itself
    let responseValue = null;
    if (voterResponse.response !== null && voterResponse.response !== undefined) {
      if (Array.isArray(voterResponse.response)) {
        responseValue = voterResponse.response[0] || null;
      } else {
        responseValue = voterResponse.response;
      }
      responseValue = responseValue ? String(responseValue).trim().toLowerCase() : null;
    }
    
    // If responseCodes is '2' OR response value contains 'no', mark as not registered voter
    // Response can be "no_{না।{नहीं}}" or just "no" or "2"
    if (responseCode === '2' || (responseValue && (responseValue.includes('no') || responseValue === '2'))) {
      return {
        isNotRegisteredVoter: true,
        reason: 'Not_Registered_Voter_In_AC'
      };
    }
  } else {
    // For other surveys, check if response is "no" (case-insensitive)
    const normalizedResponse = String(voterResponse.response || '').toLowerCase().trim();
    if (normalizedResponse.includes('no') || normalizedResponse === '2') {
      return {
        isNotRegisteredVoter: true,
        reason: 'Not_Registered_Voter_In_AC'
      };
    }
  }

  return null;
}

module.exports = {
  checkRegisteredVoterResponse
};

