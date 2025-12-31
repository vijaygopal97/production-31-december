import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { 
  Search,
  Filter,
  Eye,
  Play,
  X,
  Calendar,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Star,
  Award,
  TrendingUp,
  Loader
} from 'lucide-react';
import { surveyAPI } from '../../services/api';
import InterviewInterface from './InterviewInterface';

const AvailableSurveys = () => {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState('assignedAt'); // Default: latest assigned first
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [showSurveyDetails, setShowSurveyDetails] = useState(false);
  const [showInterviewInterface, setShowInterviewInterface] = useState(false);
  const [interviewSurvey, setInterviewSurvey] = useState(null);
  const [showCatiModal, setShowCatiModal] = useState(false);
  const [catiSurvey, setCatiSurvey] = useState(null);
  const { showSuccess, showError } = useToast();

  // Fetch available interviews for the logged-in interviewer
  useEffect(() => {
    fetchAvailableSurveys();
  }, [searchTerm, filterStatus, filterCategory, sortBy, sortOrder]);

  const fetchAvailableSurveys = async () => {
    try {
      setLoading(true);
      const response = await surveyAPI.getAvailableSurveys({
        search: searchTerm,
        status: filterStatus,
        category: filterCategory,
        sortBy,
        sortOrder
      });
      
      if (response.success) {
        setSurveys(response.data.surveys);
      } else {
        showError('Failed to fetch available surveys');
      }
    } catch (error) {
      console.error('Error fetching available surveys:', error);
      showError('Failed to fetch available surveys');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned':
        return 'bg-[#E6F0F8] text-[#001D48]';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'assigned':
        return <Clock className="w-4 h-4" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'declined':
      case 'rejected':
        return <X className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'capi':
        return '👥'; // Face to face
      case 'cati':
        return '📞'; // Telephonic
      case 'online':
        return '💻'; // Online
      default:
        return '📋';
    }
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'capi':
        return 'CAPI (Face to Face)';
      case 'cati':
        return 'CATI (Telephonic)';
      case 'online':
        return 'Online';
      default:
        return mode;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'capi':
        return 'bg-[#E6F0F8] text-[#001D48] border-blue-200';
      case 'cati':
        return 'bg-[#E8E6F5] text-purple-800 border-purple-200';
      case 'online':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysRemaining = (deadline) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getCompletionPercentage = (survey) => {
    if (!survey.analytics || !survey.sampleSize) return 0;
    const completed = survey.analytics.completedResponses || 0;
    return Math.round((completed / survey.sampleSize) * 100);
  };

  const handleStartInterview = (survey) => {
    // Check survey mode and route accordingly
    const isCAPI = survey.mode === 'capi' || survey.assignedMode === 'capi';
    const isCATI = survey.mode === 'cati' || survey.assignedMode === 'cati';
    const isMultiMode = survey.mode === 'multi_mode';
    
    if (isCAPI && !isMultiMode) {
      // Single CAPI mode - show mobile app message
      showError('CAPI interviews must be conducted using the Convergent Interviewer mobile app. Please download and use the mobile app to start CAPI interviews.');
    } else if (isCATI || (isMultiMode && survey.assignedMode === 'cati')) {
      // CATI mode - start CATI interview interface
      setInterviewSurvey(survey);
      setShowInterviewInterface(true);
    } else if (isMultiMode && survey.assignedMode === 'capi') {
      // Multi-mode with CAPI assignment - show mobile app message
      showError('CAPI interviews must be conducted using the Convergent Interviewer mobile app. Please download and use the mobile app to start CAPI interviews.');
    } else {
      // Other modes - show coming soon message
      showError(`${getModeLabel(survey.mode)} interviews are coming soon!`);
    }
  };

  const handleInterviewComplete = (completionData) => {
    // Toast message is already shown in InterviewInterface, no need to show another one
    // Refresh the surveys list to update completion status
    fetchAvailableSurveys();
  };

  const handleCloseInterview = () => {
    setShowInterviewInterface(false);
    setInterviewSurvey(null);
  };

  const handleCloseCatiModal = () => {
    setShowCatiModal(false);
    setCatiSurvey(null);
  };

  const handleCatiStartInterview = async () => {
    if (!catiSurvey) return;
    
    try {
      // Start CATI interview - this will open the CATI interview interface
      setInterviewSurvey(catiSurvey);
      setShowCatiModal(false);
      setShowInterviewInterface(true);
    } catch (error) {
      showError('Failed to start CATI interview', error.message || 'An error occurred');
    }
  };

  const handleViewDetails = (survey) => {
    setSelectedSurvey(survey);
    setShowSurveyDetails(true);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredSurveys = surveys.filter(survey => {
    const matchesSearch = !searchTerm || 
      survey.surveyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !filterStatus || survey.assignmentStatus === filterStatus;
    const matchesCategory = !filterCategory || survey.category === filterCategory;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Available Interviews</h1>
        <p className="text-gray-600">Browse and manage your assigned interview opportunities</p>
      </div>

      {/* Stats Overview */}
      <div className="mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assigned</p>
              <p className="text-2xl font-bold text-gray-900">{surveys.length}</p>
            </div>
            <div className="p-3 bg-[#E6F0F8] rounded-lg">
              <FileText className="h-6 w-6 text-[#001D48]" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="assigned">Assigned</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              <option value="Consumer Research">Consumer Research</option>
              <option value="Market Analysis">Market Analysis</option>
              <option value="Brand Awareness">Brand Awareness</option>
              <option value="Product Testing">Product Testing</option>
              <option value="Customer Satisfaction">Customer Satisfaction</option>
              <option value="Employee Feedback">Employee Feedback</option>
              <option value="Healthcare Research">Healthcare Research</option>
              <option value="Education Research">Education Research</option>
              <option value="Social Research">Social Research</option>
              <option value="Political Research">Political Research</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="assignedAt-desc">Latest Assigned</option>
              <option value="assignedAt-asc">Oldest Assigned</option>
              <option value="deadline-asc">Deadline (Soonest)</option>
              <option value="deadline-desc">Deadline (Latest)</option>
              <option value="surveyName-asc">Name (A-Z)</option>
              <option value="surveyName-desc">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Surveys List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <Loader className="w-6 h-6 animate-spin text-[#001D48]" />
              <span className="text-gray-600">Loading available surveys...</span>
            </div>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys available</h3>
            <p className="text-gray-600">
              {searchTerm || filterStatus || filterCategory 
                ? 'No surveys match your current filters.' 
                : 'You don\'t have any assigned surveys yet.'}
            </p>
          </div>
        ) : (
          filteredSurveys.map((survey) => (
            <div key={survey._id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-xl font-semibold text-gray-900">{survey.surveyName}</h3>
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(survey.assignmentStatus)}`}>
                      {getStatusIcon(survey.assignmentStatus)}
                      <span className="capitalize">{survey.assignmentStatus}</span>
                    </span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getModeColor(survey.mode)}`}>
                      {getModeLabel(survey.mode)}
                    </span>
                    {survey.assignedMode && survey.assignedMode !== 'single' && (
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getModeColor(survey.assignedMode)}`}>
                        {getModeLabel(survey.assignedMode)}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">{survey.description}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{survey.sampleSize?.toLocaleString() || 0}</div>
                      <p className="text-xs text-gray-600">Sample Size</p>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{getCompletionPercentage(survey)}%</div>
                      <p className="text-xs text-gray-600">Completion</p>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{getDaysRemaining(survey.deadline)}</div>
                      <p className="text-xs text-gray-600">Days Left</p>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">₹{survey.costPerInterview || 0}</div>
                      <p className="text-xs text-gray-600">Per Interview</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Assigned: {formatDateTime(survey.assignedAt)}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Target className="w-4 h-4" />
                        <span>Deadline: {formatDate(survey.deadline)}</span>
                      </span>
                      <span>•</span>
                      <span>{survey.category}</span>
                    </div>
                  </div>

                  {/* Assigned ACs */}
                  {survey.assignedACs && survey.assignedACs.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Assigned Areas:</span>
                        <div className="flex flex-wrap gap-1">
                          {survey.assignedACs.map((ac, index) => (
                            <span key={index} className="px-2 py-1 bg-[#E6F0F8] text-[#001D48] text-xs rounded-full">
                              {ac}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gender Requirements */}
                  {survey.targetAudience?.demographics?.Gender && survey.targetAudience?.demographics?.genderRequirements && (
                    <div className="mt-3">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Gender Requirements:</span>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const requirements = survey.targetAudience.demographics.genderRequirements;
                            const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                            
                            return selectedGenders.map(gender => {
                              const percentage = requirements[`${gender}Percentage`];
                              // If only one gender is selected and no percentage is set, show 100%
                              const displayPercentage = selectedGenders.length === 1 && !percentage ? 100 : (percentage || 0);
                              return (
                                <span key={gender} className="px-2 py-1 bg-[#E8E6F5] text-purple-800 text-xs rounded-full">
                                  {gender}: {displayPercentage}%
                                </span>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-6">
                  <button
                    onClick={() => handleViewDetails(survey)}
                    className="flex items-center space-x-2 px-4 py-2 text-[#001D48] border border-[#001D48] rounded-lg hover:bg-[#E6F0F8] transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>See Full Info</span>
                  </button>
                  
                  {survey.assignmentStatus === 'assigned' && (
                    <>
                      {survey.mode === 'multi_mode' ? (
                        // Multi-mode survey - show separate buttons for CAPI and CATI
                        <div className="flex flex-col space-y-2">
                          {survey.assignedMode === 'capi' && (
                            <div className="px-4 py-3 bg-[#E6F0F8] border border-blue-200 rounded-lg">
                              <div className="flex items-center space-x-2 text-[#001D48]">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Mobile App Required</span>
                              </div>
                              <p className="text-xs text-[#001D48] mt-1">
                                Open Convergent Interviewer App to Start CAPI Interviews
                              </p>
                            </div>
                          )}
                          
                          {(survey.assignedMode === 'cati' || (survey.mode === 'cati')) && (
                            <button
                              onClick={() => handleStartInterview(survey)}
                              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Play className="w-4 h-4" />
                              <span>Start CATI Interview</span>
                            </button>
                          )}
                          
                        </div>
                      ) : (survey.mode === 'capi' || survey.assignedMode === 'capi') ? (
                        // Single CAPI mode
                        <div className="flex flex-col space-y-2">
                          <div className="px-4 py-3 bg-[#E6F0F8] border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-[#001D48]">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">Mobile App Required</span>
                            </div>
                            <p className="text-xs text-[#001D48] mt-1">
                              Open Convergent Interviewer App to Start CAPI Interviews
                            </p>
                          </div>
                          
                        </div>
                      ) : (
                        // Other modes (CATI, online, etc.)
                        <>
                          <button
                            onClick={() => handleStartInterview(survey)}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            <span>Start Interview</span>
                          </button>
                          
                        </>
                      )}
                    </>
                  )}
                  
                  {survey.assignmentStatus === 'accepted' && (
                    <>
                      {survey.mode === 'multi_mode' ? (
                        // Multi-mode survey - show appropriate button based on assigned mode
                        survey.assignedMode === 'cati' || survey.assignedMode === 'capi' ? (
                          survey.assignedMode === 'cati' ? (
                            <button
                              onClick={() => handleStartInterview(survey)}
                              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Play className="w-4 h-4" />
                              <span>Start CATI Interview</span>
                            </button>
                          ) : (
                            <div className="px-4 py-3 bg-[#E6F0F8] border border-blue-200 rounded-lg">
                              <div className="flex items-center space-x-2 text-[#001D48]">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Mobile App Required</span>
                              </div>
                              <p className="text-xs text-[#001D48] mt-1">
                                Open Convergent Interviewer App to Start CAPI Interviews
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="px-4 py-3 bg-[#E6F0F8] border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-[#001D48]">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">Coming Soon</span>
                            </div>
                            <p className="text-xs text-[#001D48] mt-1">
                              CATI (Telephonic) interviews are coming soon!
                            </p>
                          </div>
                        )
                      ) : (survey.mode === 'capi' || survey.assignedMode === 'capi') ? (
                        <div className="px-4 py-3 bg-[#E6F0F8] border border-blue-200 rounded-lg">
                          <div className="flex items-center space-x-2 text-[#001D48]">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Mobile App Required</span>
                          </div>
                          <p className="text-xs text-[#001D48] mt-1">
                            Open Convergent Interviewer App to Start CAPI Interviews
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartInterview(survey)}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          <span>Start Interview</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Survey Details Modal */}
      {showSurveyDetails && selectedSurvey && (
        <SurveyDetailsModal
          survey={selectedSurvey}
          onClose={() => {
            setShowSurveyDetails(false);
            setSelectedSurvey(null);
          }}
        />
      )}


      {/* Interview Interface */}
      {showInterviewInterface && interviewSurvey && (
        <InterviewInterface
          survey={interviewSurvey}
          onClose={handleCloseInterview}
          onComplete={handleInterviewComplete}
        />
      )}

      {/* CATI Modal */}
      {showCatiModal && catiSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 transform transition-all duration-500 ease-out animate-in fade-in-0 zoom-in-95">
            <div className="text-center">
              {/* Animated Icon */}
              <div className="mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mx-auto flex items-center justify-center animate-pulse">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Telephonic Interview Ready
              </h2>

              {/* Survey Info */}
              <div className="bg-[#E8E6F5] rounded-xl p-4 mb-6 border border-purple-200">
                <h3 className="font-semibold text-purple-800 mb-2">{catiSurvey.surveyName}</h3>
                <p className="text-sm text-[#373177]">
                  {catiSurvey.sections?.reduce((total, section) => total + (section.questions?.length || 0), 0) || 0} questions • CATI (Telephonic) Mode
                </p>
              </div>

              {/* CATI-specific Instructions */}
              <div className="text-left mb-6 space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#E8E6F5] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#373177] text-sm font-semibold">1</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Ensure you have a stable phone connection before starting
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#E8E6F5] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#373177] text-sm font-semibold">2</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Speak clearly and ask questions exactly as written
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#E8E6F5] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#373177] text-sm font-semibold">3</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Record responses accurately and completely
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#E8E6F5] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#373177] text-sm font-semibold">4</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Maintain professional tone throughout the call
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#E8E6F5] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#373177] text-sm font-semibold">5</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Your responses will be automatically saved
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseCatiModal}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCatiStartInterview}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-[#373177] hover:to-pink-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Start Telephonic Interview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Survey Details Modal Component
const SurveyDetailsModal = ({ survey, onClose }) => {
  const [activeTab, setActiveTab] = useState('specifications');

  // Helper function to get operator description
  const getOperatorDescription = (operator) => {
    switch (operator) {
      case 'equals': return 'is exactly';
      case 'not_equals': return 'is not';
      case 'contains': return 'contains';
      case 'not_contains': return 'does not contain';
      case 'greater_than': return 'is greater than';
      case 'less_than': return 'is less than';
      case 'is_empty': return 'is empty';
      case 'is_not_empty': return 'is not empty';
      case 'is_selected': return 'is selected';
      case 'is_not_selected': return 'is not selected';
      default: return operator;
    }
  };

  // Helper function to find question by ID
  const findQuestionById = (questionId) => {
    if (survey.sections) {
      for (const section of survey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.id === questionId) {
              return question;
            }
          }
        }
      }
    }
    if (survey.questions) {
      for (const question of survey.questions) {
        if (question.id === questionId) {
          return question;
        }
      }
    }
    return null;
  };

  // Helper function to format conditional logic
  const formatConditionalLogic = (conditions) => {
    if (!conditions || conditions.length === 0) return null;
    
    const formattedConditions = conditions
      .filter(condition => condition.questionId && condition.operator && condition.value !== undefined && condition.value !== '__NOVALUE__')
      .map((condition, index) => {
        const targetQuestion = findQuestionById(condition.questionId);
        const targetQuestionText = targetQuestion ? targetQuestion.text : `Question ${condition.questionId}`;
        const operator = getOperatorDescription(condition.operator);
        const value = condition.value;
        
        return `${targetQuestionText} ${operator} "${value}"`;
      });

    if (formattedConditions.length === 0) return null;
    
    return formattedConditions.join(' AND ');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'capi':
        return 'CAPI (Face to Face)';
      case 'cati':
        return 'CATI (Telephonic)';
      case 'online':
        return 'Online';
      default:
        return mode;
    }
  };

  const getDaysRemaining = (deadline) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-[#E6F0F8] text-[#001D48] border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'capi':
        return 'bg-[#E6F0F8] text-[#001D48] border-blue-200';
      case 'cati':
        return 'bg-[#E8E6F5] text-purple-800 border-purple-200';
      case 'online':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[95vh] flex flex-col border border-gray-100">
        {/* Modal Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
          <div className="p-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h1 className="text-3xl font-bold text-gray-900">{survey.surveyName}</h1>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(survey.status)}`}>
                    {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Target className="w-4 h-4" />
                    <span>{survey.category}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-md border ${getModeColor(survey.mode)}`}>
                      {getModeLabel(survey.mode)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{survey.sampleSize?.toLocaleString() || 0} samples</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-all duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('specifications')}
              className={`px-8 py-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
                activeTab === 'specifications'
                  ? 'border-blue-500 text-[#001D48] bg-[#E6F0F8]/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Survey Details</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('questionnaire')}
              className={`px-8 py-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
                activeTab === 'questionnaire'
                  ? 'border-blue-500 text-[#001D48] bg-[#E6F0F8]/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Questionnaire</span>
              </div>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30 min-h-0">
          <div className="p-8">
            {activeTab === 'specifications' && (
              <div className="space-y-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-[#E6F0F8] rounded-lg">
                        <Calendar className="w-5 h-5 text-[#001D48]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Start Date</p>
                        <p className="text-lg font-semibold text-gray-900">{formatDate(survey.startDate)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <Clock className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Deadline</p>
                        <p className="text-lg font-semibold text-gray-900">{formatDate(survey.deadline)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Days Remaining</p>
                        <p className="text-lg font-semibold text-gray-900">{getDaysRemaining(survey.deadline)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-[#E8E6F5] rounded-lg">
                        <DollarSign className="w-5 h-5 text-[#373177]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Cost per Interview</p>
                        <p className="text-lg font-semibold text-gray-900">₹{survey.costPerInterview || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Survey Description</span>
                  </h3>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-700 leading-relaxed">{survey.description}</p>
                    {survey.purpose && (
                      <div className="mt-4 p-4 bg-[#E6F0F8] rounded-lg border border-blue-200">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2">Purpose</h4>
                        <p className="text-[#001D48]">{survey.purpose}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment Information */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                    <MapPin className="w-5 h-5" />
                    <span>Assignment Details</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Assignment Information</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Assigned At</span>
                          <span className="text-sm font-medium text-gray-900">{formatDateTime(survey.assignedAt)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Assignment Status</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(survey.assignmentStatus)}`}>
                            {survey.assignmentStatus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">State</span>
                          <span className="text-sm font-medium text-gray-900">{survey.selectedState || 'Not specified'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Progress Tracking</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Max Interviews</span>
                          <span className="text-sm font-medium text-gray-900">{survey.maxInterviews || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Completed</span>
                          <span className="text-sm font-medium text-gray-900">{survey.completedInterviews || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm text-gray-600">Remaining</span>
                          <span className="text-sm font-medium text-gray-900">
                            {(survey.maxInterviews || 0) - (survey.completedInterviews || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Areas */}
                {survey.assignedACs && survey.assignedACs.length > 0 && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <MapPin className="w-5 h-5" />
                      <span>Assigned Areas</span>
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {survey.assignedACs.map((ac, index) => (
                        <span key={index} className="px-4 py-2 bg-[#E6F0F8] text-blue-700 text-sm font-medium rounded-lg border border-blue-200 hover:bg-[#E6F0F8] transition-colors">
                          {ac}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Audience Requirements */}
                {survey.targetAudience && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Target Audience Requirements</span>
                    </h3>
                    
                    <div className="space-y-6">
                      {/* Demographics */}
                      {survey.targetAudience.demographics && Object.keys(survey.targetAudience.demographics).some(key => 
                        survey.targetAudience.demographics[key] && typeof survey.targetAudience.demographics[key] === 'boolean'
                      ) && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <Users className="w-4 h-4" />
                            <span>Demographics</span>
                          </h4>
                          <div className="space-y-4">
                            
                            {/* Age Group */}
                            {survey.targetAudience.demographics['Age Group'] && survey.targetAudience.demographics.ageRange && (
                              <div className="p-4 bg-[#E6F0F8] rounded-lg border border-blue-200">
                                <h5 className="text-sm font-medium text-blue-900 mb-2">Age Range</h5>
                                <div className="flex items-center space-x-4">
                                  <span className="text-sm text-blue-700">
                                    {survey.targetAudience.demographics.ageRange.min || 'Not specified'} - {survey.targetAudience.demographics.ageRange.max || 'Not specified'} years
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Gender Requirements */}
                            {survey.targetAudience.demographics['Gender'] && survey.targetAudience.demographics.genderRequirements && (
                              <div className="p-4 bg-[#E8E6F5] rounded-lg border border-purple-200">
                                <h5 className="text-sm font-medium text-purple-900 mb-3">Gender Distribution</h5>
                                <div className="space-y-2">
                                  {(() => {
                                    const requirements = survey.targetAudience.demographics.genderRequirements;
                                    const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                                    
                                    return selectedGenders.map(gender => {
                                      const percentage = requirements[`${gender}Percentage`];
                                      const displayPercentage = selectedGenders.length === 1 && !percentage ? 100 : (percentage || 0);
                                      return (
                                        <div key={gender} className="flex items-center justify-between">
                                          <span className="text-sm text-purple-700">{gender}</span>
                                          <span className="text-sm font-semibold text-purple-900">{displayPercentage}%</span>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            )}

                            {/* Income Level */}
                            {survey.targetAudience.demographics['Income Level'] && survey.targetAudience.demographics.incomeRange && (
                              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <h5 className="text-sm font-medium text-green-900 mb-2">Income Range</h5>
                                <div className="flex items-center space-x-4">
                                  <span className="text-sm text-green-700">
                                    ₹{survey.targetAudience.demographics.incomeRange.min?.toLocaleString() || 'Not specified'} - ₹{survey.targetAudience.demographics.incomeRange.max?.toLocaleString() || 'Not specified'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Education */}
                            {survey.targetAudience.demographics['Education'] && survey.targetAudience.demographics.educationRequirements && (
                              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h5 className="text-sm font-medium text-yellow-900 mb-3">Education Level</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.demographics.educationRequirements)
                                    .filter(edu => survey.targetAudience.demographics.educationRequirements[edu])
                                    .map(education => (
                                      <span key={education} className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                        {education}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Occupation */}
                            {survey.targetAudience.demographics['Occupation'] && survey.targetAudience.demographics.occupationRequirements && (
                              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                <h5 className="text-sm font-medium text-indigo-900 mb-2">Occupation Requirements</h5>
                                <p className="text-sm text-indigo-700">{survey.targetAudience.demographics.occupationRequirements}</p>
                              </div>
                            )}

                            {/* Marital Status */}
                            {survey.targetAudience.demographics['Marital Status'] && survey.targetAudience.demographics.maritalStatusRequirements && (
                              <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                                <h5 className="text-sm font-medium text-pink-900 mb-3">Marital Status</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.demographics.maritalStatusRequirements)
                                    .filter(status => survey.targetAudience.demographics.maritalStatusRequirements[status])
                                    .map(status => (
                                      <span key={status} className="px-3 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">
                                        {status}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Family Size */}
                            {survey.targetAudience.demographics['Family Size'] && survey.targetAudience.demographics.familySizeRange && (
                              <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                                <h5 className="text-sm font-medium text-teal-900 mb-2">Family Size Range</h5>
                                <div className="flex items-center space-x-4">
                                  <span className="text-sm text-teal-700">
                                    {survey.targetAudience.demographics.familySizeRange.min || 'Not specified'} - {survey.targetAudience.demographics.familySizeRange.max || 'Not specified'} members
                                  </span>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {/* Geographic */}
                      {survey.targetAudience.geographic && Object.keys(survey.targetAudience.geographic).some(key => 
                        survey.targetAudience.geographic[key] && typeof survey.targetAudience.geographic[key] === 'boolean'
                      ) && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <MapPin className="w-4 h-4" />
                            <span>Geographic Targeting</span>
                          </h4>
                          <div className="space-y-4">
                            
                            {/* Country */}
                            {survey.targetAudience.geographic['Country'] && survey.targetAudience.geographic.countryRequirements && (
                              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <h5 className="text-sm font-medium text-green-900 mb-2">Target Countries</h5>
                                <p className="text-sm text-green-700">{survey.targetAudience.geographic.countryRequirements}</p>
                              </div>
                            )}

                            {/* State/Province */}
                            {survey.targetAudience.geographic['State/Province'] && survey.targetAudience.geographic.stateRequirements && (
                              <div className="p-4 bg-[#E6F0F8] rounded-lg border border-blue-200">
                                <h5 className="text-sm font-medium text-blue-900 mb-2">Target States/Provinces</h5>
                                <p className="text-sm text-blue-700">{survey.targetAudience.geographic.stateRequirements}</p>
                              </div>
                            )}

                            {/* City */}
                            {survey.targetAudience.geographic['City'] && survey.targetAudience.geographic.cityRequirements && (
                              <div className="p-4 bg-[#E8E6F5] rounded-lg border border-purple-200">
                                <h5 className="text-sm font-medium text-purple-900 mb-2">Target Cities</h5>
                                <p className="text-sm text-purple-700">{survey.targetAudience.geographic.cityRequirements}</p>
                              </div>
                            )}

                            {/* Urban/Rural */}
                            {survey.targetAudience.geographic['Urban/Rural'] && survey.targetAudience.geographic.areaTypeRequirements && (
                              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <h5 className="text-sm font-medium text-orange-900 mb-3">Area Type</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.geographic.areaTypeRequirements)
                                    .filter(area => survey.targetAudience.geographic.areaTypeRequirements[area])
                                    .map(area => (
                                      <span key={area} className="px-3 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                        {area}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Postal Code */}
                            {survey.targetAudience.geographic['Postal Code'] && survey.targetAudience.geographic.postalCodeRequirements && (
                              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <h5 className="text-sm font-medium text-gray-900 mb-2">Postal Code Requirements</h5>
                                <p className="text-sm text-gray-700">{survey.targetAudience.geographic.postalCodeRequirements}</p>
                              </div>
                            )}

                            {/* Timezone */}
                            {survey.targetAudience.geographic['Timezone'] && survey.targetAudience.geographic.timezoneRequirements && (
                              <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                                <h5 className="text-sm font-medium text-cyan-900 mb-3">Timezone Requirements</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.geographic.timezoneRequirements)
                                    .filter(tz => survey.targetAudience.geographic.timezoneRequirements[tz])
                                    .map(timezone => (
                                      <span key={timezone} className="px-3 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-full">
                                        {timezone}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {/* Behavioral */}
                      {survey.targetAudience.behavioral && Object.keys(survey.targetAudience.behavioral).some(key => 
                        survey.targetAudience.behavioral[key] && typeof survey.targetAudience.behavioral[key] === 'boolean'
                      ) && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <BarChart3 className="w-4 h-4" />
                            <span>Behavioral Criteria</span>
                          </h4>
                          <div className="space-y-4">
                            
                            {/* Purchase Behavior */}
                            {survey.targetAudience.behavioral['Purchase Behavior'] && survey.targetAudience.behavioral.purchaseBehaviorRequirements && (
                              <div className="p-4 bg-[#E8E6F5] rounded-lg border border-purple-200">
                                <h5 className="text-sm font-medium text-purple-900 mb-3">Purchase Behavior</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.behavioral.purchaseBehaviorRequirements)
                                    .filter(behavior => survey.targetAudience.behavioral.purchaseBehaviorRequirements[behavior])
                                    .map(behavior => (
                                      <span key={behavior} className="px-3 py-1 bg-[#E8E6F5] text-purple-800 text-xs rounded-full">
                                        {behavior}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Brand Loyalty */}
                            {survey.targetAudience.behavioral['Brand Loyalty'] && survey.targetAudience.behavioral.brandLoyaltyRequirements && (
                              <div className="p-4 bg-[#E6F0F8] rounded-lg border border-blue-200">
                                <h5 className="text-sm font-medium text-blue-900 mb-3">Brand Loyalty Level</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.behavioral.brandLoyaltyRequirements)
                                    .filter(loyalty => survey.targetAudience.behavioral.brandLoyaltyRequirements[loyalty])
                                    .map(loyalty => (
                                      <span key={loyalty} className="px-3 py-1 bg-[#E6F0F8] text-[#001D48] text-xs rounded-full">
                                        {loyalty}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Online Activity */}
                            {survey.targetAudience.behavioral['Online Activity'] && survey.targetAudience.behavioral.onlineActivityRequirements && (
                              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <h5 className="text-sm font-medium text-green-900 mb-3">Online Activity Level</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.behavioral.onlineActivityRequirements)
                                    .filter(activity => survey.targetAudience.behavioral.onlineActivityRequirements[activity])
                                    .map(activity => (
                                      <span key={activity} className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                        {activity}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Shopping Frequency */}
                            {survey.targetAudience.behavioral['Shopping Frequency'] && survey.targetAudience.behavioral.shoppingFrequencyRequirements && (
                              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h5 className="text-sm font-medium text-yellow-900 mb-3">Shopping Frequency</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.behavioral.shoppingFrequencyRequirements)
                                    .filter(frequency => survey.targetAudience.behavioral.shoppingFrequencyRequirements[frequency])
                                    .map(frequency => (
                                      <span key={frequency} className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                        {frequency}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Media Consumption */}
                            {survey.targetAudience.behavioral['Media Consumption'] && survey.targetAudience.behavioral.mediaConsumptionRequirements && (
                              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                <h5 className="text-sm font-medium text-red-900 mb-3">Media Consumption</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.behavioral.mediaConsumptionRequirements)
                                    .filter(media => survey.targetAudience.behavioral.mediaConsumptionRequirements[media])
                                    .map(media => (
                                      <span key={media} className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                        {media}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Technology Usage */}
                            {survey.targetAudience.behavioral['Technology Usage'] && survey.targetAudience.behavioral.technologyUsageRequirements && (
                              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                <h5 className="text-sm font-medium text-indigo-900 mb-3">Technology Usage Level</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.behavioral.technologyUsageRequirements)
                                    .filter(tech => survey.targetAudience.behavioral.technologyUsageRequirements[tech])
                                    .map(tech => (
                                      <span key={tech} className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                                        {tech}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {/* Psychographic */}
                      {survey.targetAudience.psychographic && Object.keys(survey.targetAudience.psychographic).some(key => 
                        survey.targetAudience.psychographic[key] && typeof survey.targetAudience.psychographic[key] === 'boolean'
                      ) && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <Filter className="w-4 h-4" />
                            <span>Psychographic Segmentation</span>
                          </h4>
                          <div className="space-y-4">
                            
                            {/* Lifestyle */}
                            {survey.targetAudience.psychographic['Lifestyle'] && survey.targetAudience.psychographic.lifestyleRequirements && (
                              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <h5 className="text-sm font-medium text-orange-900 mb-3">Lifestyle Preferences</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.psychographic.lifestyleRequirements)
                                    .filter(lifestyle => survey.targetAudience.psychographic.lifestyleRequirements[lifestyle])
                                    .map(lifestyle => (
                                      <span key={lifestyle} className="px-3 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                        {lifestyle}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Values */}
                            {survey.targetAudience.psychographic['Values'] && survey.targetAudience.psychographic.valuesRequirements && (
                              <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                                <h5 className="text-sm font-medium text-pink-900 mb-3">Core Values</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.psychographic.valuesRequirements)
                                    .filter(value => survey.targetAudience.psychographic.valuesRequirements[value])
                                    .map(value => (
                                      <span key={value} className="px-3 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">
                                        {value}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Interests */}
                            {survey.targetAudience.psychographic['Interests'] && survey.targetAudience.psychographic.interestsRequirements && (
                              <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                                <h5 className="text-sm font-medium text-teal-900 mb-3">Interest Areas</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.psychographic.interestsRequirements)
                                    .filter(interest => survey.targetAudience.psychographic.interestsRequirements[interest])
                                    .map(interest => (
                                      <span key={interest} className="px-3 py-1 bg-teal-100 text-teal-800 text-xs rounded-full">
                                        {interest}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Personality Traits */}
                            {survey.targetAudience.psychographic['Personality Traits'] && survey.targetAudience.psychographic.personalityRequirements && (
                              <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                                <h5 className="text-sm font-medium text-violet-900 mb-3">Personality Characteristics</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.psychographic.personalityRequirements)
                                    .filter(trait => survey.targetAudience.psychographic.personalityRequirements[trait])
                                    .map(trait => (
                                      <span key={trait} className="px-3 py-1 bg-violet-100 text-violet-800 text-xs rounded-full">
                                        {trait}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Attitudes */}
                            {survey.targetAudience.psychographic['Attitudes'] && survey.targetAudience.psychographic.attitudesRequirements && (
                              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                <h5 className="text-sm font-medium text-amber-900 mb-3">Attitude Requirements</h5>
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(survey.targetAudience.psychographic.attitudesRequirements)
                                    .filter(attitude => survey.targetAudience.psychographic.attitudesRequirements[attitude])
                                    .map(attitude => (
                                      <span key={attitude} className="px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">
                                        {attitude}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Opinions */}
                            {survey.targetAudience.psychographic['Opinions'] && survey.targetAudience.psychographic.opinionsRequirements && (
                              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h5 className="text-sm font-medium text-slate-900 mb-2">Opinion Requirements</h5>
                                <p className="text-sm text-slate-700">{survey.targetAudience.psychographic.opinionsRequirements}</p>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {/* Custom Specifications */}
                      {survey.targetAudience.custom && survey.targetAudience.custom.trim() && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>Custom Specifications</span>
                          </h4>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-700">{survey.targetAudience.custom}</p>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* Analytics */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Survey Analytics</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {survey.analytics?.completedResponses || 0}
                      </div>
                      <div className="text-sm text-gray-600">Completed Responses</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {survey.sampleSize ? Math.round(((survey.analytics?.completedResponses || 0) / survey.sampleSize) * 100) : 0}%
                      </div>
                      <div className="text-sm text-gray-600">Completion Rate</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {survey.analytics?.averageCompletionTime || 0}m
                      </div>
                      <div className="text-sm text-gray-600">Avg. Completion Time</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'questionnaire' && (
              <div className="space-y-6">
                {survey.sections && survey.sections.length > 0 ? (
                  survey.sections.map((section, sectionIndex) => (
                    <div key={section.id || sectionIndex} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 border-b border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-[#E6F0F8] text-[#001D48] text-sm font-bold rounded-lg flex items-center justify-center">
                            {sectionIndex + 1}
                          </span>
                          <span>{section.title}</span>
                        </h3>
                        {section.description && (
                          <p className="text-gray-600 mt-2 ml-11">{section.description}</p>
                        )}
                      </div>
                      
                      <div className="p-6">
                        <div className="space-y-6">
                          {section.questions && section.questions.map((question, questionIndex) => (
                            <div key={question.id || questionIndex} className="border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors">
                              <div className="flex items-start space-x-4">
                                <span className="flex-shrink-0 w-7 h-7 bg-[#E6F0F8] text-[#001D48] text-sm font-semibold rounded-full flex items-center justify-center">
                                  {questionIndex + 1}
                                </span>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-3">
                                    <h4 className="text-base font-semibold text-gray-900 leading-relaxed">
                                      {question.text}
                                      {question.required && <span className="text-red-500 ml-1">*</span>}
                                    </h4>
                                    <div className="flex items-center space-x-2">
                                      {question.conditions && question.conditions.length > 0 && (
                                        <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md">
                                          <Zap className="w-3 h-3" />
                                          <span className="text-xs font-medium">Conditional</span>
                                        </div>
                                      )}
                                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md">
                                        {question.type.replace('_', ' ')}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {question.description && (
                                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">{question.description}</p>
                                  )}
                                  
                                  {/* Conditional Logic Display */}
                                  {question.conditions && question.conditions.length > 0 && (
                                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <Zap className="w-4 h-4 text-yellow-600" />
                                        <span className="text-sm font-medium text-yellow-800">Conditional Logic:</span>
                                      </div>
                                      <p className="text-sm text-yellow-700 leading-relaxed">
                                        This question will only appear when: {formatConditionalLogic(question.conditions)}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Options for multiple choice questions */}
                                  {question.options && question.options.length > 0 && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      <p className="text-sm font-medium text-gray-700 mb-3">Answer Options:</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {question.options.map((option, optionIndex) => (
                                          <div key={option.id || optionIndex} className="flex items-center space-x-2 p-2 bg-white rounded border border-gray-200">
                                            <span className="w-4 h-4 bg-[#E6F0F8] text-[#001D48] text-xs font-medium rounded-full flex items-center justify-center">
                                              {String.fromCharCode(65 + optionIndex)}
                                            </span>
                                            <span className="text-sm text-gray-700">{option.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Scale for rating questions */}
                                  {question.scale && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      <p className="text-sm font-medium text-gray-700 mb-2">Rating Scale:</p>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">{question.scale.min}</span>
                                        <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                          <div className="h-2 bg-[#E6F0F8]0 rounded-full"></div>
                                        </div>
                                        <span className="text-sm text-gray-600">{question.scale.max}</span>
                                      </div>
                                      {question.scale.minLabel && question.scale.maxLabel && (
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                          <span>{question.scale.minLabel}</span>
                                          <span>{question.scale.maxLabel}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : survey.questions && survey.questions.length > 0 ? (
                  <div className="space-y-4">
                    {survey.questions.map((question, questionIndex) => (
                      <div key={question.id || questionIndex} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors">
                        <div className="flex items-start space-x-4">
                          <span className="flex-shrink-0 w-7 h-7 bg-[#E6F0F8] text-[#001D48] text-sm font-semibold rounded-full flex items-center justify-center">
                            {questionIndex + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="text-base font-semibold text-gray-900 leading-relaxed">
                                {question.text}
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                              </h4>
                              <div className="flex items-center space-x-2">
                                {question.conditions && question.conditions.length > 0 && (
                                  <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md">
                                    <Zap className="w-3 h-3" />
                                    <span className="text-xs font-medium">Conditional</span>
                                  </div>
                                )}
                                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md">
                                  {question.type.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            {question.description && (
                              <p className="text-sm text-gray-600 mb-3 leading-relaxed">{question.description}</p>
                            )}
                            
                            {/* Conditional Logic Display */}
                            {question.conditions && question.conditions.length > 0 && (
                              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Zap className="w-4 h-4 text-yellow-600" />
                                  <span className="text-sm font-medium text-yellow-800">Conditional Logic:</span>
                                </div>
                                <p className="text-sm text-yellow-700 leading-relaxed">
                                  This question will only appear when: {formatConditionalLogic(question.conditions)}
                                </p>
                              </div>
                            )}
                            
                            {question.options && question.options.length > 0 && (
                              <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm font-medium text-gray-700 mb-3">Answer Options:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {question.options.map((option, optionIndex) => (
                                    <div key={option.id || optionIndex} className="flex items-center space-x-2 p-2 bg-white rounded border border-gray-200">
                                      <span className="w-4 h-4 bg-[#E6F0F8] text-[#001D48] text-xs font-medium rounded-full flex items-center justify-center">
                                        {String.fromCharCode(65 + optionIndex)}
                                      </span>
                                      <span className="text-sm text-gray-700">{option.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Questions Available</h3>
                    <p className="text-gray-600 max-w-md mx-auto">This survey doesn't have any questions configured yet. Please contact the survey administrator for more information.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailableSurveys;
