// Fixed questions that are automatically added to every survey
// These questions are locked and cannot be edited or deleted by users

export const FIXED_QUESTIONS = [
  {
    id: 'fixed_respondent_name',
    type: 'text',
    text: 'What is your full name?',
    description: 'Please provide your complete name as it appears on official documents.',
    required: true,
    order: 0,
    isFixed: true,
    isLocked: true,
    options: [],
    settings: {
      allowMultiple: false,
      allowOther: false,
      required: true
    },
    validation: {
      minLength: 2,
      maxLength: 100
    }
  },
  {
    id: 'fixed_respondent_gender',
    type: 'multiple_choice',
    text: 'What is your gender?',
    description: 'Please select your gender identity.',
    required: true,
    order: 1,
    isFixed: true,
    isLocked: true,
    options: [
      { 
        id: 'fixed_gender_male', 
        text: 'Male', 
        value: 'male' 
      },
      { 
        id: 'fixed_gender_female', 
        text: 'Female', 
        value: 'female' 
      }
    ],
    settings: {
      allowMultiple: false, // Single selection only
      allowOther: false,
      required: true
    }
  },
  {
    id: 'fixed_respondent_age',
    type: 'numeric',
    text: 'Could you please tell me your age in complete years?',
    description: 'Please enter your age in years.',
    required: true,
    order: 2,
    isFixed: true,
    isLocked: true,
    options: [],
    settings: {
      allowMultiple: false,
      allowOther: false,
      required: true
    },
    validation: {
      minValue: 13,
      maxValue: 120
    }
  }
];

// Helper function to check if a question is fixed
export const isFixedQuestion = (questionId) => {
  return FIXED_QUESTIONS.some(q => q.id === questionId);
};

// Helper function to get fixed questions with proper IDs for a survey
export const getFixedQuestionsForSurvey = (surveyId = null) => {
  return FIXED_QUESTIONS.map(question => ({
    ...question,
    id: surveyId ? `${surveyId}_${question.id}` : question.id
  }));
};

// Helper function to ensure fixed questions are at the beginning of the first section
export const ensureFixedQuestionsInSurvey = (sections) => {
  if (!sections || sections.length === 0) {
    // Create a new section with fixed questions
    return [{
      id: 'section_1',
      title: 'Respondent Information',
      questions: [...FIXED_QUESTIONS]
    }];
  }

  const updatedSections = [...sections];
  const firstSection = updatedSections[0];
  
  if (!firstSection) {
    updatedSections[0] = {
      id: 'section_1',
      title: 'Respondent Information',
      questions: [...FIXED_QUESTIONS]
    };
    return updatedSections;
  }

  // Get the IDs of fixed questions that should exist
  const requiredFixedQuestionIds = FIXED_QUESTIONS.map(q => q.id);
  
  // Check which fixed questions already exist in the first section
  // Check by both isFixed property and ID to be safe
  const existingFixedQuestionIds = firstSection.questions
    .filter(q => (q.isFixed && requiredFixedQuestionIds.includes(q.id)) || requiredFixedQuestionIds.includes(q.id))
    .map(q => q.id);

  // Add missing fixed questions
  const missingFixedQuestions = FIXED_QUESTIONS.filter(
    fixedQ => !existingFixedQuestionIds.includes(fixedQ.id)
  );

  if (missingFixedQuestions.length > 0) {
    // Insert missing fixed questions at the beginning of the first section
    updatedSections[0] = {
      ...firstSection,
      questions: [...missingFixedQuestions, ...firstSection.questions]
    };
  }

  return updatedSections;
};

// Helper function to remove fixed questions (for migration purposes)
export const removeFixedQuestionsFromSurvey = (sections) => {
  if (!sections || sections.length === 0) return sections;

  return sections.map(section => ({
    ...section,
    questions: section.questions.filter(q => !q.isFixed)
  }));
};
