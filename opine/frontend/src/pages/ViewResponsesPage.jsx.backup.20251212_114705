import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  ArrowLeft,
  Filter, 
  Download, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Calendar,
  User,
  MapPin,
  BarChart3,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { surveyResponseAPI, surveyAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ResponseDetailsModal from '../components/dashboard/ResponseDetailsModal';
import { getMainText } from '../utils/translations';
import assemblyConstituenciesData from '../data/assemblyConstituencies.json';

const ViewResponsesPage = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine if we're in project manager route
  const isProjectManagerRoute = location.pathname.includes('/project-manager/');
  const backPath = isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys';
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [originalResponses, setOriginalResponses] = useState([]); // Store original unfiltered responses
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResponses: 0,
    hasNext: false,
    hasPrev: false
  });
  const [filterOptions, setFilterOptions] = useState({
    gender: [],
    age: [],
    ac: [],
    city: [],
    district: [],
    lokSabha: [],
    interviewMode: []
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all', // 'all', 'approved_rejected_pending', 'approved_pending', 'pending', 'Approved', 'Rejected'
    dateRange: 'all', // 'today', 'week', 'month', 'all', 'custom'
    startDate: '',
    endDate: '',
    gender: '',
    ageMin: '',
    ageMax: '',
    ac: '',
    city: '',
    district: '',
    lokSabha: '',
    state: '',
    interviewMode: '',
    interviewerIds: [], // Array of interviewer IDs
    interviewerMode: 'include' // 'include' or 'exclude'
  });
  
  const [showFilters, setShowFilters] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const { showError, showSuccess } = useToast();

  // Table pagination state
  const [tablePagination, setTablePagination] = useState({
    currentPage: 1,
    pageSize: 10
  });

  // Load assembly constituencies data (imported directly, bundled in build)
  const [assemblyConstituencies, setAssemblyConstituencies] = useState(assemblyConstituenciesData);
  
  // Interviewer filter states
  const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('');
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);
  const interviewerDropdownRef = useRef(null);

  // AC filter states
  const [acSearchTerm, setAcSearchTerm] = useState('');
  const [showACDropdown, setShowACDropdown] = useState(false);
  const acDropdownRef = useRef(null);
  
  useEffect(() => {
    // Data is already loaded via import, no need to fetch
    setAssemblyConstituencies(assemblyConstituenciesData);
  }, []);

  // Fetch survey details and responses
  const fetchSurveyAndResponses = async () => {
    try {
      setLoading(true);
      
      // First, fetch survey details
      const surveyResponse = await surveyAPI.getSurvey(surveyId);
      if (surveyResponse.success) {
        setSurvey(surveyResponse.data);
      }
      
      // Then fetch responses - fetch all statuses (Approved, Rejected, Pending_Approval) for client-side filtering
      const params = {
        page: 1,
        limit: 1000, // Get all responses for client-side filtering
        status: 'approved_rejected_pending' // Fetch all statuses (Approved, Rejected, Pending_Approval) for comprehensive filtering
      };
      
      const response = await surveyResponseAPI.getSurveyResponses(surveyId, params);
      
      if (response.success) {
        setOriginalResponses(response.data.responses); // Store original unfiltered data
        setResponses(response.data.responses); // Set current responses
        setPagination(response.data.pagination);
        setFilterOptions(response.data.filterOptions);
      }
    } catch (error) {
      console.error('Error fetching survey and responses:', error);
      showError('Failed to load survey responses', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (surveyId) {
      fetchSurveyAndResponses();
    }
  }, [surveyId]);

  // Add CSS to ensure full width and DatePicker styling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .view-responses-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .view-responses-page * {
        max-width: none !important;
      }
      
      /* React DatePicker Custom Styling */
      .react-datepicker-wrapper {
        width: 100%;
      }
      
      .react-datepicker-popper {
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);


  // Get all ACs for the survey's target state
  const getAllACsForState = () => {
    let targetState = survey?.acAssignmentState;
    
    // If no state found, try to infer from responses
    if (!targetState && responses.length > 0) {
      const responseWithState = responses.find(r => r.state);
      if (responseWithState?.state) {
        targetState = responseWithState.state;
      }
    }
    
    // If still no state found, try to infer from AC names in responses
    if (!targetState && responses.length > 0) {
      const responseACs = responses.map(r => {
        return r.assemblyConstituency || r.assemblyConstituencyName || r.ac || r.acName || r.constituency;
      }).filter(Boolean);
      
      // Check each state to see if any of the response ACs match
      for (const [stateName, stateData] of Object.entries(assemblyConstituencies.states || {})) {
        const stateACNames = stateData.assemblyConstituencies?.map(ac => ac.acName) || [];
        const matchingACs = responseACs.filter(ac => stateACNames.includes(ac));
        
        if (matchingACs.length > 0) {
          targetState = stateName;
          break;
        }
      }
    }
    
    if (!targetState || !assemblyConstituencies.states) {
      return [];
    }
    
    const stateACs = assemblyConstituencies.states[targetState]?.assemblyConstituencies || [];
    return stateACs.map(ac => ({
      name: ac.acName,
      numericCode: ac.numericCode
    }));
  };

  // Get all AC objects for dropdown
  const allACObjects = useMemo(() => {
    return getAllACsForState();
  }, [survey, responses, assemblyConstituencies]);

  // Get all interviewer objects from responses
  const allInterviewerObjects = useMemo(() => {
    if (!responses || responses.length === 0) return [];

    const interviewerMap = new Map();

    responses.forEach(response => {
      if (response.interviewer && 
          (response.status === 'Approved' || 
           response.status === 'Rejected' || 
           response.status === 'Pending_Approval' ||
           response.status === 'abandoned')) {
        const interviewerName = `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim();
        
        if (!interviewerMap.has(response.interviewer._id)) {
          interviewerMap.set(response.interviewer._id, {
            _id: response.interviewer._id,
            name: interviewerName,
            firstName: response.interviewer.firstName,
            lastName: response.interviewer.lastName,
            email: response.interviewer.email || '',
            phone: response.interviewer.phone || '',
            memberID: response.interviewer.memberId || response.interviewer.memberID || ''
          });
        }
      }
    });
    
    return Array.from(interviewerMap.values());
  }, [responses]);

  // Filter ACs based on search term
  const filteredACs = useMemo(() => {
    if (!acSearchTerm.trim()) {
      return allACObjects;
    }

    const searchLower = acSearchTerm.toLowerCase();
    return allACObjects.filter(ac => {
      const nameMatch = ac.name?.toLowerCase().includes(searchLower);
      const codeMatch = ac.numericCode?.toString().includes(searchLower);
      return nameMatch || codeMatch;
    });
  }, [allACObjects, acSearchTerm]);

  // Filter interviewers based on search term
  const filteredInterviewers = useMemo(() => {
    if (!allInterviewerObjects || allInterviewerObjects.length === 0) return [];
    
    if (!interviewerSearchTerm.trim()) {
      return allInterviewerObjects;
    }

    const searchLower = interviewerSearchTerm.toLowerCase();
    return allInterviewerObjects.filter(interviewer => {
      const name = `${interviewer.firstName || ''} ${interviewer.lastName || ''}`.toLowerCase();
      const nameMatch = name.includes(searchLower);
      const emailMatch = interviewer.email?.toLowerCase().includes(searchLower);
      const phoneMatch = interviewer.phone?.toLowerCase().includes(searchLower);
      const memberIDMatch = interviewer.memberID?.toLowerCase().includes(searchLower);
      
      return nameMatch || emailMatch || phoneMatch || memberIDMatch;
    });
  }, [allInterviewerObjects, interviewerSearchTerm]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle interviewer toggle
  const handleInterviewerToggle = (interviewerId) => {
    setFilters(prev => {
      const currentIds = prev.interviewerIds || [];
      const isSelected = currentIds.includes(interviewerId);
      
      return {
        ...prev,
        interviewerIds: isSelected
          ? currentIds.filter(id => id !== interviewerId)
          : [...currentIds, interviewerId]
      };
    });
  };

  // Handle interviewer mode toggle
  const handleInterviewerModeToggle = (mode) => {
    setFilters(prev => ({
      ...prev,
      interviewerMode: mode
    }));
  };

  // Clear interviewer filters
  const clearInterviewerFilters = () => {
    setFilters(prev => ({
      ...prev,
      interviewerIds: []
    }));
    setInterviewerSearchTerm('');
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (interviewerDropdownRef.current && !interviewerDropdownRef.current.contains(event.target)) {
        setShowInterviewerDropdown(false);
      }
      if (acDropdownRef.current && !acDropdownRef.current.contains(event.target)) {
        setShowACDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      dateRange: 'all',
      startDate: '',
      endDate: '',
      gender: '',
      ageMin: '',
      ageMax: '',
      ac: '',
      city: '',
      district: '',
      lokSabha: '',
      state: '',
      interviewMode: '',
      interviewerIds: [],
      interviewerMode: 'include'
    });
    setInterviewerSearchTerm('');
    setAcSearchTerm('');
  };

  // Helper function to get district from AC using assemblyConstituencies.json
  const getDistrictFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    for (const state of Object.values(assemblyConstituencies.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => 
          ac.acName === acName || ac.acName.toLowerCase() === acName.toLowerCase()
        );
        if (constituency && constituency.district) {
          return constituency.district;
        }
      }
    }
    return 'N/A';
  };

  // Helper function to get Lok Sabha from AC
  const getLokSabhaFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    for (const state of Object.values(assemblyConstituencies.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => 
          ac.acName === acName || ac.acName.toLowerCase() === acName.toLowerCase()
        );
        if (constituency && constituency.lokSabha) {
          return constituency.lokSabha;
        }
      }
    }
    return 'N/A';
  };

  // Helper function to check if an option is "Others" (same as InterviewInterface)
  const isOthersOption = (optText) => {
    if (!optText) return false;
    const normalized = optText.toLowerCase().trim();
    return normalized === 'other' || 
           normalized === 'others' || 
           normalized === 'others (specify)';
  };

  // Helper function to extract "Others" text from response
  const extractOthersText = (responseValue) => {
    if (!responseValue) return null;
    const responseStr = String(responseValue);
    if (responseStr.startsWith('Others: ')) {
      return responseStr.substring(8); // Remove "Others: " prefix
    }
    return null;
  };

  // Helper function to check if response contains "Others"
  const responseContainsOthers = (responseValue) => {
    if (!responseValue) return false;
    if (Array.isArray(responseValue)) {
      return responseValue.some(val => {
        const str = String(val);
        return str.startsWith('Others: ') || isOthersOption(str);
      });
    }
    const str = String(responseValue);
    return str.startsWith('Others: ') || isOthersOption(str);
  };

  // Helper function to format response display text (same as ResponseDetailsModal)
  const formatResponseDisplay = (response, surveyQuestion) => {
    if (!response || response === null || response === undefined) {
      return 'No response';
    }

    // If it's an array (multiple selections)
    if (Array.isArray(response)) {
      if (response.length === 0) return 'No selections';
      
      // Map each value to its display text using the question options
      const displayTexts = response.map(value => {
        if (surveyQuestion && surveyQuestion.options) {
          const option = surveyQuestion.options.find(opt => opt.value === value);
          return option ? getMainText(option.text || option.value || value) : value;
        }
        return value;
      });
      
      return displayTexts.join(', ');
    }

    // If it's a string or single value
    if (typeof response === 'string' || typeof response === 'number') {
      // Map to display text using question options
      if (surveyQuestion && surveyQuestion.options) {
        const option = surveyQuestion.options.find(opt => opt.value === response);
        return option ? getMainText(option.text || option.value || response.toString()) : response.toString();
      }
      return response.toString();
    }

    return JSON.stringify(response);
  };

  // Helper function to get hardcoded option mappings for common political survey questions
  const getHardcodedOptionMapping = (questionText, responseValue) => {
    const mappings = {
      'What is your gender?': {
        'male': 'Male',
        'female': 'Female',
        'non_binary': 'Non-Binary'
      },
      'Are you a registered voter in this assembly Constituency?': {
        'yes': 'Yes',
        'no': 'No'
      },
      'How do you primarily gather information about political parties and candidates?': {
        'social_media_platforms_(facebook,_twitter,_etc.)': 'Social media platforms (Facebook, Twitter, etc.)',
        'print_media_(newspapers,_magazines)': 'Print media (Newspapers, Magazines)',
        'television_news': 'Television news',
        'radio': 'Radio',
        'word_of_mouth': 'Word of mouth',
        'political_rallies': 'Political rallies',
        'other': 'Other'
      },
      'Which party did you vote for in the last assembly elections (MLA) in 2021?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'did_not_vote': 'Did not vote'
      },
      'Which party did you vote for in the last Lok Sabha elections (MP) in 2024?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'did_not_vote': 'Did not vote'
      },
      'Which party did you vote for in the by- elections held in your assembly constituency (MLA) after 2021?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'did_not_vote': 'Did not vote'
      },
      'If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'undecided': 'Undecided'
      }
    };

    const questionMapping = mappings[questionText];
    if (questionMapping && questionMapping[responseValue]) {
      return questionMapping[responseValue];
    }
    
    return responseValue; // Return original value if no mapping found
  };

  // Helper function to find question by text in survey structure
  const findQuestionByText = (questionText, survey) => {
    if (!survey || !questionText) return null;
    
    // Handle nested survey structure
    const actualSurvey = survey.survey || survey;
    
    // Try different possible structures
    let questions = [];
    
    // Structure 1: Direct questions array
    if (actualSurvey.questions && Array.isArray(actualSurvey.questions)) {
      questions = actualSurvey.questions;
    }
    // Structure 2: Questions in sections
    else if (actualSurvey.sections && Array.isArray(actualSurvey.sections)) {
      questions = actualSurvey.sections.flatMap(section => section.questions || []);
    }
    // Structure 3: Nested survey object
    else if (actualSurvey.survey && actualSurvey.survey.questions) {
      questions = actualSurvey.survey.questions;
    }
    // Structure 4: Nested survey with sections
    else if (actualSurvey.survey && actualSurvey.survey.sections) {
      questions = actualSurvey.survey.sections.flatMap(section => section.questions || []);
    }
    
    // Find the question by text (using main text for comparison)
    const questionMainText = getMainText(questionText).toLowerCase().trim();
    const foundQuestion = questions.find(q => {
      const qText = getMainText(q.text || q.questionText || '').toLowerCase().trim();
      return qText === questionMainText || 
             qText.includes(questionMainText) ||
             questionMainText.includes(qText);
    });
    
    return foundQuestion;
  };

  // Helper function to find question in survey by keywords (similar to SurveyApprovals)
  const findQuestionInSurveyByKeywords = (keywords, survey, requireAll = false, excludeKeywords = []) => {
    if (!survey || !keywords || keywords.length === 0) return null;
    
    const actualSurvey = survey.survey || survey;
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    const normalizedExclude = excludeKeywords.map(k => k.toLowerCase());
    
    const searchInQuestions = (questions) => {
      for (const question of questions) {
        const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
        
        // Check exclude keywords first
        if (normalizedExclude.length > 0) {
          const hasExcludeKeyword = normalizedExclude.some(keyword => questionText.includes(keyword));
          if (hasExcludeKeyword) continue;
        }
        
        // Check include keywords
        if (requireAll) {
          if (normalizedKeywords.every(keyword => questionText.includes(keyword))) {
            return question;
          }
        } else {
          if (normalizedKeywords.some(keyword => questionText.includes(keyword))) {
            return question;
          }
        }
      }
      return null;
    };
    
    // Search in sections
    if (actualSurvey.sections) {
      for (const section of actualSurvey.sections) {
        if (section.questions) {
          const found = searchInQuestions(section.questions);
          if (found) return found;
        }
      }
    }
    
    // Search in top-level questions
    if (actualSurvey.questions) {
      const found = searchInQuestions(actualSurvey.questions);
      if (found) return found;
    }
    
    return null;
  };

  // Helper function to find response by matching question text (without translations)
  const findResponseByQuestionTextMatch = (responses, targetQuestionText) => {
    if (!responses || !Array.isArray(responses) || !targetQuestionText) return null;
    const targetMainText = getMainText(targetQuestionText).toLowerCase().trim();
    
    return responses.find(r => {
      if (!r.questionText) return false;
      const responseQuestionText = getMainText(r.questionText).toLowerCase().trim();
      // Exact match or contains the main text
      return responseQuestionText === targetMainText || 
             responseQuestionText.includes(targetMainText) ||
             targetMainText.includes(responseQuestionText);
    });
  };

  // Helper function to find response by matching survey question (finds question in survey, then matches response)
  const findResponseBySurveyQuestion = (keywords, responses, survey, requireAll = false, excludeKeywords = []) => {
    // First, find the question in the survey
    const surveyQuestion = findQuestionInSurveyByKeywords(keywords, survey, requireAll, excludeKeywords);
    if (!surveyQuestion) return null;
    
    // Get the main text of the survey question (without translation)
    const surveyQuestionMainText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
    
    // Now find the response that matches this question text
    return findResponseByQuestionTextMatch(responses, surveyQuestionMainText);
  };

  // Helper function to find response by question text keywords (fallback method)
  const findResponseByKeywords = (responses, keywords, requireAll = false, excludeKeywords = []) => {
    if (!responses || !Array.isArray(responses)) return null;
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    const normalizedExclude = excludeKeywords.map(k => k.toLowerCase());
    
    return responses.find(r => {
      if (!r.questionText) return false;
      const questionText = getMainText(r.questionText || '').toLowerCase();
      
      // Check exclude keywords first
      if (normalizedExclude.length > 0) {
        const hasExcludeKeyword = normalizedExclude.some(keyword => questionText.includes(keyword));
        if (hasExcludeKeyword) return false;
      }
      
      // Check include keywords
      if (requireAll) {
        return normalizedKeywords.every(keyword => questionText.includes(keyword));
      } else {
        return normalizedKeywords.some(keyword => questionText.includes(keyword));
      }
    });
  };

  // Helper function to get state from GPS location
  const getStateFromGPS = (location) => {
    if (location?.state) return location.state;
    if (location?.address?.state) return location.address.state;
    if (location?.administrative_area_level_1) return location.administrative_area_level_1;
    return 'N/A';
  };

  // Helper function to capitalize name
  const capitalizeName = (name) => {
    if (!name || name === 'N/A') return 'N/A';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to get all questions from survey (handles both sections and direct questions)
  const getAllSurveyQuestions = (survey) => {
    if (!survey) return [];
    const actualSurvey = survey.survey || survey;
    let allQuestions = [];
    
    // Get questions from sections
    if (actualSurvey?.sections && Array.isArray(actualSurvey.sections)) {
      actualSurvey.sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          allQuestions.push(...section.questions);
        }
      });
    }
    
    // Get direct questions if they exist
    if (actualSurvey?.questions && Array.isArray(actualSurvey.questions)) {
      allQuestions.push(...actualSurvey.questions);
    }
    
    // Sort by order if available
    allQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    return allQuestions;
  };

  // Helper function to get option text from value (removes translation part)
  const getOptionTextFromValue = (value, question) => {
    if (!question || !question.options || !value) {
      // If value is a string with translation format like "male_{পুরুষ}", extract main part
      if (typeof value === 'string' && value.includes('_{')) {
        return value.split('_{')[0];
      }
      return value;
    }
    
    // Handle array values
    if (Array.isArray(value)) {
      value = value[0];
    }
    
    // Find the option that matches the value
    const option = question.options.find(opt => 
      opt.value === value || 
      opt.value?.toString() === value?.toString() ||
      opt.code === value ||
      opt.code?.toString() === value?.toString()
    );
    
    if (option) {
      // Return main text without translation
      return getMainText(option.text || option.value || value);
    }
    
    // If not found, check if value has translation format
    if (typeof value === 'string' && value.includes('_{')) {
      return value.split('_{')[0];
    }
    
    // If not found, return the value as is
    return value;
  };

  // Helper function to find question by questionNumber
  const findQuestionByNumber = (questionNumber, survey) => {
    if (!survey || !questionNumber) return null;
    const allQuestions = getAllSurveyQuestions(survey);
    return allQuestions.find(q => {
      const qNum = q.questionNumber || '';
      return qNum === questionNumber || 
             qNum.includes(questionNumber) || 
             questionNumber.includes(qNum);
    });
  };

  // Helper function to extract respondent info from responses array
  const getRespondentInfo = (responses, responseData) => {
    if (!responses || !Array.isArray(responses)) {
      return { name: 'N/A', gender: 'N/A', age: 'N/A', city: 'N/A', district: 'N/A', ac: 'N/A', lokSabha: 'N/A', state: 'N/A' };
    }

    // Use getMainText from translations (already imported at top)
    
    // Helper to find response by question text (ignoring translations)
    const findResponseByQuestionText = (responses, searchTexts) => {
      return responses.find(r => {
        if (!r.questionText) return false;
        const mainText = getMainText(r.questionText).toLowerCase();
        return searchTexts.some(text => mainText.includes(text.toLowerCase()));
      });
    };

    // Helper to find response by questionNumber
    const findResponseByQuestionNumber = (responses, questionNumber) => {
      return responses.find(r => {
        if (!r.questionNumber) return false;
        return r.questionNumber === questionNumber || 
               r.questionNumber.includes(questionNumber) ||
               questionNumber.includes(r.questionNumber);
      });
    };

    // Get survey ID - check both responseData and component state
    // Convert to string to handle ObjectId objects
    const surveyIdRaw = responseData?.survey?._id || responseData?.survey?.id || survey?._id || survey?.id || null;
    const surveyId = surveyIdRaw ? String(surveyIdRaw) : null;
    // Get survey object - prefer component state, fallback to responseData
    const surveyObj = survey || responseData?.survey || null;

    // Special handling for survey "68fd1915d41841da463f0d46"
    if (surveyId === '68fd1915d41841da463f0d46') {
      // STEP 1: Find gender response FIRST and get its identifiers to exclude it
      let genderResponse = findResponseByQuestionText(responses, [
        'please note the respondent\'s gender',
        'note the respondent\'s gender',
        'respondent\'s gender',
        'respondent gender',
        'note the gender'
      ]);
      
      // If not found, try broader search
      if (!genderResponse) {
        genderResponse = findResponseByQuestionText(responses, ['gender']);
      }
      
      // If still not found, try to find by question ID
      if (!genderResponse) {
        const genderResponseById = responses.find(r => 
          r.questionId?.includes('gender') || 
          r.questionId?.includes('respondent_gender')
        );
        if (genderResponseById) {
          genderResponse = genderResponseById;
        }
      }
      
      // Get gender question ID to exclude it from name search - CRITICAL
      const genderQuestionId = genderResponse?.questionId;
      const genderResponseId = genderResponse?._id || genderResponse?.id;
      const genderQuestionText = genderResponse ? getMainText(genderResponse.questionText || '').toLowerCase() : '';
      
      // Create a set of gender identifiers for fast lookup
      const genderIdentifiers = new Set();
      if (genderQuestionId) genderIdentifiers.add(genderQuestionId);
      if (genderResponseId) {
        genderIdentifiers.add(String(genderResponseId));
        if (genderResponse._id) genderIdentifiers.add(String(genderResponse._id));
        if (genderResponse.id) genderIdentifiers.add(String(genderResponse.id));
      }
      
      // Helper function to check if a response value is a gender value
      const isGenderResponseValue = (value) => {
        if (!value) return false;
        const valueStr = String(value).toLowerCase().trim();
        // Check for exact gender values
        if (valueStr === 'male' || valueStr === 'female' || valueStr === 'non_binary' || valueStr === 'other') return true;
        // Check for gender option codes
        if (valueStr === '1' || valueStr === '2' || valueStr === '3') return true;
        // Check for translation format (e.g., "Male_{পুরুষ}")
        if (valueStr.includes('_{')) return true;
        // Check if it starts with gender keywords
        if (valueStr.startsWith('male') || valueStr.startsWith('female')) return true;
        return false;
      };
      
      // Find name from the fixed name question
      // Based on actual data: questionId = "68fd1915d41841da463f0d46_fixed_respondent_name"
      let nameResponse = null;
      
      // Strategy 1: Find by fixed questionId (most reliable for this survey)
      // Based on actual data: questionId = "68fd1915d41841da463f0d46_fixed_respondent_name"
      const fixedNameQuestionId = `${surveyId}_fixed_respondent_name`;
      const nameResponseById = responses.find(r => r.questionId === fixedNameQuestionId);
      
      if (nameResponseById) {
        // CRITICAL: Multiple checks to ensure it's not the gender response
        const isGenderById = genderIdentifiers.has(nameResponseById.questionId) ||
                            genderIdentifiers.has(String(nameResponseById._id)) ||
                            genderIdentifiers.has(String(nameResponseById.id));
        const isGenderByValue = isGenderResponseValue(nameResponseById.response);
        const isGenderByText = nameResponseById.questionText && 
                              (getMainText(nameResponseById.questionText).toLowerCase().includes('gender') ||
                               getMainText(nameResponseById.questionText).toLowerCase().includes('respondent\'s gender'));
        
        // Only use if it passes ALL checks
        if (!isGenderById && !isGenderByValue && !isGenderByText) {
          nameResponse = nameResponseById;
        }
      }
      
      // Strategy 2: Find Q29 question in survey by questionNumber, then match response by questionId
      if (!nameResponse && surveyObj) {
        const nameQuestion = findQuestionByNumber('Q29', surveyObj) || findQuestionByNumber('29', surveyObj);
        if (nameQuestion && nameQuestion.id) {
          // Find response that matches this questionId
          const foundResponse = responses.find(r => r.questionId === nameQuestion.id);
          if (foundResponse) {
            // CRITICAL: Check if this is the gender response using the set
            const isGenderResponse = genderIdentifiers.has(foundResponse.questionId) ||
                                    genderIdentifiers.has(String(foundResponse._id)) ||
                                    genderIdentifiers.has(String(foundResponse.id));
            
            if (!isGenderResponse && !isGenderResponseValue(foundResponse.response)) {
              // Verify question text is not about gender
              if (foundResponse.questionText) {
                const qText = getMainText(foundResponse.questionText).toLowerCase();
                if (!qText.includes('gender') && 
                    !qText.includes('respondent\'s gender') && 
                    !qText.includes('note the gender') &&
                    !qText.includes('note the respondent')) {
                  nameResponse = foundResponse;
                }
              } else {
                nameResponse = foundResponse;
              }
            }
          }
        }
      }
      
      // Strategy 3: If not found by questionId, search by question text pattern
      if (!nameResponse) {
        for (const response of responses) {
          // CRITICAL: Skip if this is the gender response (by ID) - check first using set
          if (genderIdentifiers.has(response.questionId) ||
              genderIdentifiers.has(String(response._id)) ||
              genderIdentifiers.has(String(response.id))) {
            continue; // This is the gender response, skip it
          }
          
          // Skip if response value is a gender value
          if (isGenderResponseValue(response.response)) {
            continue;
          }
          
          // Skip if question text contains gender keywords
          if (response.questionText) {
            const qText = getMainText(response.questionText).toLowerCase();
            if (qText.includes('gender') || 
                qText.includes('respondent\'s gender') || 
                qText.includes('note the gender') ||
                qText.includes('note the respondent')) {
              continue;
            }
          }
          
          // Check for name question text pattern - be very specific
          if (response.questionText) {
            const qText = getMainText(response.questionText).toLowerCase();
            // Look for name question text patterns - must have "share your name" AND ("confidential" OR "assure")
            const hasShareName = qText.includes('share your name') || 
                                qText.includes('would you like to share your name');
            const hasConfidential = qText.includes('confidential') || 
                                   qText.includes('assure') ||
                                   qText.includes('assurance');
            
            if (hasShareName && hasConfidential) {
              nameResponse = response;
              break; // Found name question, stop searching
            }
          }
        }
      }
      
      // Strategy 4: Fallback - search for any question with "share your name" (without confidential)
      if (!nameResponse) {
        for (const response of responses) {
          // Skip if this is the gender response using set
          if (genderIdentifiers.has(response.questionId) ||
              genderIdentifiers.has(String(response._id)) ||
              genderIdentifiers.has(String(response.id))) {
            continue;
          }
          
          // Skip if response value is a gender value
          if (isGenderResponseValue(response.response)) {
            continue;
          }
          
          // Skip if question text contains gender keywords
          if (response.questionText) {
            const qText = getMainText(response.questionText).toLowerCase();
            if (qText.includes('gender') || 
                qText.includes('respondent\'s gender') || 
                qText.includes('note the gender') ||
                qText.includes('note the respondent')) {
              continue;
            }
            
            // Check for "share your name" pattern
            if (qText.includes('would you like to share your name') ||
                qText.includes('share your name with us') ||
                (qText.includes('share your name') && !qText.includes('gender'))) {
              nameResponse = response;
              break;
            }
          }
        }
      }
      
      // Final safety check: if we still have a nameResponse, verify it's not a gender value or gender response
      // This is CRITICAL - we must never use the gender response as the name
      if (nameResponse) {
        // Check 1: Is it the gender response by ID? (using set for fast lookup)
        if (genderIdentifiers.has(nameResponse.questionId) ||
            genderIdentifiers.has(String(nameResponse._id)) ||
            genderIdentifiers.has(String(nameResponse.id))) {
          nameResponse = null;
        }
        // Check by question text match
        else if (nameResponse.questionText && genderResponse && genderResponse.questionText) {
          const nameText = getMainText(nameResponse.questionText).toLowerCase();
          const genderText = getMainText(genderResponse.questionText).toLowerCase();
          if (nameText === genderText) {
            nameResponse = null;
          }
        }
        
        // Check 2: Is the response value a gender value?
        if (nameResponse && isGenderResponseValue(nameResponse.response)) {
          nameResponse = null;
        }
        
        // Check 3: Does the question text contain gender keywords?
        if (nameResponse && nameResponse.questionText) {
          const qText = getMainText(nameResponse.questionText).toLowerCase();
          if (qText.includes('gender') || 
              qText.includes('respondent\'s gender') || 
              qText.includes('note the gender') ||
              qText.includes('note the respondent') ||
              (qText.includes('respondent') && qText.includes('gender'))) {
            nameResponse = null;
          }
        }
      }
      
      // ABSOLUTE FINAL CHECK: If nameResponse is still set but has a gender value, clear it
      if (nameResponse && isGenderResponseValue(nameResponse.response)) {
        nameResponse = null;
      }
      
      // Get name and capitalize it
      // CRITICAL: Only use nameResponse if it exists and is NOT the gender response
      let name = 'N/A';
      
      // Final validation: Ensure nameResponse is valid and not the gender response
      if (nameResponse) {
        // Check 1: Is it the gender response? (using set for fast lookup)
        if (genderIdentifiers.has(nameResponse.questionId) ||
            genderIdentifiers.has(String(nameResponse._id)) ||
            genderIdentifiers.has(String(nameResponse.id))) {
          nameResponse = null; // Clear it - this is the gender response
        }
        // Check 2: Is the response value a gender value?
        else if (isGenderResponseValue(nameResponse.response)) {
          nameResponse = null; // Clear it - this has a gender value
        }
        // Check 3: Is the question text about gender?
        else if (nameResponse.questionText) {
          const qText = getMainText(nameResponse.questionText).toLowerCase();
          if (qText.includes('gender') || 
              qText.includes('respondent\'s gender') || 
              qText.includes('note the gender') ||
              qText.includes('note the respondent')) {
            nameResponse = null; // Clear it - this is a gender question
          }
        }
      }
      
      // Now extract the name only if nameResponse is still valid
      // ABSOLUTE FINAL CHECK: Make absolutely sure nameResponse is not the gender response
      if (nameResponse) {
        // Check one more time if it's the gender response
        if (genderIdentifiers.has(nameResponse.questionId) ||
            genderIdentifiers.has(String(nameResponse._id)) ||
            genderIdentifiers.has(String(nameResponse.id))) {
          nameResponse = null; // Clear it
        }
        // Check if the value is a gender value
        else if (isGenderResponseValue(nameResponse.response)) {
          nameResponse = null; // Clear it
        }
        // Check if question text is about gender
        else if (nameResponse.questionText) {
          const qText = getMainText(nameResponse.questionText).toLowerCase();
          if (qText.includes('gender') || 
              qText.includes('respondent\'s gender') || 
              qText.includes('note the gender') ||
              qText.includes('note the respondent')) {
            nameResponse = null; // Clear it
          }
        }
      }
      
      if (nameResponse?.response) {
        const nameValue = Array.isArray(nameResponse.response) ? nameResponse.response[0] : nameResponse.response;
        const nameStr = String(nameValue).toLowerCase().trim();
        
        // ABSOLUTE FINAL CHECK: ensure it's not a gender value
        if (!isGenderResponseValue(nameValue) && 
            nameValue && 
            nameValue !== 'N/A' && 
            nameValue !== null &&
            nameValue !== undefined &&
            nameStr !== '' &&
            nameStr.length > 1 &&
            !nameStr.includes('_{')) { // Extra check for translation format
          name = capitalizeName(String(nameValue));
        }
      }
      
      // Get gender option text (without translation)
      let gender = 'N/A';
      if (genderResponse?.response) {
        // Try to find the gender question in survey
        const genderQuestion = surveyObj ? getAllSurveyQuestions(surveyObj).find(q => {
          const qText = getMainText(q.text || '').toLowerCase();
          return qText.includes('gender') || qText.includes('respondent');
        }) : null;
        
        gender = getOptionTextFromValue(genderResponse.response, genderQuestion);
      }
      
      // Find age from age question
      const ageResponse = findResponseByQuestionText(responses, [
        'could you please tell me your age',
        'your age in complete years',
        'age in complete years',
        'age'
      ]);

      const acResponse = responses.find(r => 
        getMainText(r.questionText || '').toLowerCase().includes('assembly') ||
        getMainText(r.questionText || '').toLowerCase().includes('constituency')
      );

      // Get city from GPS location if available, otherwise from responses
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

      // Get district from AC using assemblyConstituencies.json
      const acName = acResponse?.response || 'N/A';
      const district = getDistrictFromAC(acName);

      // Get Lok Sabha from AC using assemblyConstituencies.json
      const lokSabha = getLokSabhaFromAC(acName);

      // Get state from GPS location
      const state = getStateFromGPS(responseData?.location);

      return {
        name: name,
        gender: gender,
        age: ageResponse?.response || 'N/A',
        city: city,
        district: district,
        ac: acName,
        lokSabha: lokSabha,
        state: state
      };
    }

    // Default behavior for other surveys
    // IMPORTANT: Exclude gender responses from name search
    const genderResponse = responses.find(r => 
      getMainText(r.questionText || '').toLowerCase().includes('gender') || 
      getMainText(r.questionText || '').toLowerCase().includes('sex')
    );
    const genderQuestionId = genderResponse?.questionId;
    
    const nameResponse = responses.find(r => {
      // Skip if this is the gender response
      if (genderQuestionId && r.questionId === genderQuestionId) return false;
      // Skip if question text is about gender
      const qText = getMainText(r.questionText || '').toLowerCase();
      if (qText.includes('gender') || qText.includes('sex')) return false;
      // Look for name-related questions
      return qText.includes('name') || 
             (qText.includes('respondent') && !qText.includes('gender')) ||
             qText.includes('full name');
    });
    
    // Get gender response (already found above if not in special survey section)
    const genderResponseForDefault = responses.find(r => 
      getMainText(r.questionText || '').toLowerCase().includes('gender') || 
      getMainText(r.questionText || '').toLowerCase().includes('sex')
    );
    
    // Get gender option text (without translation)
    let gender = 'N/A';
    if (genderResponseForDefault?.response) {
      const genderQuestion = survey ? getAllSurveyQuestions(survey).find(q => {
        const qText = getMainText(q.text || '').toLowerCase();
        return qText.includes('gender') || qText.includes('sex');
      }) : null;
      
      gender = getOptionTextFromValue(genderResponseForDefault.response, genderQuestion);
    }
    
    const ageResponse = responses.find(r => 
      getMainText(r.questionText || '').toLowerCase().includes('age') || 
      getMainText(r.questionText || '').toLowerCase().includes('year')
    );

    const acResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('assembly') ||
      r.questionText.toLowerCase().includes('constituency')
    );

    // Get city from GPS location if available, otherwise from responses
    let city = 'N/A';
    if (responseData?.location?.city) {
      city = responseData.location.city;
    } else {
      const cityResponse = responses.find(r => 
        r.questionText.toLowerCase().includes('city') || 
        r.questionText.toLowerCase().includes('location')
      );
      city = cityResponse?.response || 'N/A';
    }

    // Get district from AC using assemblyConstituencies.json
    const acName = acResponse?.response || 'N/A';
    const district = getDistrictFromAC(acName);

    // Get Lok Sabha from AC using assemblyConstituencies.json
    const lokSabha = getLokSabhaFromAC(acName);

    // Get state from GPS location
    const state = getStateFromGPS(responseData?.location);

    // Get name and capitalize it
    // CRITICAL: Ensure nameResponse is not a gender response
    let name = 'N/A';
    if (nameResponse && nameResponse !== genderResponseForDefault) {
      const nameValue = nameResponse.response;
      // Check if it's a gender value
      const nameStr = String(nameValue).toLowerCase().trim();
      if (!nameStr.includes('_{') && // Not a translated gender value
          !nameStr.startsWith('male') && 
          !nameStr.startsWith('female') &&
          nameValue && 
          nameValue !== 'N/A' && 
          nameValue !== null &&
          nameValue !== undefined &&
          nameStr !== '' &&
          nameStr.length > 1) {
        name = capitalizeName(String(nameValue));
      }
    }

    return {
      name: name,
      gender: gender,
      age: ageResponse?.response || 'N/A',
      city: city,
      district: district,
      ac: acName,
      lokSabha: lokSabha,
      state: state
    };
  };

  // Get unique filter options from original unfiltered responses
  const getFilterOptions = useMemo(() => {
    if (!originalResponses || originalResponses.length === 0) {
      return {
        gender: [],
        age: [],
        ac: [],
        city: [],
        district: [],
        lokSabha: [],
        state: []
      };
    }

    const options = {
      gender: new Set(),
      age: new Set(),
      ac: new Set(),
      city: new Set(),
      district: new Set(),
      lokSabha: new Set(),
      state: new Set(),
      interviewMode: new Set()
    };

    originalResponses.forEach(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const state = getStateFromGPS(response.location);
      const lokSabha = getLokSabhaFromAC(respondentInfo.ac);

      if (respondentInfo.gender && respondentInfo.gender !== 'N/A') {
        options.gender.add(respondentInfo.gender);
      }
      if (respondentInfo.age && respondentInfo.age !== 'N/A') {
        options.age.add(parseInt(respondentInfo.age));
      }
      if (respondentInfo.ac && respondentInfo.ac !== 'N/A') {
        options.ac.add(respondentInfo.ac);
      }
      if (respondentInfo.city && respondentInfo.city !== 'N/A') {
        options.city.add(respondentInfo.city);
      }
      if (respondentInfo.district && respondentInfo.district !== 'N/A') {
        options.district.add(respondentInfo.district);
      }
      if (lokSabha && lokSabha !== 'N/A') {
        options.lokSabha.add(lokSabha);
      }
      if (state && state !== 'N/A') {
        options.state.add(state);
      }
      if (response.interviewMode && response.interviewMode !== 'N/A') {
        options.interviewMode.add(response.interviewMode.toUpperCase());
      }
    });

    const result = {
      gender: Array.from(options.gender).sort(),
      age: Array.from(options.age).sort((a, b) => a - b),
      ac: Array.from(options.ac).sort(),
      city: Array.from(options.city).sort(),
      district: Array.from(options.district).sort(),
      lokSabha: Array.from(options.lokSabha).sort(),
      state: Array.from(options.state).sort(),
      interviewMode: Array.from(options.interviewMode).sort()
    };
    
    return result;
  }, [originalResponses]);

  // Filter responses based on current filters
  const filteredResponses = useMemo(() => {
    if (!originalResponses || originalResponses.length === 0) return [];

    return originalResponses.filter(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const state = getStateFromGPS(response.location);
      const lokSabha = getLokSabhaFromAC(respondentInfo.ac);

      // Date Range filter
      if (filters.dateRange !== 'all') {
        const responseDate = new Date(response.createdAt);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        if (filters.dateRange === 'custom') {
          if (filters.startDate || filters.endDate) {
            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            const endDate = filters.endDate ? new Date(filters.endDate) : null;
            endDate?.setHours(23, 59, 59, 999); // Include full end date
            
            if (startDate && responseDate < startDate) return false;
            if (endDate && responseDate > endDate) return false;
          }
        } else if (filters.dateRange === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (responseDate < today || responseDate >= tomorrow) return false;
        } else if (filters.dateRange === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (responseDate < weekAgo) return false;
        } else if (filters.dateRange === 'month') {
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          if (responseDate < monthAgo) return false;
        }
      }

      // Interviewer filter
      if (filters.interviewerIds && filters.interviewerIds.length > 0) {
        const interviewerId = response.interviewer?._id;
        const isIncluded = filters.interviewerIds.includes(interviewerId);
        
        if (filters.interviewerMode === 'include' && !isIncluded) {
          return false;
        }
        if (filters.interviewerMode === 'exclude' && isIncluded) {
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase().trim();
        const respondentName = respondentInfo.name.toLowerCase();
        const interviewerName = response.interviewer 
          ? `${response.interviewer.firstName} ${response.interviewer.lastName}`.toLowerCase()
          : '';
        
        if (!respondentName.includes(searchTerm) && !interviewerName.includes(searchTerm)) {
          return false;
        }
      }

      // Gender filter - case insensitive
      if (filters.gender && respondentInfo.gender.toLowerCase() !== filters.gender.toLowerCase()) {
        return false;
      }

      // Age filter
      if (filters.ageMin && parseInt(respondentInfo.age) < parseInt(filters.ageMin)) {
        return false;
      }
      if (filters.ageMax && parseInt(respondentInfo.age) > parseInt(filters.ageMax)) {
        return false;
      }

      // AC filter - case insensitive
      if (filters.ac && respondentInfo.ac.toLowerCase() !== filters.ac.toLowerCase()) {
        return false;
      }

      // City filter - case insensitive
      if (filters.city && respondentInfo.city.toLowerCase() !== filters.city.toLowerCase()) {
        return false;
      }

      // District filter - case insensitive
      if (filters.district && respondentInfo.district.toLowerCase() !== filters.district.toLowerCase()) {
        return false;
      }

      // Lok Sabha filter - case insensitive
      if (filters.lokSabha && lokSabha.toLowerCase() !== filters.lokSabha.toLowerCase()) {
        return false;
      }

      // State filter - case insensitive
      if (filters.state && state.toLowerCase() !== filters.state.toLowerCase()) {
        return false;
      }

      // Interview Mode filter
      if (filters.interviewMode && response.interviewMode?.toUpperCase() !== filters.interviewMode.toUpperCase()) {
        return false;
      }

      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'approved_rejected_pending') {
          // Show Approved, Rejected, and Pending_Approval
          if (response.status !== 'Approved' && response.status !== 'Rejected' && response.status !== 'Pending_Approval') {
            return false;
          }
        } else if (filters.status === 'approved_pending') {
          // Show Approved and Pending_Approval
          if (response.status !== 'Approved' && response.status !== 'Pending_Approval') {
            return false;
          }
        } else if (filters.status === 'pending') {
          // Show only Pending_Approval
          if (response.status !== 'Pending_Approval') {
            return false;
          }
        } else {
          // Filter by specific status (Approved, Rejected, etc.)
          if (response.status !== filters.status) {
            return false;
          }
        }
      } else {
        // Default (status === 'all'): Show both Approved and Rejected
        if (response.status !== 'Approved' && response.status !== 'Rejected') {
          return false;
        }
      }

      return true;
    });
  }, [originalResponses, filters]);

  // Reset pagination to page 1 when filters change
  // Use a serialized key to detect filter changes (handles arrays properly)
  const filtersKey = useMemo(() => {
    return JSON.stringify({
      status: filters.status,
      dateRange: filters.dateRange,
      startDate: filters.startDate,
      endDate: filters.endDate,
      search: filters.search,
      gender: filters.gender,
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      ac: filters.ac,
      city: filters.city,
      district: filters.district,
      lokSabha: filters.lokSabha,
      state: filters.state,
      interviewMode: filters.interviewMode,
      interviewerIds: filters.interviewerIds?.sort() || [], // Sort for consistent comparison
      interviewerMode: filters.interviewerMode
    });
  }, [filters]);

  useEffect(() => {
    setTablePagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  }, [filtersKey]);

  // Paginated responses for table
  const paginatedResponses = useMemo(() => {
    const startIndex = (tablePagination.currentPage - 1) * tablePagination.pageSize;
    const endIndex = startIndex + tablePagination.pageSize;
    return filteredResponses.slice(startIndex, endIndex);
  }, [filteredResponses, tablePagination]);

  // Calculate total pages for table
  const totalTablePages = Math.ceil(filteredResponses.length / tablePagination.pageSize);

  // Handle table pagination
  const handleTablePageChange = (newPage) => {
    setTablePagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // Helper function to check if a question is AC selection or polling station
  const isACOrPollingStationQuestion = (question) => {
    // Check by questionId
    if (question.id === 'ac-selection') return true;
    // Check by question type
    if (question.type === 'polling_station') return true;
    // Check by question text (fallback)
    const questionText = question.text || question.questionText || '';
    if (questionText.toLowerCase().includes('select assembly constituency') || 
        questionText.toLowerCase().includes('select polling station')) {
      return true;
    }
    return false;
  };

  // Handle CSV download with raw survey question-answer data
  const handleCSVDownload = () => {
    if (filteredResponses.length === 0) {
      showError('No responses to download');
      return;
    }

    if (!survey) {
      showError('Survey data not available');
      return;
    }

    // Show modal to choose download mode
    setShowDownloadModal(true);
  };

  // Generate CSV with selected mode
  const generateCSV = (downloadMode) => {
    setShowDownloadModal(false);

    if (filteredResponses.length === 0) {
      showError('No responses to download');
      return;
    }

    if (!survey) {
      showError('Survey data not available');
      return;
    }

    // Get ALL questions from the survey itself (not from responses)
    // This ensures we have a complete template that works for both CAPI and CATI
    const allSurveyQuestions = getAllSurveyQuestions(survey);
    
    if (allSurveyQuestions.length === 0) {
      showError('No survey questions found');
      return;
    }

    // Filter out AC selection and polling station questions
    const regularQuestions = allSurveyQuestions.filter(q => !isACOrPollingStationQuestion(q));
    
    if (regularQuestions.length === 0) {
      showError('No regular survey questions found (only AC/polling station questions)');
      return;
    }

    // Detect questions with "Others" option and create headers with "Others" columns
    const questionHeaders = [];
    const questionOthersMap = new Map(); // Map question index to whether it has "Others"
    
    regularQuestions.forEach((question, index) => {
      const questionText = question.text || question.questionText || `Question ${index + 1}`;
      const questionHeader = `Q${index + 1}: ${getMainText(questionText)}`;
      questionHeaders.push(questionHeader);
      
      // Check if question has "Others" option (for MCQ questions)
      if ((question.type === 'multiple_choice' || question.type === 'single_choice') && question.options) {
        const hasOthersOption = question.options.some(opt => {
          const optText = typeof opt === 'object' ? opt.text : opt;
          return isOthersOption(optText);
        });
        
        if (hasOthersOption) {
          questionOthersMap.set(index, true);
          // Add "Others" column header right after the question
          questionHeaders.push(`Q${index + 1}: ${questionText} - Other`);
        } else {
          questionOthersMap.set(index, false);
        }
      } else {
        questionOthersMap.set(index, false);
      }
    });
    
    // Add metadata headers (common columns for both CAPI and CATI)
    const metadataHeaders = [
      'Response ID',
      'Interview Mode',
      'Interviewer Name',
      'Interviewer Email',
      'Response Date',
      'Status',
      'Assembly Constituency (AC)',
      'Parliamentary Constituency (PC)',
      'District',
      'Polling Station Code',
      'Polling Station Name',
      'GPS Coordinates',
      'Call ID' // For CATI interviews
    ];

    const allHeaders = [...metadataHeaders, ...questionHeaders];

    // Helper function to extract AC and polling station from responses
    const getACAndPollingStationFromResponses = (responses) => {
      if (!responses || !Array.isArray(responses)) {
        return { ac: null, pollingStation: null, groupName: null };
      }
      
      let ac = null;
      let pollingStation = null;
      let groupName = null;
      
      responses.forEach((responseItem) => {
        // Check if this is AC selection question
        if (responseItem.questionId === 'ac-selection') {
          ac = responseItem.response || null;
        }
        
        // Check if this is polling station question
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
        
        // Check for polling station group selection
        if (responseItem.questionId === 'polling-station-group' ||
            responseItem.questionText?.toLowerCase().includes('select group')) {
          groupName = responseItem.response || null;
        }
      });
      
      return { ac, pollingStation, groupName };
    };

    // Helper function to extract polling station code and name
    const extractPollingStationCodeAndName = (stationValue, selectedPollingStation) => {
      let stationCode = 'N/A';
      let stationName = 'N/A';
      
      // Priority: Use selectedPollingStation.stationName (should have "Code - Name" format)
      const fullStationValue = selectedPollingStation?.stationName || stationValue;
      
      if (fullStationValue) {
        if (typeof fullStationValue === 'string' && fullStationValue.includes(' - ')) {
          const parts = fullStationValue.split(' - ');
          if (parts.length >= 2) {
            stationCode = parts[0].trim();
            stationName = parts.slice(1).join(' - ').trim();
          } else {
            stationCode = fullStationValue;
            stationName = fullStationValue;
          }
        } else {
          // If it's just a code or name, use as code
          stationCode = fullStationValue;
          stationName = fullStationValue;
        }
      }
      
      return { stationCode, stationName };
    };

    // Create CSV data rows
    const csvData = filteredResponses.map(response => {
      // Extract AC and polling station from responses
      const { ac: acFromResponse, pollingStation: pollingStationFromResponse } = getACAndPollingStationFromResponses(response.responses);
      
      // Get AC, PC, and District
      const displayAC = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || 'N/A';
      
      // Get PC: Priority 1 - selectedPollingStation.pcName, Priority 2 - getLokSabhaFromAC
      let displayPC = response.selectedPollingStation?.pcName || 'N/A';
      if (displayPC === 'N/A' && displayAC !== 'N/A') {
        displayPC = getLokSabhaFromAC(displayAC);
      }
      
      // Get District: Priority 1 - selectedPollingStation.district, Priority 2 - getDistrictFromAC
      let displayDistrict = response.selectedPollingStation?.district || 'N/A';
      if (displayDistrict === 'N/A' && displayAC !== 'N/A') {
        displayDistrict = getDistrictFromAC(displayAC);
      }
      
      // Extract polling station code and name
      const pollingStationValue = pollingStationFromResponse || response.selectedPollingStation?.stationName;
      const { stationCode, stationName } = extractPollingStationCodeAndName(pollingStationValue, response.selectedPollingStation);
      
      // Extract metadata (common columns)
      const metadata = [
        response.responseId || response._id?.slice(-8) || 'N/A',
        response.interviewMode?.toUpperCase() || 'N/A',
        response.interviewer ? `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim() : 'N/A',
        response.interviewer?.email || 'N/A',
        new Date(response.createdAt || response.endTime || response.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        response.status || 'N/A',
        displayAC,
        displayPC,
        displayDistrict,
        stationCode,
        stationName,
        response.location ? `(${response.location.latitude?.toFixed(4)}, ${response.location.longitude?.toFixed(4)})` : 'N/A',
        response.call_id || 'N/A' // CATI call ID
      ];

      // Extract answers for each question in the survey
      // Match by questionId first (most reliable), then by questionText
      const answers = [];
      
      regularQuestions.forEach((surveyQuestion, questionIndex) => {
        // Try to find matching answer by questionId first
        let matchingAnswer = null;
        
        if (surveyQuestion.id) {
          matchingAnswer = response.responses?.find(r => 
            r.questionId === surveyQuestion.id
          );
        }
        
        // If not found by ID, try by questionText
        if (!matchingAnswer && surveyQuestion.text) {
          matchingAnswer = response.responses?.find(r => 
            r.questionText === surveyQuestion.text || 
            r.questionText === surveyQuestion.questionText
          );
        }
        
        let questionResponse = '';
        let othersText = '';
        
        if (matchingAnswer) {
          // Check if the question was actually skipped
          if (matchingAnswer.isSkipped) {
            questionResponse = 'Skipped';
          } else {
            // Check if response has content
            const hasResponseContent = (responseValue) => {
              if (!responseValue && responseValue !== 0) return false;
              if (Array.isArray(responseValue)) return responseValue.length > 0;
              if (typeof responseValue === 'object') return Object.keys(responseValue).length > 0;
              return responseValue !== '' && responseValue !== null && responseValue !== undefined;
            };
            
            if (!hasResponseContent(matchingAnswer.response)) {
              questionResponse = 'No response';
            } else {
              const responseValue = matchingAnswer.response;
              
              // Check if this question has "Others" option
              const hasOthersOption = questionOthersMap.get(questionIndex);
              
              if (hasOthersOption && (surveyQuestion.type === 'multiple_choice' || surveyQuestion.type === 'single_choice')) {
                // Extract "Others" text if present
                if (Array.isArray(responseValue)) {
                  // Multiple selection - check each value for "Others" text
                  let foundOthersText = '';
                  const processedValues = responseValue.map(val => {
                    const othersTextValue = extractOthersText(val);
                    if (othersTextValue) {
                      foundOthersText = othersTextValue; // Store the "Others" text
                      // Return "Others" or the option code/text
                      if (downloadMode === 'codes') {
                        // Find the "Others" option code
                        const othersOpt = surveyQuestion.options.find(opt => {
                          const optText = typeof opt === 'object' ? opt.text : opt;
                          return isOthersOption(optText);
                        });
                        return typeof othersOpt === 'object' ? (othersOpt.code || othersOpt.value || 'Others') : 'Others';
                      } else {
                        return 'Others';
                      }
                    }
                    // Check if value itself is "Others" option
                    const othersOpt = surveyQuestion.options.find(opt => {
                      const optText = typeof opt === 'object' ? opt.text : opt;
                      const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                      return isOthersOption(optText) && (optValue === val || String(optValue) === String(val));
                    });
                    if (othersOpt) {
                      if (downloadMode === 'codes') {
                        return typeof othersOpt === 'object' ? (othersOpt.code || othersOpt.value || 'Others') : 'Others';
                      } else {
                        return 'Others';
                      }
                    }
                    return val;
                  });
                  othersText = foundOthersText;
                  
                  // Format the response based on mode
                  if (downloadMode === 'codes') {
                    // Convert to option codes
                    questionResponse = processedValues.map(val => {
                      if (val === 'Others' || isOthersOption(String(val))) {
                        const othersOpt = surveyQuestion.options.find(opt => {
                          const optText = typeof opt === 'object' ? opt.text : opt;
                          return isOthersOption(optText);
                        });
                        return typeof othersOpt === 'object' ? (othersOpt.code || othersOpt.value || 'Others') : 'Others';
                      }
                      // Find option code
                      const option = surveyQuestion.options.find(opt => {
                        const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                        return optValue === val || String(optValue) === String(val);
                      });
                      return typeof option === 'object' ? (option.code || option.value || val) : val;
                    }).join(', ');
                  } else {
                    // Use text format
                    questionResponse = formatResponseDisplay(processedValues, surveyQuestion);
                  }
                } else {
                  // Single selection
                  const othersTextValue = extractOthersText(responseValue);
                  if (othersTextValue) {
                    othersText = othersTextValue;
                    if (downloadMode === 'codes') {
                      const othersOpt = surveyQuestion.options.find(opt => {
                        const optText = typeof opt === 'object' ? opt.text : opt;
                        return isOthersOption(optText);
                      });
                      questionResponse = typeof othersOpt === 'object' ? (othersOpt.code || othersOpt.value || 'Others') : 'Others';
                    } else {
                      questionResponse = 'Others';
                    }
                  } else {
                    // Format the response based on mode
                    if (downloadMode === 'codes' && (surveyQuestion.type === 'multiple_choice' || surveyQuestion.type === 'single_choice')) {
                      // Find option code
                      const option = surveyQuestion.options.find(opt => {
                        const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                        return optValue === responseValue || String(optValue) === String(responseValue);
                      });
                      questionResponse = typeof option === 'object' ? (option.code || option.value || responseValue) : responseValue;
                    } else {
                      // Use text format
                      if (surveyQuestion.options) {
                        questionResponse = formatResponseDisplay(responseValue, surveyQuestion);
                      } else {
                        questionResponse = getHardcodedOptionMapping(
                          surveyQuestion.text || surveyQuestion.questionText, 
                          responseValue
                        );
                      }
                    }
                  }
                }
              } else {
                // No "Others" option - format normally
                if (downloadMode === 'codes' && (surveyQuestion.type === 'multiple_choice' || surveyQuestion.type === 'single_choice') && surveyQuestion.options) {
                  // Convert to option codes
                  if (Array.isArray(responseValue)) {
                    questionResponse = responseValue.map(val => {
                      const option = surveyQuestion.options.find(opt => {
                        const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                        return optValue === val || String(optValue) === String(val);
                      });
                      return typeof option === 'object' ? (option.code || option.value || val) : val;
                    }).join(', ');
                  } else {
                    const option = surveyQuestion.options.find(opt => {
                      const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                      return optValue === responseValue || String(optValue) === String(responseValue);
                    });
                    questionResponse = typeof option === 'object' ? (option.code || option.value || responseValue) : responseValue;
                  }
                } else {
                  // Use text format
                  if (surveyQuestion.options) {
                    questionResponse = formatResponseDisplay(responseValue, surveyQuestion);
                  } else {
                    questionResponse = getHardcodedOptionMapping(
                      surveyQuestion.text || surveyQuestion.questionText, 
                      responseValue
                    );
                  }
                }
              }
            }
          }
        } else {
          // Question not found in this response - could be due to conditional logic
          // Return empty string instead of 'Skipped' to distinguish from actually skipped questions
          questionResponse = '';
        }
        
        // Add question response
        answers.push(questionResponse);
        
        // Add "Others" text column if this question has "Others" option
        if (questionOthersMap.get(questionIndex)) {
          answers.push(othersText || '');
        }
      });

      return [...metadata, ...answers];
    });

    const csvContent = [allHeaders, ...csvData]
      .map(row => row.map(field => {
        const fieldStr = String(field || '');
        // Escape quotes and wrap in quotes
        return `"${fieldStr.replace(/"/g, '""')}"`;
      }).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const modeSuffix = downloadMode === 'codes' ? '_codes' : '_responses';
    link.download = `${survey?.surveyName || survey?.title || 'survey'}${modeSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    showSuccess('CSV downloaded successfully');
  };

  // Handle view response details
  const handleViewResponse = (response) => {
    setSelectedResponse(response);
    setShowResponseDetails(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading responses...</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Survey Not Found</h2>
          <button
            onClick={() => navigate(isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys')}
            className="px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 w-full view-responses-page">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <button
                  onClick={() => navigate(backPath)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Back to Surveys</span>
                </button>
                <div className="h-6 w-px bg-gray-300 flex-shrink-0 hidden sm:block"></div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    {survey.title}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {filteredResponses.length} responses
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                </button>
                
                {!isProjectManagerRoute && (
                  <button
                    onClick={handleCSVDownload}
                    className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download CSV</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border-b border-gray-200 w-full">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Approved + Rejected</option>
                    <option value="approved_rejected_pending">Approved + Rejected + Pending</option>
                    <option value="approved_pending">Approved + Pending</option>
                    <option value="pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => {
                      handleFilterChange('dateRange', e.target.value);
                      // Clear custom dates when switching away from custom
                      if (e.target.value !== 'custom') {
                        handleFilterChange('startDate', '');
                        handleFilterChange('endDate', '');
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  
                  {/* Custom Date Range Picker */}
                  {filters.dateRange === 'custom' && (
                    <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-[#373177]" />
                        <span className="text-sm font-semibold text-gray-700">Select Date Range</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div className="relative">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            From Date
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                            <DatePicker
                              selected={filters.startDate ? new Date(filters.startDate) : null}
                              onChange={(date) => {
                                if (date) {
                                  const dateStr = date.toISOString().split('T')[0];
                                  handleFilterChange('startDate', dateStr);
                                } else {
                                  handleFilterChange('startDate', '');
                                }
                              }}
                              selectsStart
                              startDate={filters.startDate ? new Date(filters.startDate) : null}
                              endDate={filters.endDate ? new Date(filters.endDate) : null}
                              maxDate={filters.endDate ? new Date(filters.endDate) : new Date()}
                              dateFormat="MMM dd, yyyy"
                              placeholderText="Select start date"
                              className="w-full pl-8 pr-10 py-2.5 bg-white border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-blue-400"
                              showPopperArrow={false}
                              popperClassName="react-datepicker-popper"
                              calendarClassName="custom-calendar"
                              isClearable
                              clearButtonClassName="text-gray-400 hover:text-red-500 transition-colors"
                            />
                          </div>
                          {filters.startDate && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              {new Date(filters.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>

                        {/* End Date */}
                        <div className="relative">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            To Date
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                            <DatePicker
                              selected={filters.endDate ? new Date(filters.endDate) : null}
                              onChange={(date) => {
                                if (date) {
                                  const dateStr = date.toISOString().split('T')[0];
                                  handleFilterChange('endDate', dateStr);
                                } else {
                                  handleFilterChange('endDate', '');
                                }
                              }}
                              selectsEnd
                              startDate={filters.startDate ? new Date(filters.startDate) : null}
                              endDate={filters.endDate ? new Date(filters.endDate) : null}
                              minDate={filters.startDate ? new Date(filters.startDate) : null}
                              maxDate={new Date()}
                              dateFormat="MMM dd, yyyy"
                              placeholderText="Select end date"
                              className="w-full pl-8 pr-10 py-2.5 bg-white border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-blue-400"
                              showPopperArrow={false}
                              popperClassName="react-datepicker-popper"
                              calendarClassName="custom-calendar"
                              isClearable
                              clearButtonClassName="text-gray-400 hover:text-red-500 transition-colors"
                            />
                          </div>
                          {filters.endDate && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              {new Date(filters.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Date Range Summary */}
                      {filters.startDate && filters.endDate && (
                        <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#E6F0F8]0"></div>
                            <span className="text-sm font-medium text-gray-700">
                              {new Date(filters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(filters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              handleFilterChange('startDate', '');
                              handleFilterChange('endDate', '');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Clear Range
                          </button>
                        </div>
                      )}

                      {/* Helper Text */}
                      {(!filters.startDate || !filters.endDate) && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {!filters.startDate && !filters.endDate 
                              ? 'Select both start and end dates to filter responses'
                              : !filters.startDate 
                                ? 'Please select a start date'
                                : 'Please select an end date'
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Interview Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interview Mode</label>
                  <select
                    value={filters.interviewMode}
                    onChange={(e) => handleFilterChange('interviewMode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Modes</option>
                    {getFilterOptions.interviewMode.map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>

                {/* Assembly Constituency - Modern Searchable Dropdown */}
                <div className="relative" ref={acDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assembly Constituency
                    {filters.ac && (
                      <span className="text-xs font-normal text-gray-500 ml-1">
                        (AC: {allACObjects.find(ac => ac.name === filters.ac)?.numericCode || ''})
                      </span>
                    )}
                  </label>
                  
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={filters.ac ? filters.ac : "Search by AC name or code..."}
                      value={filters.ac ? filters.ac : acSearchTerm}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAcSearchTerm(value);
                        setShowACDropdown(true);
                        handleFilterChange('ac', ''); // Clear selection when typing
                      }}
                      onFocus={() => {
                        setShowACDropdown(true);
                        if (filters.ac) {
                          setAcSearchTerm(filters.ac);
                          handleFilterChange('ac', '');
                        }
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {filters.ac && (
                      <button
                        onClick={() => {
                          handleFilterChange('ac', '');
                          setAcSearchTerm('');
                          setShowACDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {showACDropdown && filteredACs.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredACs.map(ac => {
                        const isSelected = filters.ac === ac.name;
                        return (
                          <div
                            key={ac.name}
                            onClick={() => {
                              handleFilterChange('ac', ac.name);
                              setAcSearchTerm('');
                              setShowACDropdown(false);
                            }}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                              isSelected ? 'bg-[#E6F0F8]' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{ac.name}</div>
                                {ac.numericCode && (
                                  <div className="text-xs text-gray-500">AC Code: {ac.numericCode}</div>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle className="w-5 h-5 text-[#373177]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showACDropdown && acSearchTerm && filteredACs.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                      No ACs found matching "{acSearchTerm}"
                    </div>
                  )}
                </div>

                {/* Interviewer - Modern Multi-Select Search */}
                <div className="relative" ref={interviewerDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interviewer {filters.interviewerIds?.length > 0 && `(${filters.interviewerIds.length} selected)`}
                  </label>
                  
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by name, email, phone, or Member ID..."
                      value={interviewerSearchTerm}
                      onChange={(e) => {
                        setInterviewerSearchTerm(e.target.value);
                        setShowInterviewerDropdown(true);
                      }}
                      onFocus={() => setShowInterviewerDropdown(true)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {filters.interviewerIds?.length > 0 && (
                      <button
                        onClick={clearInterviewerFilters}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Clear all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Include/Exclude Toggle */}
                  {filters.interviewerIds?.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleInterviewerModeToggle('include')}
                        className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          filters.interviewerMode === 'include'
                            ? 'bg-[#001D48] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Include
                      </button>
                      <button
                        onClick={() => handleInterviewerModeToggle('exclude')}
                        className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          filters.interviewerMode === 'exclude'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Exclude
                      </button>
                    </div>
                  )}

                  {/* Selected Interviewers Chips */}
                  {filters.interviewerIds?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {filters.interviewerIds.map(interviewerId => {
                        const interviewer = allInterviewerObjects.find(i => i._id === interviewerId);
                        if (!interviewer) return null;
                        return (
                          <span
                            key={interviewerId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#E6F0F8] text-blue-800 text-xs rounded-full"
                          >
                            {interviewer.name}
                            <button
                              onClick={() => handleInterviewerToggle(interviewerId)}
                              className="hover:text-[#373177]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {showInterviewerDropdown && filteredInterviewers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredInterviewers.map(interviewer => {
                        const isSelected = filters.interviewerIds?.includes(interviewer._id);
                        return (
                          <div
                            key={interviewer._id}
                            onClick={() => {
                              handleInterviewerToggle(interviewer._id);
                            }}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                              isSelected ? 'bg-[#E6F0F8]' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{interviewer.name}</div>
                                <div className="text-xs text-gray-500 space-x-2">
                                  {interviewer.email && <span>{interviewer.email}</span>}
                                  {interviewer.phone && <span>• {interviewer.phone}</span>}
                                  {interviewer.memberID && <span>• Member ID: {interviewer.memberID}</span>}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle className="w-5 h-5 text-[#373177]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showInterviewerDropdown && interviewerSearchTerm && filteredInterviewers.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                      No interviewers found matching "{interviewerSearchTerm}"
                    </div>
                  )}
                </div>

                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      placeholder="Search by name..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={filters.gender}
                    onChange={(e) => handleFilterChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Genders</option>
                    {getFilterOptions.gender.map(gender => (
                      <option key={gender} value={gender}>{gender}</option>
                    ))}
                  </select>
                </div>

                {/* Age Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age Range
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={filters.ageMin}
                      onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                      placeholder="Min"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      value={filters.ageMax}
                      onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                      placeholder="Max"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>


                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <select
                    value={filters.city}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Cities</option>
                    {getFilterOptions.city.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District
                  </label>
                  <select
                    value={filters.district}
                    onChange={(e) => handleFilterChange('district', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Districts</option>
                    {getFilterOptions.district.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                {/* Lok Sabha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lok Sabha
                  </label>
                  <select
                    value={filters.lokSabha}
                    onChange={(e) => handleFilterChange('lokSabha', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Lok Sabha</option>
                    {getFilterOptions.lokSabha.map(lokSabha => (
                      <option key={lokSabha} value={lokSabha}>{lokSabha}</option>
                    ))}
                  </select>
                </div>

                    {/* State */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <select
                        value={filters.state}
                        onChange={(e) => handleFilterChange('state', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All States</option>
                        {getFilterOptions.state.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>

                    {/* Interview Mode */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Interview Mode
                      </label>
                      <select
                        value={filters.interviewMode}
                        onChange={(e) => handleFilterChange('interviewMode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Modes</option>
                        {getFilterOptions.interviewMode.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Clear All Filters
                </button>
                
                <div className="text-sm text-gray-600">
                  Showing {filteredResponses.length} of {originalResponses.length} responses
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
          {filteredResponses.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No responses found</h3>
              <p className="text-gray-600">
                {originalResponses.length === 0 
                  ? 'This survey has no responses yet.'
                  : 'Try adjusting your filters to see more results.'
                }
              </p>
            </div>
          ) : (
            <div className="bg-white shadow-sm border border-gray-200 overflow-hidden w-full">
              {/* Table Header */}
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b border-gray-200 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-gray-900">Survey Responses</h3>
                  <div className="text-sm text-gray-600">
                    {filteredResponses.length} of {originalResponses.length} responses
                    {totalTablePages > 1 && (
                      <span className="ml-2 text-gray-500">
                        (Page {tablePagination.currentPage} of {totalTablePages})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                        S.No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-48">
                        Respondent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell w-32">
                        Demographics
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell w-48">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                        Interviewer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                        GPS
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                        Mode
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedResponses.map((response, index) => {
                      const respondentInfo = getRespondentInfo(response.responses, response);
                      const actualIndex = (tablePagination.currentPage - 1) * tablePagination.pageSize + index + 1;
                      return (
                        <tr key={response._id} className="hover:bg-gray-50 transition-colors">
                          {/* S.No */}
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {actualIndex}
                          </td>
                          
                          {/* Respondent */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-[#E6F0F8] flex items-center justify-center">
                                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#373177]" />
                                </div>
                              </div>
                              <div className="ml-2 sm:ml-4">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {respondentInfo.name}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-500">
                                  ID: {response.responseId || response._id?.slice(-8)}
                                </div>
                                {/* Show demographics on mobile */}
                                <div className="sm:hidden mt-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F0F8] text-blue-800">
                                      {respondentInfo.gender}
                                    </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Age: {respondentInfo.age}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Demographics - Hidden on mobile */}
                          <td className="px-4 py-4 hidden sm:table-cell">
                            <div className="text-sm text-gray-900">
                              <div className="flex flex-col space-y-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E6F0F8] text-blue-800 w-fit">
                                  {respondentInfo.gender}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                  Age: {respondentInfo.age}
                                </span>
                              </div>
                            </div>
                          </td>
                          
                          {/* Location - Hidden on small screens */}
                          <td className="px-4 py-4 hidden md:table-cell">
                            <div className="text-sm text-gray-900">
                              {response.selectedPollingStation ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium truncate">{response.selectedPollingStation.acName || response.selectedAC || respondentInfo.ac}</span>
                                  </div>
                                  {response.selectedPollingStation.district && (
                                    <div className="text-xs text-gray-500 truncate">
                                      {response.selectedPollingStation.district}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500 truncate">
                                    {response.selectedPollingStation.state || getStateFromGPS(response.location)}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium truncate">{response.selectedAC || respondentInfo.ac}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {response.location?.city || respondentInfo.city}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {respondentInfo.district}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Interviewer - Hidden on small/medium screens */}
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <div className="text-sm text-gray-900">
                              <div className="font-medium truncate">
                                {response.interviewer ? `${response.interviewer.firstName} ${response.interviewer.lastName}` : 'N/A'}
                              </div>
                              {response.interviewer?.email && (
                                <div className="text-xs text-gray-500 truncate">
                                  {response.interviewer.email}
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Date - Hidden on small/medium/large screens */}
                          <td className="px-4 py-4 hidden xl:table-cell">
                            <div className="text-sm text-gray-900">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>{new Date(response.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(response.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          
                          {/* GPS - Hidden on small/medium/large screens */}
                          <td className="px-4 py-4 hidden xl:table-cell">
                            {response.location ? (
                              <div className="text-sm text-gray-900">
                                <div className="font-mono text-xs">
                                  {response.location.latitude?.toFixed(4)}, {response.location.longitude?.toFixed(4)}
                                </div>
                                <div className="text-xs text-green-600">
                                  ✓ GPS
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">
                                <div className="text-xs">No GPS</div>
                              </div>
                            )}
                          </td>
                          
                          {/* Interview Mode - Hidden on small/medium/large screens */}
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <div className="text-sm text-gray-900">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                response.interviewMode?.toUpperCase() === 'CAPI' 
                                  ? 'bg-[#E6F0F8] text-blue-800' 
                                  : response.interviewMode?.toUpperCase() === 'CATI'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {response.interviewMode?.toUpperCase() || 'N/A'}
                              </span>
                            </div>
                          </td>
                          
                          {/* Actions */}
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleViewResponse(response)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 text-[#373177] hover:text-blue-800 hover:bg-[#E6F0F8] rounded-md transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalTablePages > 1 && (
                <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => handleTablePageChange(tablePagination.currentPage - 1)}
                        disabled={tablePagination.currentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handleTablePageChange(tablePagination.currentPage + 1)}
                        disabled={tablePagination.currentPage === totalTablePages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing{' '}
                          <span className="font-medium">
                            {(tablePagination.currentPage - 1) * tablePagination.pageSize + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-medium">
                            {Math.min(tablePagination.currentPage * tablePagination.pageSize, filteredResponses.length)}
                          </span>{' '}
                          of{' '}
                          <span className="font-medium">{filteredResponses.length}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => handleTablePageChange(tablePagination.currentPage - 1)}
                            disabled={tablePagination.currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          {[...Array(totalTablePages)].map((_, i) => {
                            const page = i + 1;
                            // Show first page, last page, current page, and pages around current
                            if (
                              page === 1 ||
                              page === totalTablePages ||
                              (page >= tablePagination.currentPage - 1 && page <= tablePagination.currentPage + 1)
                            ) {
                              return (
                                <button
                                  key={page}
                                  onClick={() => handleTablePageChange(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    page === tablePagination.currentPage
                                      ? 'z-10 bg-[#E6F0F8] border-blue-500 text-[#373177]'
                                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            } else if (page === tablePagination.currentPage - 2 || page === tablePagination.currentPage + 2) {
                              return (
                                <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                              );
                            }
                            return null;
                          })}
                          <button
                            onClick={() => handleTablePageChange(tablePagination.currentPage + 1)}
                            disabled={tablePagination.currentPage === totalTablePages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Response Details Modal */}
      {showResponseDetails && selectedResponse && (
        <ResponseDetailsModal
          response={selectedResponse}
          survey={survey}
          onClose={() => {
            setShowResponseDetails(false);
            setSelectedResponse(null);
          }}
        />
      )}

      {/* Download Mode Selection Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Choose Download Format</h3>
            <p className="text-sm text-gray-600 mb-6">
              Select how you want to download the responses:
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => generateCSV('responses')}
                className="w-full px-4 py-3 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
              >
                <div className="font-medium">Download Responses</div>
                <div className="text-sm text-blue-100 mt-1">
                  Download with full response text (e.g., "Male", "Female", "Others")
                </div>
              </button>
              
              <button
                onClick={() => generateCSV('codes')}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-left"
              >
                <div className="font-medium">Download Response Codes</div>
                <div className="text-sm text-green-100 mt-1">
                  Download with option codes for MCQ questions (e.g., "1", "2", "3")
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowDownloadModal(false)}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ViewResponsesPage;
