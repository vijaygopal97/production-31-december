import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Filter, 
  Download, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Calendar,
  User,
  MapPin,
  BarChart3
} from 'lucide-react';
import { surveyResponseAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ResponseDetailsModal from './ResponseDetailsModal';
import assemblyConstituenciesData from '../../data/assemblyConstituencies.json';

const ViewResponsesModal = ({ survey, onClose }) => {
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
    lokSabha: []
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'Approved',
    gender: '',
    ageMin: '',
    ageMax: '',
    ac: '',
    city: '',
    district: '',
    lokSabha: '',
    state: ''
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const { showError } = useToast();

  // Load assembly constituencies data
  const [assemblyConstituencies, setAssemblyConstituencies] = useState({});
  
  // Import assembly constituencies data directly (bundled in build)
  import assemblyConstituenciesData from '../../data/assemblyConstituencies.json';

  useEffect(() => {
    // Data is already loaded via import, no need to fetch
    setAssemblyConstituencies(assemblyConstituenciesData);
  }, []);

  // Fetch responses (without filters - get all data for client-side filtering)
  const fetchResponses = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 1000, // Get all responses for client-side filtering
        status: 'Approved' // Only get approved responses
      };
      
      const response = await surveyResponseAPI.getSurveyResponses(survey._id, params);
      
      if (response.success) {
        setOriginalResponses(response.data.responses); // Store original unfiltered data
        setResponses(response.data.responses); // Set current responses
        setPagination(response.data.pagination);
        setFilterOptions(response.data.filterOptions);
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      showError('Failed to load responses', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (survey) {
      fetchResponses();
    }
  }, [survey]); // Remove filters dependency - we'll do client-side filtering

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'Approved',
      gender: '',
      ageMin: '',
      ageMax: '',
      ac: '',
      city: '',
      district: '',
      lokSabha: '',
      state: ''
    });
  };

  // Handle pagination
  const handlePageChange = (page) => {
    fetchResponses(page);
  };

  // Handle view full response
  const handleViewFullResponse = (response) => {
    setSelectedResponse(response);
    setShowResponseDetails(true);
  };

  // Download CSV
  const handleDownloadCSV = async () => {
    try {
      const params = {
        page: 1,
        limit: 10000, // Get all responses
        ...filters
      };
      
      const response = await surveyResponseAPI.getSurveyResponses(survey._id, params);
      
      if (response.success && response.data.responses.length > 0) {
        // Create CSV content
        const csvContent = createCSVContent(response.data.responses, survey);
        
        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${survey.surveyName}_responses.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
      showError('Failed to download CSV', error.message);
    }
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

  // Create CSV content
  const createCSVContent = (responses, survey) => {
    const headers = [
      'Response ID', 
      'Respondent Name',
      'Gender',
      'Age',
      'City',
      'District',
      'State',
      'Assembly Constituency',
      'Parliamentary Constituency (PC)',
      'Polling Station Code',
      'Polling Station Name',
      'GPS Coordinates',
      'Interviewer', 
      'Date', 
      'Status'
    ];
    
    // Filter out AC selection and polling station questions
    const regularQuestions = survey.questions ? survey.questions.filter(q => !isACOrPollingStationQuestion(q)) : [];
    
    // Add regular survey questions as headers (excluding AC and polling station)
    regularQuestions.forEach((question, index) => {
      headers.push(`Q${index + 1}: ${question.text}`);
    });
    
    const rows = responses.map(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const gpsCoords = response.location?.coordinates 
        ? `${response.location.coordinates.latitude?.toFixed(4)}, ${response.location.coordinates.longitude?.toFixed(4)}`
        : 'N/A';
      
      // Extract AC and polling station from responses
      const { ac: acFromResponse, pollingStation: pollingStationFromResponse } = getACAndPollingStationFromResponses(response.responses);
      
      // Get AC, PC, and District
      const displayAC = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || respondentInfo.ac || 'N/A';
      
      // Get PC: Priority 1 - selectedPollingStation.pcName, Priority 2 - getLokSabhaFromAC
      let displayPC = response.selectedPollingStation?.pcName || 'N/A';
      if (displayPC === 'N/A' && displayAC !== 'N/A') {
        displayPC = getLokSabhaFromAC(displayAC);
      }
      
      // Get District: Priority 1 - selectedPollingStation.district, Priority 2 - getDistrictFromAC, Priority 3 - respondentInfo.district
      let displayDistrict = response.selectedPollingStation?.district || 'N/A';
      if (displayDistrict === 'N/A' && displayAC !== 'N/A') {
        displayDistrict = getDistrictFromAC(displayAC);
      }
      if (displayDistrict === 'N/A') {
        displayDistrict = respondentInfo.district || 'N/A';
      }
      
      // Extract polling station code and name
      const pollingStationValue = pollingStationFromResponse || response.selectedPollingStation?.stationName;
      const { stationCode, stationName } = extractPollingStationCodeAndName(pollingStationValue, response.selectedPollingStation);
      
      const row = [
        response._id,
        respondentInfo.name,
        respondentInfo.gender,
        respondentInfo.age,
        response.location?.city || respondentInfo.city,
        displayDistrict,
        getStateFromGPS(response.location),
        displayAC,
        displayPC,
        stationCode,
        stationName,
        gpsCoords,
        response.interviewer ? `${response.interviewer.firstName} ${response.interviewer.lastName}` : 'N/A',
        new Date(response.createdAt).toLocaleDateString(),
        response.status
      ];
      
      // Add response data for regular questions only
      regularQuestions.forEach(question => {
          const questionResponse = response.responses[question.id];
          if (questionResponse) {
            if (question.type === 'multiple_choice' && question.options) {
              // Check if this is an "Others: [specified text]" response
              if (typeof questionResponse === 'string' && questionResponse.startsWith('Others: ')) {
                row.push(questionResponse); // Return as-is (e.g., "Others: Custom text")
              } else if (Array.isArray(questionResponse)) {
                // Handle array responses
                const displayTexts = questionResponse.map((val) => {
                  if (typeof val === 'string' && val.startsWith('Others: ')) {
                    return val;
                  }
                  const option = question.options.find((opt) => opt.value === val);
                  return option ? option.text : val;
                });
                row.push(displayTexts.join(', '));
              } else {
                // Find the option text for the selected value
                const option = question.options.find((opt) => opt.value === questionResponse);
                row.push(option ? option.text : questionResponse);
              }
            } else if (question.type === 'rating' && typeof questionResponse === 'number') {
              // Handle rating responses with labels
              const scale = question.scale || {};
              const labels = scale.labels || [];
              const min = scale.min || 1;
              const label = labels[questionResponse - min];
              if (label) {
                row.push(`${questionResponse} (${label})`);
              } else {
                row.push(questionResponse);
              }
            } else {
              row.push(questionResponse);
            }
          } else {
            row.push('');
          }
      });
      
      return row;
    });
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
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

  // Helper function to extract respondent info from responses array
  const getRespondentInfo = (responses, responseData) => {
    if (!responses || !Array.isArray(responses)) {
      return { name: 'N/A', gender: 'N/A', age: 'N/A', city: 'N/A', district: 'N/A', ac: 'N/A', lokSabha: 'N/A' };
    }

    const nameResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('name') || 
      r.questionText.toLowerCase().includes('respondent') ||
      r.questionText.toLowerCase().includes('full name')
    );
    
    const genderResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('gender') || 
      r.questionText.toLowerCase().includes('sex')
    );
    
    const ageResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('age') || 
      r.questionText.toLowerCase().includes('year')
    );

    const acResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('assembly') ||
      r.questionText.toLowerCase().includes('constituency')
    );

    const lokSabhaResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('lok sabha') ||
      r.questionText.toLowerCase().includes('parliament')
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

    return {
      name: nameResponse?.response || 'N/A',
      gender: genderResponse?.response || 'N/A',
      age: ageResponse?.response || 'N/A',
      city: city,
      district: district,
      ac: acName,
      lokSabha: lokSabhaResponse?.response || 'N/A'
    };
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

  // Helper function to get state from GPS location
  const getStateFromGPS = (location) => {
    if (location?.state) return location.state;
    if (location?.address?.state) return location.address.state;
    if (location?.administrative_area_level_1) return location.administrative_area_level_1;
    return 'N/A';
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
      state: new Set()
    };

    originalResponses.forEach(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const state = getStateFromGPS(response.location);
      const lokSabha = getLokSabhaFromAC(respondentInfo.ac);

      // console.log('📝 Processing response AC:', respondentInfo.ac, 'for respondent:', respondentInfo.name);

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
    });

    const result = {
      gender: Array.from(options.gender).sort(),
      age: Array.from(options.age).sort((a, b) => a - b),
      ac: Array.from(options.ac).sort(),
      city: Array.from(options.city).sort(),
      district: Array.from(options.district).sort(),
      lokSabha: Array.from(options.lokSabha).sort(),
      state: Array.from(options.state).sort()
    };

    // console.log('🎯 Generated filter options:', result);
    // console.log('🏛️ AC options:', result.ac);
    
    return result;
  }, [originalResponses]);

  // Filter responses based on current filters
  const filteredResponses = useMemo(() => {
    if (!originalResponses || originalResponses.length === 0) return [];

    // console.log('🔍 Filtering with filters:', filters);
    // console.log('📊 Total original responses:', originalResponses.length);

    return originalResponses.filter(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const state = getStateFromGPS(response.location);
      const lokSabha = getLokSabhaFromAC(respondentInfo.ac);

      // console.log('👤 Respondent info:', {
      //   name: respondentInfo.name,
      //   gender: respondentInfo.gender,
      //   age: respondentInfo.age,
      //   city: respondentInfo.city,
      //   district: respondentInfo.district,
      //   ac: respondentInfo.ac,
      //   state,
      //   lokSabha
      // });

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
      return true;
    });
  }, [originalResponses, filters]);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                View Responses - {survey?.surveyName}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {pagination.totalResponses} approved responses
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadCSV}
                className="flex items-center space-x-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-1 px-3 py-2 bg-[#E6F0F8] text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              {/* Search Bar */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by respondent name or interviewer name..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age Range</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.ageMin}
                      onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.ageMax}
                      onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assembly Constituency</label>
                  <select
                    value={filters.ac}
                    onChange={(e) => handleFilterChange('ac', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All ACs</option>
                    {getFilterOptions.ac.map(ac => (
                      <option key={ac} value={ac}>{ac}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lok Sabha</label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
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
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Showing {filteredResponses.length} of {responses.length} responses
                </div>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Responses...</h3>
                  <p className="text-gray-600">Please wait while we fetch the survey responses.</p>
                </div>
              </div>
            ) : responses.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Responses Found</h3>
                  <p className="text-gray-600">No approved responses match your current filters.</p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {filteredResponses.map((response, index) => {
                    const respondentInfo = getRespondentInfo(response.responses, response);
                    return (
                      <div key={response._id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Respondent Name - Prominent Display */}
                            <div className="mb-3">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {respondentInfo.name}
                              </h3>
                            </div>
                            
                            {/* Respondent Demographics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                              <div>
                                <span className="font-medium text-gray-700">Gender:</span>
                                <span className="ml-2 text-gray-600">{respondentInfo.gender}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Age:</span>
                                <span className="ml-2 text-gray-600">{respondentInfo.age}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">AC:</span>
                                <span className="ml-2 text-gray-600">{respondentInfo.ac}</span>
                              </div>
                            </div>
                            
                            {/* Location Information */}
                            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-2 mb-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-700">Location Details:</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="font-medium text-gray-600">City:</span>
                                  <span className="ml-2 text-gray-600">{response.location?.city || respondentInfo.city}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">District:</span>
                                  <span className="ml-2 text-gray-600">{respondentInfo.district}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">State:</span>
                                  <span className="ml-2 text-gray-600">{getStateFromGPS(response.location)}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">Lok Sabha:</span>
                                  <span className="ml-2 text-gray-600">{getLokSabhaFromAC(respondentInfo.ac)}</span>
                                </div>
                                {response.location?.coordinates && (
                                  <div className="md:col-span-2">
                                    <span className="font-medium text-gray-600">GPS Coordinates:</span>
                                    <span className="ml-2 text-gray-600 font-mono text-xs">
                                      ({response.location.coordinates.latitude?.toFixed(4)}, {response.location.coordinates.longitude?.toFixed(4)})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Interview Details */}
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span>
                                  <span className="font-medium">Interviewer:</span> {response.interviewer ? `${response.interviewer.firstName} ${response.interviewer.lastName}` : 'Unknown'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>{new Date(response.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleViewFullResponse(response)}
                              className="flex items-center space-x-1 px-3 py-2 bg-[#E6F0F8] text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View Full Response</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Showing {((pagination.currentPage - 1) * 10) + 1} to {Math.min(pagination.currentPage * 10, pagination.totalResponses)} of {pagination.totalResponses} responses
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={!pagination.hasPrev}
                        className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Previous</span>
                      </button>
                      
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-2 rounded-lg ${
                                page === pagination.currentPage
                                  ? 'bg-[#001D48] text-white'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={!pagination.hasNext}
                        className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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
    </>
  );
};

export default ViewResponsesModal;