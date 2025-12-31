import React, { useState, useCallback, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Home, 
  Users, 
  Globe, 
  Phone,
  Plus,
  Save,
  Eye,
  Send,
  Loader
} from 'lucide-react';
import { surveyAPI } from '../../services/api';
import SurveyModeSelection from './SurveyModeSelection';
import SurveySpecifications from './SurveySpecifications';
import InterviewerSelection from './InterviewerSelection';
import QualityAgentSelection from './QualityAgentSelection';
import SurveyTemplateSuggestions from './SurveyTemplateSuggestions';
import SurveyQuestionBuilder from './SurveyQuestionBuilder';
import RespondentUpload from './RespondentUpload';
import { useToast } from '../../contexts/ToastContext';

const SurveyBuilder = ({ onClose, onSave, editingSurvey }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contactsModified, setContactsModified] = useState(false); // Track if respondentContacts have been modified
  const [respondentContactsModifications, setRespondentContactsModifications] = useState(null); // Track modifications from RespondentUpload
  const { showSuccess, showError } = useToast();
  const [surveyData, setSurveyData] = useState({
    mode: '',
    modes: [],
    modeAllocation: {},
    modeGigWorkers: {},
    includeGigWorkers: false,
    specifications: {},
    interviewers: [],
    capiInterviewers: [],
    catiInterviewers: [],
    qualityAgents: [],
    template: null,
    questions: [],
    respondentContacts: [],
    sets: [],
    // Separate AC settings for each step
    interviewerACSettings: {
      assignACs: false,
      selectedCountry: '',
      selectedState: ''
    },
    capiACSettings: {
      assignACs: false,
      selectedCountry: '',
      selectedState: ''
    },
    catiACSettings: {
      assignACs: false,
      selectedCountry: '',
      selectedState: ''
    },
    qualityAgentACSettings: {
      assignACs: false,
      selectedCountry: '',
      selectedState: ''
    }
  });

  // Helper function to convert target audience data from array format to object format
  const convertTargetAudienceFormat = (targetAudience) => {
    if (!targetAudience) {
      return {
        demographics: {},
        geographic: {},
        behavioral: {},
        psychographic: {},
        custom: '',
        quotaManagement: false
      };
    }
    
    return {
      demographics: Array.isArray(targetAudience.demographics) ? {} : (targetAudience.demographics || {}),
      geographic: Array.isArray(targetAudience.geographic) ? {} : (targetAudience.geographic || {}),
      behavioral: Array.isArray(targetAudience.behavioral) ? {} : (targetAudience.behavioral || {}),
      psychographic: Array.isArray(targetAudience.psychographic) ? {} : (targetAudience.psychographic || {}),
      custom: Array.isArray(targetAudience.custom) ? '' : (targetAudience.custom || ''),
      quotaManagement: targetAudience.quotaManagement || false
    };
  };

  // Populate form with existing data when editing
  useEffect(() => {
    if (editingSurvey) {
      // Reset contactsModified flag when loading survey for editing
      setContactsModified(false);
      
      // Process interviewer data first
      const processedCapiInterviewers = editingSurvey.capiInterviewers && Array.isArray(editingSurvey.capiInterviewers) ? 
        (() => {
          const filtered = editingSurvey.capiInterviewers.filter(assignment => {
            return assignment && assignment.interviewer;
          });
          const mapped = filtered.map(assignment => ({
            id: assignment.interviewer._id || assignment.interviewer,
            firstName: assignment.interviewer.firstName || '',
            lastName: assignment.interviewer.lastName || '',
            name: assignment.interviewer.firstName && assignment.interviewer.lastName ? 
              `${assignment.interviewer.firstName} ${assignment.interviewer.lastName}` : 
              assignment.interviewer.firstName || assignment.interviewer.lastName || 'Unknown',
            email: assignment.interviewer.email || '',
            phone: assignment.interviewer.phone || '',
            location: assignment.interviewer.location || assignment.interviewer.city || '',
            city: assignment.interviewer.city || '',
            userType: assignment.interviewer.userType || '',
            rating: assignment.interviewer.rating || 0,
            experience: assignment.interviewer.experience || 0,
            specialties: assignment.interviewer.specialties || [],
            languages: assignment.interviewer.languages || [],
            trustScore: assignment.interviewer.trustScore || 0,
            avgRating: assignment.interviewer.avgRating || 0,
            maxInterviews: assignment.maxInterviews || 0,
            status: assignment.status || 'assigned',
            selectedState: assignment.selectedState || '',
            assignedACs: assignment.assignedACs || [],
            selectedCountry: assignment.selectedCountry || ''
          }));
          return mapped;
        })() : [];

      const processedCatiInterviewers = editingSurvey.catiInterviewers && Array.isArray(editingSurvey.catiInterviewers) ? 
        (() => {
          const filtered = editingSurvey.catiInterviewers.filter(assignment => {
            return assignment && assignment.interviewer;
          });
          const mapped = filtered.map(assignment => ({
            id: assignment.interviewer._id || assignment.interviewer,
            firstName: assignment.interviewer.firstName || '',
            lastName: assignment.interviewer.lastName || '',
            name: assignment.interviewer.firstName && assignment.interviewer.lastName ? 
              `${assignment.interviewer.firstName} ${assignment.interviewer.lastName}` : 
              assignment.interviewer.firstName || assignment.interviewer.lastName || 'Unknown',
            email: assignment.interviewer.email || '',
            phone: assignment.interviewer.phone || '',
            location: assignment.interviewer.location || assignment.interviewer.city || '',
            city: assignment.interviewer.city || '',
            userType: assignment.interviewer.userType || '',
            rating: assignment.interviewer.rating || 0,
            experience: assignment.interviewer.experience || 0,
            specialties: assignment.interviewer.specialties || [],
            languages: assignment.interviewer.languages || [],
            trustScore: assignment.interviewer.trustScore || 0,
            avgRating: assignment.interviewer.avgRating || 0,
            maxInterviews: assignment.maxInterviews || 0,
            status: assignment.status || 'assigned',
            selectedState: assignment.selectedState || '',
            assignedACs: assignment.assignedACs || [],
            selectedCountry: assignment.selectedCountry || ''
          }));
          return mapped;
        })() : [];

      setSurveyData({
        _id: editingSurvey._id || editingSurvey.id, // Include survey ID for special survey detection
        mode: editingSurvey.mode || '',
        modes: editingSurvey.modes || [],
        modeAllocation: editingSurvey.modeAllocation || {},
        modeGigWorkers: editingSurvey.modeGigWorkers || {},
        includeGigWorkers: editingSurvey.includeGigWorkers || false,
        specifications: {
          surveyName: editingSurvey.surveyName || editingSurvey.name || '',
          description: editingSurvey.description || '',
          startDate: editingSurvey.startDate ? new Date(editingSurvey.startDate).toISOString().split('T')[0] : '',
          endDate: editingSurvey.deadline ? new Date(editingSurvey.deadline).toISOString().split('T')[0] : '',
          category: editingSurvey.category || '',
          purpose: editingSurvey.purpose || '',
          sampleSize: editingSurvey.sampleSize || '',
          targetAudience: convertTargetAudienceFormat(editingSurvey.targetAudience)
        },
        interviewers: editingSurvey.assignedInterviewers && Array.isArray(editingSurvey.assignedInterviewers) ? 
          editingSurvey.assignedInterviewers
            .filter(assignment => assignment && assignment.interviewer && assignment.interviewer._id) // Filter out null/undefined interviewers
            .map(assignment => ({
              id: assignment.interviewer._id || assignment.interviewer,
              firstName: assignment.interviewer.firstName || '',
              lastName: assignment.interviewer.lastName || '',
              name: assignment.interviewer.firstName && assignment.interviewer.lastName ? 
                `${assignment.interviewer.firstName} ${assignment.interviewer.lastName}` : 
                assignment.interviewer.firstName || assignment.interviewer.lastName || 'Unknown',
              email: assignment.interviewer.email || '',
              phone: assignment.interviewer.phone || '',
              location: assignment.interviewer.location || assignment.interviewer.city || '',
              city: assignment.interviewer.city || '',
              userType: assignment.interviewer.userType || '',
              rating: assignment.interviewer.rating || 0,
              experience: assignment.interviewer.experience || 0,
              specialties: assignment.interviewer.specialties || [],
            languages: assignment.interviewer.languages || [],
            trustScore: assignment.interviewer.trustScore || 0,
            avgRating: assignment.interviewer.avgRating || 0,
            maxInterviews: assignment.maxInterviews || 0,
            status: assignment.status || 'assigned',
            // Include AC assignment data
            selectedState: assignment.selectedState || '',
            assignedACs: assignment.assignedACs || [],
            selectedCountry: assignment.selectedCountry || ''
          })) : [],
        capiInterviewers: processedCapiInterviewers,
        catiInterviewers: processedCatiInterviewers,
        qualityAgents: editingSurvey.assignedQualityAgents && Array.isArray(editingSurvey.assignedQualityAgents) ? 
          editingSurvey.assignedQualityAgents
            .filter(assignment => {
              const hasQualityAgent = assignment && assignment.qualityAgent;
              const hasId = hasQualityAgent && (assignment.qualityAgent._id || assignment.qualityAgent);
              return hasId;
            })
            .map(assignment => {
              const mapped = {
                id: assignment.qualityAgent._id || assignment.qualityAgent,
                firstName: assignment.qualityAgent.firstName || '',
                lastName: assignment.qualityAgent.lastName || '',
                name: assignment.qualityAgent.firstName && assignment.qualityAgent.lastName ? 
                  `${assignment.qualityAgent.firstName} ${assignment.qualityAgent.lastName}` : 
                  assignment.qualityAgent.firstName || assignment.qualityAgent.lastName || 'Unknown',
                email: assignment.qualityAgent.email || '',
                phone: assignment.qualityAgent.phone || '',
                location: assignment.qualityAgent.location || assignment.qualityAgent.city || '',
                city: assignment.qualityAgent.city || '',
                userType: assignment.qualityAgent.userType || '',
                rating: assignment.qualityAgent.rating || 0,
                experience: assignment.qualityAgent.experience || 0,
                specialties: assignment.qualityAgent.specialties || [],
                languages: assignment.qualityAgent.languages || [],
                trustScore: assignment.qualityAgent.trustScore || 0,
                avgRating: assignment.qualityAgent.avgRating || 0,
                status: assignment.status || 'assigned',
                selectedState: assignment.selectedState || '',
                assignedACs: assignment.assignedACs || [],
                selectedCountry: assignment.selectedCountry || ''
              };
              return mapped;
            }) : [],
        template: editingSurvey.template || null,
        questions: editingSurvey.sections || editingSurvey.questions || [],
        respondentContacts: editingSurvey.respondentContacts || [],
        sets: editingSurvey.sets || [],
        // Initialize separate AC settings for each step
        // For backward compatibility, check if any interviewer has ACs assigned
        interviewerACSettings: {
          assignACs: (editingSurvey.assignedInterviewers && editingSurvey.assignedInterviewers.some(i => i.assignedACs && i.assignedACs.length > 0)) || editingSurvey.assignACs || false,
          selectedCountry: editingSurvey.acAssignmentCountry || '',
          selectedState: editingSurvey.acAssignmentState || ''
        },
        capiACSettings: {
          assignACs: (editingSurvey.capiInterviewers && editingSurvey.capiInterviewers.some(i => i.assignedACs && i.assignedACs.length > 0)) || false,
          selectedCountry: editingSurvey.acAssignmentCountry || '',
          selectedState: editingSurvey.acAssignmentState || ''
        },
        catiACSettings: {
          assignACs: (editingSurvey.catiInterviewers && editingSurvey.catiInterviewers.some(i => i.assignedACs && i.assignedACs.length > 0)) || false,
          selectedCountry: editingSurvey.acAssignmentCountry || '',
          selectedState: editingSurvey.acAssignmentState || ''
        },
        qualityAgentACSettings: {
          assignACs: (editingSurvey.assignedQualityAgents && editingSurvey.assignedQualityAgents.some(qa => qa.assignedACs && qa.assignedACs.length > 0)) || false,
          selectedCountry: editingSurvey.acAssignmentCountry || '',
          selectedState: editingSurvey.acAssignmentState || ''
        }
      });
    }
  }, [editingSurvey]);

  // Dynamic steps based on survey mode
  const getSteps = () => {
    const isMultiMode = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
    const selectedModes = surveyData.modes || [];
    const isOnlyCAPI = (surveyData.mode === 'capi') || (selectedModes.length === 1 && selectedModes.includes('capi'));
    const isOnlyCATI = (surveyData.mode === 'cati') || (selectedModes.length === 1 && selectedModes.includes('cati'));
    const hasCATI = isOnlyCATI || isMultiMode || (selectedModes.includes('cati'));
    
    if (editingSurvey) {
      const baseSteps = [
        { id: 1, title: 'Survey Mode', description: 'Choose how you want to conduct your survey' },
        { id: 2, title: 'Survey Details', description: 'Define your survey specifications' },
        { 
          id: 3, 
          title: isMultiMode ? 'Select CAPI Interviewers' : (isOnlyCAPI ? 'Select CAPI Interviewers' : isOnlyCATI ? 'Select CATI Interviewers' : 'Select Interviewers'), 
          description: isMultiMode ? 'Choose who will conduct face-to-face interviews' : (isOnlyCAPI ? 'Choose who will conduct face-to-face interviews' : isOnlyCATI ? 'Choose who will conduct telephone interviews' : 'Choose who will conduct the interviews')
        },
        ...(isMultiMode ? [{ id: 4, title: 'Select CATI Interviewers', description: 'Choose who will conduct telephone interviews' }] : []),
        { id: isMultiMode ? 5 : 4, title: 'Select Quality Agents', description: 'Choose quality agents to review survey responses' },
      ];
      
      // Add Upload Respondents step if CATI is selected (before Build Survey)
      if (hasCATI) {
        baseSteps.push({ id: (isMultiMode ? 6 : 5), title: 'Upload Respondents', description: 'Add contacts for CATI interviews' });
      }
      
      baseSteps.push({ id: (isMultiMode ? (hasCATI ? 7 : 6) : (hasCATI ? 6 : 5)), title: 'Build Survey', description: 'Edit your survey questions' });
      
      return baseSteps;
    } else {
      const baseSteps = [
        { id: 1, title: 'Survey Mode', description: 'Choose how you want to conduct your survey' },
        { id: 2, title: 'Survey Details', description: 'Define your survey specifications' },
        { 
          id: 3, 
          title: isMultiMode ? 'Select CAPI Interviewers' : (isOnlyCAPI ? 'Select CAPI Interviewers' : isOnlyCATI ? 'Select CATI Interviewers' : 'Select Interviewers'), 
          description: isMultiMode ? 'Choose who will conduct face-to-face interviews' : (isOnlyCAPI ? 'Choose who will conduct face-to-face interviews' : isOnlyCATI ? 'Choose who will conduct telephone interviews' : 'Choose who will conduct the interviews')
        },
        ...(isMultiMode ? [{ id: 4, title: 'Select CATI Interviewers', description: 'Choose who will conduct telephone interviews' }] : []),
        { id: isMultiMode ? 5 : 4, title: 'Select Quality Agents', description: 'Choose quality agents to review survey responses' },
      ];
      
      // Add Upload Respondents step if CATI is selected (before Templates)
      if (hasCATI) {
        baseSteps.push({ id: (isMultiMode ? 6 : 5), title: 'Upload Respondents', description: 'Add contacts for CATI interviews' });
      }
      
      baseSteps.push(
        { id: (isMultiMode ? (hasCATI ? 7 : 6) : (hasCATI ? 6 : 5)), title: 'Templates', description: 'Select or create survey questions' },
        { id: (isMultiMode ? (hasCATI ? 8 : 7) : (hasCATI ? 7 : 6)), title: 'Build Survey', description: 'Create your survey questions' }
      );
      
      return baseSteps;
    }
  };
  
  const steps = getSteps();

  const handleNext = () => {
    if (currentStep < steps.length) {
      // Trigger data updates for the current step before moving to next
      switch (currentStep) {
        case 1:
          // SurveyModeSelection - data is already updated via onUpdate
          break;
        case 2:
          // SurveySpecifications - data is already updated via onUpdate
          break;
        case 3:
          // CAPI InterviewerSelection - data is already updated via onUpdate
          break;
        case 4:
          // CATI InterviewerSelection - data is already updated via onUpdate
          break;
        case 5:
          // SurveyTemplateSuggestions - data is already updated via onUpdate
          break;
        default:
          break;
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepId) => {
    // In edit mode, allow navigation to any step
    if (editingSurvey || stepId <= currentStep) {
      setCurrentStep(stepId);
    }
  };

  const updateSurveyData = useCallback((step, data) => {
    // Prevent infinite loops by checking if the data is actually different
    if (step === 'capiInterviewers' && Array.isArray(data) && data.length === 0) {
      // Only update if the current capiInterviewers is not already empty
      setSurveyData(prev => {
        if (prev.capiInterviewers && prev.capiInterviewers.length === 0) {
          return prev;
        }
        return { ...prev, [step]: data };
      });
      return;
    }
    
    if (step === 'catiInterviewers' && Array.isArray(data) && data.length === 0) {
      // Only update if the current catiInterviewers is not already empty
      setSurveyData(prev => {
        if (prev.catiInterviewers && prev.catiInterviewers.length === 0) {
          return prev;
        }
        return { ...prev, [step]: data };
      });
      return;
    }
    
    // Track if respondentContacts are being modified (only if actually changed)
    if (step === 'respondentContacts') {
      // Prevent infinite loop by checking if data actually changed
      setSurveyData(prev => {
        const prevContactsStr = JSON.stringify(prev.respondentContacts || []);
        const newContactsStr = JSON.stringify(data || []);
        if (prevContactsStr !== newContactsStr) {
          setContactsModified(true);
          return { ...prev, [step]: data };
        }
        return prev; // No change, don't update
      });
      return;
    }
    
    setSurveyData(prev => {
      // Special handling for mode data to extract modes and modeAllocation
      if (step === 'mode') {
        // Simple check - only update if mode actually changed
        if (prev.mode === data.mode && 
            JSON.stringify(prev.modes) === JSON.stringify(data.modes || []) &&
            JSON.stringify(prev.modeAllocation) === JSON.stringify(data.modeAllocation || {}) &&
            JSON.stringify(prev.modeGigWorkers) === JSON.stringify(data.modeGigWorkers || {}) &&
            prev.includeGigWorkers === data.includeGigWorkers) {
          return prev;
        }
        
        const newData = {
          ...prev,
          mode: data.mode, // Extract just the mode string
          modes: data.modes || [],
          modeAllocation: data.modeAllocation || {},
          modeGigWorkers: data.modeGigWorkers || {},
          includeGigWorkers: data.includeGigWorkers || false
        };
        
        return newData;
      }
      
      // For other steps, just update the step data
      return {
        ...prev,
        [step]: data
      };
    });
  }, []);

  // Stable callback for AC settings updates - now accepts step identifier
  const handleACSettingsUpdate = useCallback((data, step) => {
    // Determine which AC settings to update based on step
    let settingsKey = 'interviewerACSettings'; // default
    if (step === 'capi') {
      settingsKey = 'capiACSettings';
    } else if (step === 'cati') {
      settingsKey = 'catiACSettings';
    } else if (step === 'qualityAgent') {
      settingsKey = 'qualityAgentACSettings';
    } else if (step === 'interviewer') {
      settingsKey = 'interviewerACSettings';
    }
    updateSurveyData(settingsKey, data);
  }, [updateSurveyData]);

  const handleSaveDraft = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate required data for draft (minimal validation)
      if (!surveyData.mode || !surveyData.mode.mode) {
        throw new Error('Survey mode is required');
      }

      // Helper function to generate unique IDs
      const generateId = () => Math.random().toString(36).substr(2, 9);
      
      // Helper function to add IDs to sections and questions
      const addIdsToSections = (sections) => {
        return sections.map(section => ({
          ...section,
          id: section.id || generateId(),
          questions: section.questions?.map(question => {
            // Preserve all question fields including settings
            const questionWithIds = {
              ...question,
              id: question.id || generateId(),
              options: question.options?.map(option => ({
                ...option,
                id: option.id || generateId()
              })) || []
            };
            
            
            return questionWithIds;
          }) || []
        }));
      };
      
      // Helper function to add IDs to questions
      const addIdsToQuestions = (questions) => {
        return questions.map(question => ({
          ...question,
          id: question.id || generateId(),
          options: question.options?.map((option, idx) => ({
            ...option,
            id: option.id || generateId(),
            code: option.code || String(idx + 1) // Preserve code or default to index + 1
          })) || []
        }));
      };

      // Prepare survey data for API (draft version - minimal required fields)
      // Normalize conditional rules: keep valid rules; for operators that don't need value, set sentinel value
      const normalizeSections = (sections) => {
        const normalizeQuestion = (q) => {
          if (!q) return q;
          
          // Normalize conditions if they exist
          let normalizedQuestion = { ...q };
          if (q.conditions && q.conditions.length > 0) {
            const cleanedConditions = q.conditions
              .filter(c => c && c.questionId && c.operator)
              .map(c => {
                if (c.operator === 'is_empty' || c.operator === 'is_not_empty') {
                  return { ...c, value: c.value !== undefined && c.value !== null && c.value !== '' ? c.value : '__NOVALUE__' };
                }
                return { ...c, value: (c.value ?? '').toString() };
              });
            normalizedQuestion.conditions = cleanedConditions;
          }
          
          // Ensure all required fields are present
          // Preserve settings object and ensure it's properly structured
          const preservedSettings = normalizedQuestion.settings && typeof normalizedQuestion.settings === 'object' 
            ? { ...normalizedQuestion.settings } 
            : {};
          
          
          // Preserve options with codes
          const preservedOptions = normalizedQuestion.options?.map((opt, idx) => {
            if (typeof opt === 'string') {
              return {
                id: generateId(),
                text: opt,
                value: opt.toLowerCase().replace(/\s+/g, '_'),
                code: String(idx + 1) // Default code
              };
            }
            return {
              id: opt.id || generateId(),
              text: opt.text || opt.value || '',
              value: opt.value || opt.text?.toLowerCase().replace(/\s+/g, '_') || '',
              code: opt.code || String(idx + 1) // Preserve code or default to index + 1
            };
          }) || [];
          
          return {
            ...normalizedQuestion,
            id: normalizedQuestion.id || generateId(),
            type: normalizedQuestion.type || 'text',
            text: normalizedQuestion.text || 'New Question',
            description: normalizedQuestion.description || '',
            required: normalizedQuestion.required !== undefined ? normalizedQuestion.required : true,
            order: normalizedQuestion.order || 0,
            options: preservedOptions,
            settings: preservedSettings,
            isFixed: normalizedQuestion.isFixed || false,
            isLocked: normalizedQuestion.isLocked || false
          };
        };
        
        return (sections || []).map(section => ({
          ...section,
          id: section.id || generateId(),
          title: section.title || 'New Section',
          description: section.description || '',
          order: section.order || 0,
          questions: (section.questions || []).map(normalizeQuestion)
        }));
      };
      const surveyPayload = {
        mode: surveyData.mode,
        includeGigWorkers: surveyData.includeGigWorkers,
        status: 'draft', // Set status to draft
        sections: addIdsToSections(normalizeSections(surveyData.questions || [])),
        questions: addIdsToQuestions((normalizeSections(surveyData.questions || [])).flatMap(sec => (sec.questions ? sec.questions : []))),
        templateUsed: surveyData.template || {},
        settings: {
          allowAnonymous: false,
          requireAuthentication: true,
          allowMultipleResponses: false,
          showProgress: true,
          randomizeQuestions: false,
          randomizeOptions: false
        },
        notifications: {
          emailReminders: true,
          smsReminders: false,
          whatsappReminders: false,
          reminderFrequency: 'weekly'
        },
        // AC Assignment settings - set to true if ANY step has assignACs enabled (for backward compatibility)
        assignACs: (surveyData.interviewerACSettings?.assignACs || 
                    surveyData.capiACSettings?.assignACs || 
                    surveyData.catiACSettings?.assignACs || 
                    surveyData.qualityAgentACSettings?.assignACs) || false,
        // Use the first available country/state from any step (for backward compatibility)
        acAssignmentCountry: surveyData.interviewerACSettings?.selectedCountry || 
                             surveyData.capiACSettings?.selectedCountry || 
                             surveyData.catiACSettings?.selectedCountry || 
                             surveyData.qualityAgentACSettings?.selectedCountry || '',
        acAssignmentState: surveyData.interviewerACSettings?.selectedState || 
                           surveyData.capiACSettings?.selectedState || 
                           surveyData.catiACSettings?.selectedState || 
                           surveyData.qualityAgentACSettings?.selectedState || '',
        sets: surveyData.sets || []
      };
      
      // Only include respondentContacts if they have been modified
      if (contactsModified) {
        surveyPayload.respondentContacts = surveyData.respondentContacts || [];
      }

      // Only add fields if they have values (for draft)
      if (surveyData.specifications.surveyName) {
        surveyPayload.surveyName = surveyData.specifications.surveyName;
      }
      if (surveyData.specifications.description) {
        surveyPayload.description = surveyData.specifications.description;
      }
      if (surveyData.specifications.category) {
        surveyPayload.category = surveyData.specifications.category;
      }
      if (surveyData.specifications.purpose) {
        surveyPayload.purpose = surveyData.specifications.purpose;
      }
      if (surveyData.specifications.startDate) {
        surveyPayload.startDate = surveyData.specifications.startDate;
      }
      if (surveyData.specifications.endDate) {
        surveyPayload.deadline = surveyData.specifications.endDate;
      }
      if (surveyData.specifications.sampleSize) {
        surveyPayload.sampleSize = parseInt(surveyData.specifications.sampleSize);
      }
      if (surveyData.specifications.targetAudience) {
        surveyPayload.targetAudience = surveyData.specifications.targetAudience;
      }
      // Create or update survey as draft
      let response;
      if (editingSurvey) {
        response = await surveyAPI.updateSurvey(editingSurvey._id || editingSurvey.id, surveyPayload);
      } else {
        response = await surveyAPI.createSurvey(surveyPayload);
      }
      
      if (response && response.success) {
        const savedSurveyId = response.data?.survey?._id || response.data?.survey?.id || editingSurvey?._id || editingSurvey?.id;
        
        // Save respondent contacts modifications if any
        if (respondentContactsModifications && savedSurveyId && 
            (respondentContactsModifications.added.length > 0 || respondentContactsModifications.deleted.length > 0)) {
          try {
            await surveyAPI.saveRespondentContacts(savedSurveyId, {
              added: respondentContactsModifications.added,
              deleted: respondentContactsModifications.deleted
            });
            setRespondentContactsModifications(null);
          } catch (contactsError) {
            console.error('Error saving respondent contacts modifications:', contactsError);
            // Don't fail the entire save, just log the error
          }
        }
        
        // Reset contactsModified flag after successful save
        setContactsModified(false);
        // Check if this is a multi-mode survey
        const isMultiMode = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
        
        if (isMultiMode) {
          // Handle multi-mode interviewer assignments
          try {
            // Prepare CAPI assignments - only if CAPI step's assignACs is enabled
            const capiACAssignments = {};
            const capiStateAssignments = {};
            const capiCountryAssignments = {};
            
            if (surveyData.capiInterviewers && surveyData.capiInterviewers.length > 0 && surveyData.capiACSettings?.assignACs) {
              surveyData.capiInterviewers.forEach(interviewer => {
                if (interviewer.assignedACs && interviewer.assignedACs.length > 0) {
                  capiACAssignments[interviewer.id] = interviewer.assignedACs;
                }
                if (interviewer.selectedState) {
                  capiStateAssignments[interviewer.id] = interviewer.selectedState;
                }
                if (interviewer.selectedCountry) {
                  capiCountryAssignments[interviewer.id] = interviewer.selectedCountry;
                }
              });
            }
            
            // Prepare CATI assignments - only if CATI step's assignACs is enabled
            const catiACAssignments = {};
            const catiStateAssignments = {};
            const catiCountryAssignments = {};
            
            if (surveyData.catiInterviewers && surveyData.catiInterviewers.length > 0 && surveyData.catiACSettings?.assignACs) {
              surveyData.catiInterviewers.forEach(interviewer => {
                if (interviewer.assignedACs && interviewer.assignedACs.length > 0) {
                  catiACAssignments[interviewer.id] = interviewer.assignedACs;
                }
                if (interviewer.selectedState) {
                  catiStateAssignments[interviewer.id] = interviewer.selectedState;
                }
                if (interviewer.selectedCountry) {
                  catiCountryAssignments[interviewer.id] = interviewer.selectedCountry;
                }
              });
            }

            const capiInterviewerIds = surveyData.capiInterviewers ? surveyData.capiInterviewers.map(interviewer => interviewer.id) : [];
            const catiInterviewerIds = surveyData.catiInterviewers ? surveyData.catiInterviewers.map(interviewer => interviewer.id) : [];
            
            // Only assign interviewers if there are any to assign
            if (capiInterviewerIds.length > 0 || catiInterviewerIds.length > 0) {
              await surveyAPI.assignInterviewers(response.data.survey._id, {
                capiInterviewerIds: capiInterviewerIds,
                catiInterviewerIds: catiInterviewerIds,
                maxInterviews: surveyData.specifications.maxInterviewsPerInterviewer || 0,
                capiACAssignments: Object.keys(capiACAssignments).length > 0 ? capiACAssignments : undefined,
                capiStateAssignments: Object.keys(capiStateAssignments).length > 0 ? capiStateAssignments : undefined,
                capiCountryAssignments: Object.keys(capiCountryAssignments).length > 0 ? capiCountryAssignments : undefined,
                catiACAssignments: Object.keys(catiACAssignments).length > 0 ? catiACAssignments : undefined,
                catiStateAssignments: Object.keys(catiStateAssignments).length > 0 ? catiStateAssignments : undefined,
                catiCountryAssignments: Object.keys(catiCountryAssignments).length > 0 ? catiCountryAssignments : undefined
              });
            }
          } catch (assignError) {
            console.warn('Failed to assign multi-mode interviewers:', assignError);
            // Don't fail the entire operation if interviewer assignment fails
          }
        } else {
          // Handle single-mode interviewer assignments (original logic)
          if (surveyData.interviewers && surveyData.interviewers.length > 0) {
            try {
              // Prepare AC assignments data - only if interviewer step's assignACs is enabled
              const interviewerACAssignments = {};
              const interviewerStateAssignments = {};
              const interviewerCountryAssignments = {};
              const interviewerModeAssignments = {};
              
              surveyData.interviewers.forEach(interviewer => {
                // Only include AC assignments if this step's assignACs is enabled
                if (surveyData.interviewerACSettings?.assignACs && interviewer.assignedACs && interviewer.assignedACs.length > 0) {
                  interviewerACAssignments[interviewer.id] = interviewer.assignedACs;
                }
                if (interviewer.selectedState) {
                  interviewerStateAssignments[interviewer.id] = interviewer.selectedState;
                }
                if (interviewer.selectedCountry) {
                  interviewerCountryAssignments[interviewer.id] = interviewer.selectedCountry;
                }
                if (interviewer.assignedMode) {
                  interviewerModeAssignments[interviewer.id] = interviewer.assignedMode;
                }
              });

              await surveyAPI.assignInterviewers(response.data.survey._id, {
                interviewerIds: surveyData.interviewers.map(interviewer => interviewer.id),
                maxInterviews: surveyData.specifications.maxInterviewsPerInterviewer || 0,
                interviewerACAssignments: Object.keys(interviewerACAssignments).length > 0 ? interviewerACAssignments : undefined,
                interviewerStateAssignments: Object.keys(interviewerStateAssignments).length > 0 ? interviewerStateAssignments : undefined,
                interviewerCountryAssignments: Object.keys(interviewerCountryAssignments).length > 0 ? interviewerCountryAssignments : undefined,
                interviewerModeAssignments: Object.keys(interviewerModeAssignments).length > 0 ? interviewerModeAssignments : undefined
              });
            } catch (assignError) {
              console.warn('Failed to assign interviewers:', assignError);
              // Don't fail the entire operation if interviewer assignment fails
            }
          }
        }

        // Show success message
        showSuccess(
          editingSurvey ? 'Survey Saved as Draft!' : 'Survey Created as Draft!',
          editingSurvey ? 'Your survey has been saved as draft.' : 'Your survey has been created as draft.',
          4000
        );
        
        // Close the builder
        if (onClose) {
          onClose();
        }
      } else {
        throw new Error(response?.message || 'Failed to save survey as draft');
      }
    } catch (error) {
      console.error('Error saving survey as draft:', error);
      setError(error.message);
      showError(
        'Save Draft Failed',
        error.message || 'Failed to save survey as draft. Please try again.',
        6000
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSurvey = async () => {
    setLoading(true);
    setError(null);

    // Debug: Check if user is logged in
    const token = localStorage.getItem('token');

    try {
      
      // Validate required data
      if (!surveyData.mode) {
        throw new Error('Survey mode is required');
      }
      if (!surveyData.specifications.surveyName) {
        throw new Error('Survey name is required');
      }
      if (!surveyData.specifications.description) {
        throw new Error('Survey description is required');
      }
      if (!surveyData.specifications.startDate) {
        throw new Error('Start date is required');
      }
      if (!surveyData.specifications.endDate) {
        throw new Error('End date is required');
      }
      if (!surveyData.specifications.sampleSize) {
        throw new Error('Sample size is required');
      }
      if (!surveyData.specifications.purpose) {
        throw new Error('Purpose is required');
      }

  // Helper function to generate unique IDs
  const generateId = () => Math.random().toString(36).substr(2, 9);
      
      // Helper function to add IDs to sections and questions
      const addIdsToSections = (sections) => {
        return sections.map(section => ({
          ...section,
          id: section.id || generateId(),
          questions: section.questions?.map(question => {
            // Preserve all question fields including settings
            const questionWithIds = {
              ...question,
              id: question.id || generateId(),
              options: question.options?.map(option => ({
                ...option,
                id: option.id || generateId()
              })) || []
            };
            
            
            return questionWithIds;
          }) || []
        }));
      };
      
      // Helper function to add IDs to questions
      const addIdsToQuestions = (questions) => {
        return questions.map(question => ({
          ...question,
          id: question.id || generateId(),
          options: question.options?.map((option, idx) => ({
            ...option,
            id: option.id || generateId(),
            code: option.code || String(idx + 1) // Preserve code or default to index + 1
          })) || []
        }));
      };

      // Prepare survey data for API
      // Normalize conditional rules: keep valid rules; for operators that don't need value, set sentinel value
      const normalizeSections = (sections) => {
        const normalizeQuestion = (q) => {
          if (!q) return q;
          
          // Normalize conditions if they exist
          let normalizedQuestion = { ...q };
          if (q.conditions && q.conditions.length > 0) {
            const cleanedConditions = q.conditions
              .filter(c => c && c.questionId && c.operator)
              .map(c => {
                if (c.operator === 'is_empty' || c.operator === 'is_not_empty') {
                  return { ...c, value: c.value !== undefined && c.value !== null && c.value !== '' ? c.value : '__NOVALUE__' };
                }
                return { ...c, value: (c.value ?? '').toString() };
              });
            normalizedQuestion.conditions = cleanedConditions;
          }
          
          // Ensure all required fields are present
          // Preserve settings object and ensure it's properly structured
          const preservedSettings = normalizedQuestion.settings && typeof normalizedQuestion.settings === 'object' 
            ? { ...normalizedQuestion.settings } 
            : {};
          
          
          // Preserve options with codes
          const preservedOptions = normalizedQuestion.options?.map((opt, idx) => {
            if (typeof opt === 'string') {
              return {
                id: generateId(),
                text: opt,
                value: opt.toLowerCase().replace(/\s+/g, '_'),
                code: String(idx + 1) // Default code
              };
            }
            return {
              id: opt.id || generateId(),
              text: opt.text || opt.value || '',
              value: opt.value || opt.text?.toLowerCase().replace(/\s+/g, '_') || '',
              code: opt.code || String(idx + 1) // Preserve code or default to index + 1
            };
          }) || [];
          
          return {
            ...normalizedQuestion,
            id: normalizedQuestion.id || generateId(),
            type: normalizedQuestion.type || 'text',
            text: normalizedQuestion.text || 'New Question',
            description: normalizedQuestion.description || '',
            required: normalizedQuestion.required !== undefined ? normalizedQuestion.required : true,
            order: normalizedQuestion.order || 0,
            options: preservedOptions,
            settings: preservedSettings,
            isFixed: normalizedQuestion.isFixed || false,
            isLocked: normalizedQuestion.isLocked || false
          };
        };
        
        return (sections || []).map(section => ({
          ...section,
          id: section.id || generateId(),
          title: section.title || 'New Section',
          description: section.description || '',
          order: section.order || 0,
          questions: (section.questions || []).map(normalizeQuestion)
        }));
      };

      const surveyPayload = {
        surveyName: surveyData.specifications.surveyName,
        description: surveyData.specifications.description,
        category: surveyData.specifications.category,
        purpose: surveyData.specifications.purpose,
        mode: surveyData.mode,
        modes: surveyData.modes || [],
        modeAllocation: surveyData.modeAllocation || {},
        modeQuotas: {
          capi: null, // No quota limits - unlimited
          cati: null  // No quota limits - unlimited
        },
        modeGigWorkers: surveyData.modeGigWorkers || {},
        includeGigWorkers: surveyData.includeGigWorkers,
        startDate: surveyData.specifications.startDate,
        deadline: surveyData.specifications.endDate,
        sampleSize: parseInt(surveyData.specifications.sampleSize),
        targetAudience: surveyData.specifications.targetAudience || {
          demographics: {},
          geographic: {},
          behavioral: {},
          psychographic: {},
          custom: '',
          quotaManagement: false
        },
        thresholdInterviewsPerDay: surveyData.specifications.thresholdInterviewsPerDay ? parseInt(surveyData.specifications.thresholdInterviewsPerDay) : undefined,
        maxInterviewsPerInterviewer: surveyData.specifications.maxInterviewsPerInterviewer ? parseInt(surveyData.specifications.maxInterviewsPerInterviewer) : undefined,
        onlineContactMode: surveyData.specifications.onlineContactMode || [],
        contactList: surveyData.specifications.contactList || [],
        sections: addIdsToSections(normalizeSections(surveyData.questions || [])),
        questions: addIdsToQuestions((normalizeSections(surveyData.questions || [])).flatMap(sec => (sec.questions ? sec.questions : []))),
        templateUsed: surveyData.template || {},
        settings: {
          allowAnonymous: false,
          requireAuthentication: true,
          allowMultipleResponses: false,
          showProgress: true,
          randomizeQuestions: false,
          randomizeOptions: false
        },
        notifications: {
          emailReminders: true,
          smsReminders: false,
          whatsappReminders: false,
          reminderFrequency: 'weekly'
        },
        status: 'active', // Set status to active when publishing
        // AC Assignment settings - set to true if ANY step has assignACs enabled (for backward compatibility)
        assignACs: (surveyData.interviewerACSettings?.assignACs || 
                    surveyData.capiACSettings?.assignACs || 
                    surveyData.catiACSettings?.assignACs || 
                    surveyData.qualityAgentACSettings?.assignACs) || false,
        // Use the first available country/state from any step (for backward compatibility)
        acAssignmentCountry: surveyData.interviewerACSettings?.selectedCountry || 
                             surveyData.capiACSettings?.selectedCountry || 
                             surveyData.catiACSettings?.selectedCountry || 
                             surveyData.qualityAgentACSettings?.selectedCountry || '',
        acAssignmentState: surveyData.interviewerACSettings?.selectedState || 
                           surveyData.capiACSettings?.selectedState || 
                           surveyData.catiACSettings?.selectedState || 
                           surveyData.qualityAgentACSettings?.selectedState || '',
        sets: surveyData.sets || []
      };
      
      // Only include respondentContacts if they have been modified
      if (contactsModified) {
        surveyPayload.respondentContacts = surveyData.respondentContacts || [];
      }

      // Create or update survey
      
      let response;
      if (editingSurvey) {
        response = await surveyAPI.updateSurvey(editingSurvey._id || editingSurvey.id, surveyPayload);
      } else {
        response = await surveyAPI.createSurvey(surveyPayload);
      }
      
      if (response && response.success) {
        const savedSurveyId = response.data?.survey?._id || response.data?.survey?.id || editingSurvey?._id || editingSurvey?.id;
        
        // Save respondent contacts modifications if any
        if (respondentContactsModifications && savedSurveyId && 
            (respondentContactsModifications.added.length > 0 || respondentContactsModifications.deleted.length > 0)) {
          try {
            await surveyAPI.saveRespondentContacts(savedSurveyId, {
              added: respondentContactsModifications.added,
              deleted: respondentContactsModifications.deleted
            });
            setRespondentContactsModifications(null);
          } catch (contactsError) {
            console.error('Error saving respondent contacts modifications:', contactsError);
            // Don't fail the entire save, just log the error
          }
        }
        
        // Check if this is a multi-mode survey
        const isMultiMode = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
        
        if (isMultiMode) {
          // Handle multi-mode interviewer assignments
          try {
            // Prepare CAPI assignments - only if CAPI step's assignACs is enabled
            const capiACAssignments = {};
            const capiStateAssignments = {};
            const capiCountryAssignments = {};
            
            if (surveyData.capiInterviewers && surveyData.capiInterviewers.length > 0 && surveyData.capiACSettings?.assignACs) {
              surveyData.capiInterviewers.forEach(interviewer => {
                if (interviewer.assignedACs && interviewer.assignedACs.length > 0) {
                  capiACAssignments[interviewer.id] = interviewer.assignedACs;
                }
                if (interviewer.selectedState) {
                  capiStateAssignments[interviewer.id] = interviewer.selectedState;
                }
                if (interviewer.selectedCountry) {
                  capiCountryAssignments[interviewer.id] = interviewer.selectedCountry;
                }
              });
            }
            
            // Prepare CATI assignments - only if CATI step's assignACs is enabled
            const catiACAssignments = {};
            const catiStateAssignments = {};
            const catiCountryAssignments = {};
            
            if (surveyData.catiInterviewers && surveyData.catiInterviewers.length > 0 && surveyData.catiACSettings?.assignACs) {
              surveyData.catiInterviewers.forEach(interviewer => {
                if (interviewer.assignedACs && interviewer.assignedACs.length > 0) {
                  catiACAssignments[interviewer.id] = interviewer.assignedACs;
                }
                if (interviewer.selectedState) {
                  catiStateAssignments[interviewer.id] = interviewer.selectedState;
                }
                if (interviewer.selectedCountry) {
                  catiCountryAssignments[interviewer.id] = interviewer.selectedCountry;
                }
              });
            }

            const capiInterviewerIds = surveyData.capiInterviewers ? surveyData.capiInterviewers.map(interviewer => interviewer.id) : [];
            const catiInterviewerIds = surveyData.catiInterviewers ? surveyData.catiInterviewers.map(interviewer => interviewer.id) : [];
            
            // Only assign interviewers if there are any to assign
            if (capiInterviewerIds.length > 0 || catiInterviewerIds.length > 0) {
              await surveyAPI.assignInterviewers(response.data.survey._id, {
                capiInterviewerIds: capiInterviewerIds,
                catiInterviewerIds: catiInterviewerIds,
                maxInterviews: surveyData.specifications.maxInterviewsPerInterviewer || 0,
                capiACAssignments: Object.keys(capiACAssignments).length > 0 ? capiACAssignments : undefined,
                capiStateAssignments: Object.keys(capiStateAssignments).length > 0 ? capiStateAssignments : undefined,
                capiCountryAssignments: Object.keys(capiCountryAssignments).length > 0 ? capiCountryAssignments : undefined,
                catiACAssignments: Object.keys(catiACAssignments).length > 0 ? catiACAssignments : undefined,
                catiStateAssignments: Object.keys(catiStateAssignments).length > 0 ? catiStateAssignments : undefined,
                catiCountryAssignments: Object.keys(catiCountryAssignments).length > 0 ? catiCountryAssignments : undefined
              });
            }
          } catch (assignError) {
            console.warn('Failed to assign multi-mode interviewers:', assignError);
            // Don't fail the entire operation if interviewer assignment fails
          }
        } else {
          // Handle single-mode interviewer assignments (original logic)
          if (surveyData.interviewers && surveyData.interviewers.length > 0) {
            try {
              // Prepare AC assignments data - only if interviewer step's assignACs is enabled
              const interviewerACAssignments = {};
              const interviewerStateAssignments = {};
              const interviewerCountryAssignments = {};
              const interviewerModeAssignments = {};
              
              surveyData.interviewers.forEach(interviewer => {
                // Only include AC assignments if this step's assignACs is enabled
                if (surveyData.interviewerACSettings?.assignACs && interviewer.assignedACs && interviewer.assignedACs.length > 0) {
                  interviewerACAssignments[interviewer.id] = interviewer.assignedACs;
                }
                if (interviewer.selectedState) {
                  interviewerStateAssignments[interviewer.id] = interviewer.selectedState;
                }
                if (interviewer.selectedCountry) {
                  interviewerCountryAssignments[interviewer.id] = interviewer.selectedCountry;
                }
                if (interviewer.assignedMode) {
                  interviewerModeAssignments[interviewer.id] = interviewer.assignedMode;
                }
              });

              await surveyAPI.assignInterviewers(response.data.survey._id, {
                interviewerIds: surveyData.interviewers.map(interviewer => interviewer.id),
                maxInterviews: surveyData.specifications.maxInterviewsPerInterviewer || 0,
                interviewerACAssignments: Object.keys(interviewerACAssignments).length > 0 ? interviewerACAssignments : undefined,
                interviewerStateAssignments: Object.keys(interviewerStateAssignments).length > 0 ? interviewerStateAssignments : undefined,
                interviewerCountryAssignments: Object.keys(interviewerCountryAssignments).length > 0 ? interviewerCountryAssignments : undefined,
                interviewerModeAssignments: Object.keys(interviewerModeAssignments).length > 0 ? interviewerModeAssignments : undefined
              });
            } catch (assignError) {
              console.warn('Failed to assign interviewers:', assignError);
              // Don't fail the entire operation if interviewer assignment fails
            }
          }
        }

        // Assign quality agents if any are selected
        if (surveyData.qualityAgents && surveyData.qualityAgents.length > 0) {
          try {
            // Prepare quality agent AC assignments data - only if quality agent step's assignACs is enabled
            const qualityAgentACAssignments = {};
            const qualityAgentStateAssignments = {};
            const qualityAgentCountryAssignments = {};
            
            if (surveyData.qualityAgentACSettings?.assignACs) {
              surveyData.qualityAgents.forEach(agent => {
                if (agent.assignedACs && agent.assignedACs.length > 0) {
                  qualityAgentACAssignments[agent.id] = agent.assignedACs;
                }
                if (agent.selectedState) {
                  qualityAgentStateAssignments[agent.id] = agent.selectedState;
                }
                if (agent.selectedCountry) {
                  qualityAgentCountryAssignments[agent.id] = agent.selectedCountry;
                }
              });
            } else {
              // If assignACs is disabled, still include state/country assignments but not ACs
              surveyData.qualityAgents.forEach(agent => {
                if (agent.selectedState) {
                  qualityAgentStateAssignments[agent.id] = agent.selectedState;
                }
                if (agent.selectedCountry) {
                  qualityAgentCountryAssignments[agent.id] = agent.selectedCountry;
                }
              });
            }

            await surveyAPI.assignQualityAgents(response.data.survey._id, {
              qualityAgentIds: surveyData.qualityAgents.map(agent => agent.id),
              qualityAgentACAssignments: Object.keys(qualityAgentACAssignments).length > 0 ? qualityAgentACAssignments : undefined,
              qualityAgentStateAssignments: Object.keys(qualityAgentStateAssignments).length > 0 ? qualityAgentStateAssignments : undefined,
              qualityAgentCountryAssignments: Object.keys(qualityAgentCountryAssignments).length > 0 ? qualityAgentCountryAssignments : undefined
            });
          } catch (assignError) {
            console.warn('Failed to assign quality agents:', assignError);
            // Don't fail the entire operation if quality agent assignment fails
          }
        }

        // Show success message
        showSuccess(
          editingSurvey ? 'Survey Updated!' : 'Survey Created!',
          editingSurvey ? 'Your survey has been updated successfully.' : 'Your survey has been created successfully.',
          4000
        );
        
        // Close the builder
        onClose();
      } else {
        throw new Error(response.message || 'Failed to create survey');
      }
    } catch (err) {
      console.error('Error creating survey:', err);
      console.error('Error details:', err.response?.data || err.message);
      console.error('Full error object:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create survey. Please try again.';
      setError(errorMessage);
      showError(
        'Survey Creation Failed',
        errorMessage,
        6000
      );
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentStep = () => {
    // In edit mode, step 4 is the question builder (skip template step)
    if (editingSurvey) {
      switch (currentStep) {
        case 1:
          return (
            <SurveyModeSelection 
              onUpdate={(data) => updateSurveyData('mode', data)}
              initialData={{
                mode: surveyData.mode,
                modes: surveyData.modes,
                modeAllocation: surveyData.modeAllocation,
                modeGigWorkers: surveyData.modeGigWorkers,
                includeGigWorkers: surveyData.includeGigWorkers
              }}
            />
          );
        case 2:
          return (
            <SurveySpecifications 
              onUpdate={(data) => updateSurveyData('specifications', data)}
              initialData={surveyData.specifications}
              mode={surveyData.mode}
            />
          );
        case 3:
          const isMultiModeEdit = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
          const selectedModesEdit = surveyData.modes || [];
          const isOnlyCAPIEdit = (surveyData.mode === 'capi') || (selectedModesEdit.length === 1 && selectedModesEdit.includes('capi'));
          const isOnlyCATIEdit = (surveyData.mode === 'cati') || (selectedModesEdit.length === 1 && selectedModesEdit.includes('cati'));
          
          if (isMultiModeEdit) {
            // Multi-mode: CAPI step
            return (
              <InterviewerSelection 
                onUpdate={(data) => updateSurveyData('capiInterviewers', data)}
                onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'capi')}
                initialData={surveyData.capiInterviewers}
                mode="capi"
                modes={surveyData.modes}
                modeAllocation={surveyData.modeAllocation}
                geographicTargeting={surveyData.specifications.targetAudience?.geographic}
                acSettings={surveyData.capiACSettings}
              />
            );
          } else if (isOnlyCAPIEdit) {
            // Single CAPI mode
            return (
              <InterviewerSelection 
                onUpdate={(data) => updateSurveyData('interviewers', data)}
                onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'interviewer')}
                initialData={surveyData.interviewers}
                mode="capi"
                modes={surveyData.modes}
                modeAllocation={surveyData.modeAllocation}
                geographicTargeting={surveyData.specifications.targetAudience?.geographic}
                acSettings={surveyData.interviewerACSettings}
              />
            );
          } else if (isOnlyCATIEdit) {
            // Single CATI mode
            return (
              <InterviewerSelection 
                onUpdate={(data) => updateSurveyData('interviewers', data)}
                onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'interviewer')}
                initialData={surveyData.interviewers}
                mode="cati"
                modes={surveyData.modes}
                modeAllocation={surveyData.modeAllocation}
                geographicTargeting={surveyData.specifications.targetAudience?.geographic}
                acSettings={surveyData.interviewerACSettings}
              />
            );
          } else {
            // Other modes (online, ai_telephonic, etc.)
            return (
              <InterviewerSelection 
                onUpdate={(data) => updateSurveyData('interviewers', data)}
                onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'interviewer')}
                initialData={surveyData.interviewers}
                mode={surveyData.mode}
                modes={surveyData.modes}
                modeAllocation={surveyData.modeAllocation}
                geographicTargeting={surveyData.specifications.targetAudience?.geographic}
                acSettings={surveyData.interviewerACSettings}
              />
            );
          }
        case 4:
          const isMultiModeEditStep4 = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
          
          if (isMultiModeEditStep4) {
            // Multi-mode: CATI step
            return (
              <InterviewerSelection 
                onUpdate={(data) => updateSurveyData('catiInterviewers', data)}
                onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'cati')}
                initialData={surveyData.catiInterviewers}
                mode="cati"
                modes={surveyData.modes}
                modeAllocation={surveyData.modeAllocation}
                geographicTargeting={surveyData.specifications.targetAudience?.geographic}
                acSettings={surveyData.catiACSettings}
              />
            );
          } else {
            // Single mode: Quality Agent Selection step
            return (
              <QualityAgentSelection 
                onUpdate={(data) => updateSurveyData('qualityAgents', data)}
                onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'qualityAgent')}
                initialData={surveyData.qualityAgents}
                mode={surveyData.mode}
                geographicTargeting={surveyData.specifications.targetAudience?.geographic}
                acSettings={surveyData.qualityAgentACSettings}
              />
            );
          }
        case 5: {
          const isMultiModeEditStep5 = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
          const selectedModesEdit = surveyData.modes || [];
          const isOnlyCATIEdit = (surveyData.mode === 'cati') || (selectedModesEdit.length === 1 && selectedModesEdit.includes('cati'));
          const hasCATIEdit = isOnlyCATIEdit || isMultiModeEditStep5 || (selectedModesEdit.includes('cati'));
          
          if (isMultiModeEditStep5) {
            // Multi-mode: Quality Agent Selection step
            return (
              <QualityAgentSelection 
                onUpdate={(data) => updateSurveyData('qualityAgents', data)}
                onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'qualityAgent')}
                initialData={surveyData.qualityAgents}
                mode={surveyData.mode}
                geographicTargeting={surveyData.specifications.targetAudience?.geographic}
                acSettings={surveyData.qualityAgentACSettings}
              />
            );
          } else if (hasCATIEdit) {
            // Single CATI mode: Upload Respondents step
            return (
              <RespondentUpload 
                onUpdate={(data) => {
                  // Handle modifications from new implementation
                  if (data.hasModifications !== undefined) {
                    setRespondentContactsModifications(data.modifications);
                    setContactsModified(data.hasModifications);
                  } else {
                    // Fallback for old implementation
                    updateSurveyData('respondentContacts', data);
                  }
                }}
                initialData={surveyData.respondentContacts}
                surveyId={editingSurvey?._id || editingSurvey?.id}
              />
            );
          } else {
            // Single mode: Build Survey step
            return (
              <SurveyQuestionBuilder 
                onUpdate={(data) => updateSurveyData('questions', data)}
                initialData={surveyData.questions}
                surveyData={surveyData}
              />
            );
          }
        }
        case 6: {
          const isMultiModeEditStep6 = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
          const selectedModesEditStep6 = surveyData.modes || [];
          const isOnlyCATIEditStep6 = (surveyData.mode === 'cati') || (selectedModesEditStep6.length === 1 && selectedModesEditStep6.includes('cati'));
          const hasCATIEditStep6 = isOnlyCATIEditStep6 || isMultiModeEditStep6 || (selectedModesEditStep6.includes('cati'));
          
          if (isMultiModeEditStep6 && hasCATIEditStep6) {
            // Multi-mode with CATI: Upload Respondents step
            return (
              <RespondentUpload 
                onUpdate={(data) => {
                  // Handle modifications from new implementation
                  if (data.hasModifications !== undefined) {
                    setRespondentContactsModifications(data.modifications);
                    setContactsModified(data.hasModifications);
                  } else {
                    // Fallback for old implementation
                    updateSurveyData('respondentContacts', data);
                  }
                }}
                initialData={surveyData.respondentContacts}
                surveyId={editingSurvey?._id || editingSurvey?.id}
              />
            );
          } else {
            // Multi-mode: Build Survey step (for edit mode)
            return (
              <SurveyQuestionBuilder 
                onUpdate={(data) => updateSurveyData('questions', data)}
                initialData={surveyData.questions}
                surveyData={surveyData}
              />
            );
          }
        }
        case 7:
          // Multi-mode: Build Survey step (for edit mode)
          return (
            <SurveyQuestionBuilder 
              onUpdate={(data) => updateSurveyData('questions', data)}
              initialData={surveyData.questions}
              surveyData={{ ...surveyData, _id: editingSurvey?._id || surveyData._id }}
            />
          );
        default:
          return null;
      }
    }
    
    // Normal flow for new surveys
    switch (currentStep) {
      case 1:
        return (
          <SurveyModeSelection 
            onUpdate={(data) => updateSurveyData('mode', data)}
            initialData={{
              mode: surveyData.mode,
              modes: surveyData.modes,
              modeAllocation: surveyData.modeAllocation,
              modeGigWorkers: surveyData.modeGigWorkers,
              includeGigWorkers: surveyData.includeGigWorkers
            }}
          />
        );
      case 2:
        return (
          <SurveySpecifications 
            onUpdate={(data) => updateSurveyData('specifications', data)}
            initialData={surveyData.specifications}
            mode={surveyData.mode}
          />
        );
      case 3:
        const isMultiMode = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
        const selectedModes = surveyData.modes || [];
        const isOnlyCAPI = (surveyData.mode === 'capi') || (selectedModes.length === 1 && selectedModes.includes('capi'));
        const isOnlyCATI = (surveyData.mode === 'cati') || (selectedModes.length === 1 && selectedModes.includes('cati'));
        
        if (isMultiMode) {
          // Multi-mode: CAPI step
          return (
            <InterviewerSelection 
              onUpdate={(data) => updateSurveyData('capiInterviewers', data)}
              onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'capi')}
              initialData={surveyData.capiInterviewers}
              mode="capi"
              modes={surveyData.modes}
              modeAllocation={surveyData.modeAllocation}
              geographicTargeting={surveyData.specifications.targetAudience?.geographic}
              acSettings={surveyData.capiACSettings}
            />
          );
        } else if (isOnlyCAPI) {
          // Single CAPI mode
          return (
            <InterviewerSelection 
              onUpdate={(data) => updateSurveyData('interviewers', data)}
              onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'interviewer')}
              initialData={surveyData.interviewers}
              mode="capi"
              modes={surveyData.modes}
              modeAllocation={surveyData.modeAllocation}
              geographicTargeting={surveyData.specifications.targetAudience?.geographic}
              acSettings={surveyData.interviewerACSettings}
            />
          );
        } else if (isOnlyCATI) {
          // Single CATI mode
          return (
            <InterviewerSelection 
              onUpdate={(data) => updateSurveyData('interviewers', data)}
              onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'interviewer')}
              initialData={surveyData.interviewers}
              mode="cati"
              modes={surveyData.modes}
              modeAllocation={surveyData.modeAllocation}
              geographicTargeting={surveyData.specifications.targetAudience?.geographic}
              acSettings={surveyData.interviewerACSettings}
            />
          );
        } else {
          // Other modes (online, ai_telephonic, etc.)
          return (
            <InterviewerSelection 
              onUpdate={(data) => updateSurveyData('interviewers', data)}
              onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'interviewer')}
              initialData={surveyData.interviewers}
              mode={surveyData.mode}
              modes={surveyData.modes}
              modeAllocation={surveyData.modeAllocation}
              geographicTargeting={surveyData.specifications.targetAudience?.geographic}
              acSettings={surveyData.interviewerACSettings}
            />
          );
        }
      case 4:
        const isMultiModeStep4 = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
        
        if (isMultiModeStep4) {
          // Multi-mode: CATI step
          return (
            <InterviewerSelection 
              onUpdate={(data) => updateSurveyData('catiInterviewers', data)}
              onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'cati')}
              initialData={surveyData.catiInterviewers}
              mode="cati"
              modes={surveyData.modes}
              modeAllocation={surveyData.modeAllocation}
              geographicTargeting={surveyData.specifications.targetAudience?.geographic}
              acSettings={surveyData.catiACSettings}
            />
          );
        } else {
          // Single mode: Quality Agent Selection step
          return (
            <QualityAgentSelection 
              onUpdate={(data) => updateSurveyData('qualityAgents', data)}
              onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'qualityAgent')}
              initialData={surveyData.qualityAgents}
              mode={surveyData.mode}
              geographicTargeting={surveyData.specifications.targetAudience?.geographic}
              acSettings={surveyData.qualityAgentACSettings}
            />
          );
        }
      case 5: {
        const selectedModesStep5 = surveyData.modes || [];
        const isOnlyCATIStep5 = (surveyData.mode === 'cati') || (selectedModesStep5.length === 1 && selectedModesStep5.includes('cati'));
        const isMultiModeStep5 = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
        const hasCATIStep5 = isOnlyCATIStep5 || isMultiModeStep5 || (selectedModesStep5.includes('cati'));
        
        if (isMultiModeStep5) {
          // Multi-mode: Quality Agent Selection step
          return (
            <QualityAgentSelection 
              onUpdate={(data) => updateSurveyData('qualityAgents', data)}
              onACSettingsUpdate={(data) => handleACSettingsUpdate(data, 'qualityAgent')}
              initialData={surveyData.qualityAgents}
              mode={surveyData.mode}
              geographicTargeting={surveyData.specifications.targetAudience?.geographic}
              acSettings={surveyData.qualityAgentACSettings}
            />
          );
        } else if (hasCATIStep5) {
          // Single CATI mode: Upload Respondents step
          return (
            <RespondentUpload 
              onUpdate={(data) => updateSurveyData('respondentContacts', data)}
              initialData={surveyData.respondentContacts}
            />
          );
        } else {
          // Single mode (non-CATI): Templates step
          return (
            <SurveyTemplateSuggestions 
              onUpdate={(data) => updateSurveyData('template', data)}
              initialData={surveyData.template}
              specifications={surveyData.specifications}
            />
          );
        }
      }
      case 6: {
        const selectedModesStep6 = surveyData.modes || [];
        const isOnlyCATIStep6 = (surveyData.mode === 'cati') || (selectedModesStep6.length === 1 && selectedModesStep6.includes('cati'));
        const isMultiModeStep6 = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
        const hasCATIStep6 = isOnlyCATIStep6 || isMultiModeStep6 || (selectedModesStep6.includes('cati'));
        
        if (isMultiModeStep6) {
          // Multi-mode: Upload Respondents step (if CATI) or Templates step
          if (hasCATIStep6) {
            return (
              <RespondentUpload 
                onUpdate={(data) => {
                  // Handle modifications from new implementation
                  if (data.hasModifications !== undefined) {
                    setRespondentContactsModifications(data.modifications);
                    setContactsModified(data.hasModifications);
                  } else {
                    // Fallback for old implementation
                    updateSurveyData('respondentContacts', data);
                  }
                }}
                initialData={surveyData.respondentContacts}
                surveyId={editingSurvey?._id || editingSurvey?.id}
              />
            );
          } else {
            return (
              <SurveyTemplateSuggestions 
                onUpdate={(data) => updateSurveyData('template', data)}
                initialData={surveyData.template}
                specifications={surveyData.specifications}
              />
            );
          }
        } else if (hasCATIStep6) {
          // Single CATI mode: Templates step
          return (
            <SurveyTemplateSuggestions 
              onUpdate={(data) => updateSurveyData('template', data)}
              initialData={surveyData.template}
              specifications={surveyData.specifications}
            />
          );
        } else {
          // Single mode (non-CATI): Build Survey step
          return (
            <SurveyQuestionBuilder 
              onUpdate={(data) => updateSurveyData('questions', data)}
              initialData={surveyData.questions}
              surveyData={{ ...surveyData, _id: editingSurvey?._id || surveyData._id }}
            />
          );
        }
      }
      case 7: {
        const selectedModesStep7 = surveyData.modes || [];
        const isOnlyCATIStep7 = (surveyData.mode === 'cati') || (selectedModesStep7.length === 1 && selectedModesStep7.includes('cati'));
        const isMultiModeStep7 = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
        const hasCATIStep7 = isOnlyCATIStep7 || isMultiModeStep7 || (selectedModesStep7.includes('cati'));
        
        if (isMultiModeStep7 && hasCATIStep7) {
          // Multi-mode with CATI: Templates step
          return (
            <SurveyTemplateSuggestions 
              onUpdate={(data) => updateSurveyData('template', data)}
              initialData={surveyData.template}
              specifications={surveyData.specifications}
            />
          );
        } else {
          // Multi-mode: Build Survey step
          return (
            <SurveyQuestionBuilder 
              onUpdate={(data) => updateSurveyData('questions', data)}
              initialData={surveyData.questions}
              surveyData={{ ...surveyData, _id: editingSurvey?._id || surveyData._id }}
            />
          );
        }
      }
      case 8:
        // Multi-mode: Build Survey step
        return (
          <SurveyQuestionBuilder 
            onUpdate={(data) => updateSurveyData('questions', data)}
            initialData={surveyData.questions}
            surveyData={surveyData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white">
          <div>
            <h2 className="text-2xl font-bold">{editingSurvey ? 'Edit Survey' : 'Create New Survey'}</h2>
            <p className="text-blue-100">{editingSurvey ? 'Update your survey details' : 'Build your survey step by step'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Compact Progress Steps */}
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => handleStepClick(step.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    currentStep === step.id
                      ? 'bg-[#001D48] text-white shadow-sm'
                      : currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : editingSurvey
                      ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={step.description}
                >
                  {currentStep > step.id ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">
                      {step.id}
                    </span>
                  )}
                  <span className="whitespace-nowrap">{step.title}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className="w-2 h-0.5 bg-gray-300"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {renderCurrentStep()}
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-200">
            <div className="flex items-center space-x-2 text-red-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            {currentStep === steps.length ? (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Saving Draft...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Draft</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveSurvey}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>{editingSurvey ? 'Updating & Publishing...' : 'Creating Survey...'}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{editingSurvey ? 'Update & Publish Survey' : 'Create Survey'}</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 px-4 py-2 bg-[#001D48] text-white hover:bg-blue-700 transition-colors rounded-lg"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Next</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyBuilder;
