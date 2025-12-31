import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { 
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Calendar,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Archive,
  Download,
  Share2,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  DollarSign,
  Target,
  FileText,
  Zap,
  TrendingUp,
  Brain
} from 'lucide-react';
import SurveyBuilder from './SurveyBuilder';
import { surveyAPI } from '../../services/api';

const CompanySurveysManagement = () => {
  const navigate = useNavigate();
  const [showSurveyBuilder, setShowSurveyBuilder] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [overallStats, setOverallStats] = useState({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
    totalCost: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showSurveyDetails, setShowSurveyDetails] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const { showSuccess, showError } = useToast();

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalSurveys: 0,
    hasNext: false,
    hasPrev: false
  });

  // Fetch overall statistics only once on initial load
  useEffect(() => {
    fetchOverallStats();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm) {
        setSearchLoading(true);
      }
      fetchSurveys();
    }, searchTerm ? 500 : 0); // 500ms delay for search, immediate for other changes

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchTerm, filterStatus, filterCategory]);


  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'completed':
        return 'bg-[#E6F0F8] text-[#001D48]';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <Play className="w-4 h-4" />;
      case 'draft':
        return <Edit className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'paused':
        return <Pause className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'home_interviewer':
        return '🏠';
      case 'gig_interviewer':
        return '👥';
      case 'online_interview':
        return '🌐';
      case 'ai_telephonic':
        return '📞';
      case 'capi':
        return '📱';
      case 'cati':
        return '📞';
      case 'multi_mode':
        return '🔄';
      default:
        return '📋';
    }
  };

  const getModeDisplayText = (mode) => {
    switch (mode) {
      case 'home_interviewer':
        return 'Home Interviewer';
      case 'gig_interviewer':
        return 'Gig Interviewer';
      case 'online_interview':
        return 'Online Interview';
      case 'ai_telephonic':
        return 'AI Telephonic';
      case 'capi':
        return 'CAPI';
      case 'cati':
        return 'CATI';
      case 'multi_mode':
        return 'Multi-Mode';
      default:
        return 'Standard';
    }
  };

  // Client-side filtering is now handled by the backend
  // We'll use the surveys array directly as it's already filtered by the API
  const displayedSurveys = surveys;

  const handleSurveyAction = (surveyId, action) => {
    // Action triggered for survey
    
    if (action === 'view') {
      const survey = surveys.find(s => (s._id || s.id) === surveyId);
      if (survey) {
        setSelectedSurvey(survey);
        setShowSurveyDetails(true);
      }
    } else if (action === 'edit') {
      const survey = surveys.find(s => (s._id || s.id) === surveyId);
      if (survey) {
        // Survey data loaded for editing
        
        // Clean up any null interviewer references before passing to SurveyBuilder
        const cleanedSurvey = {
          ...survey,
          assignedInterviewers: survey.assignedInterviewers ? 
            survey.assignedInterviewers.filter(assignment => assignment.interviewer && assignment.interviewer._id) : []
        };
        
        // Survey data cleaned and ready for editing
        setEditingSurvey(cleanedSurvey);
        setShowSurveyBuilder(true);
      }
    } else if (action === 'reports') {
      // Navigate to survey reports page
      navigate(`/company/surveys/${surveyId}/reports`);
    } else if (action === 'qc-batches') {
      // Navigate to QC batches page
      navigate(`/company/surveys/${surveyId}/qc-batches`);
    } else if (action === 'findings') {
      // Navigate to Findings Dashboard page
      navigate(`/company/surveys/${surveyId}/findings`);
    } else {
      // Implement other survey actions
      // Action not implemented yet
    }
  };

  const handleCreateSurvey = () => {
    setEditingSurvey(null);
    setShowSurveyBuilder(true);
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Search handler with debouncing
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Filter handlers
  const handleStatusFilter = (status) => {
    setFilterStatus(status);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleCategoryFilter = (category) => {
    setFilterCategory(category);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleSurveyBuilderClose = () => {
    setShowSurveyBuilder(false);
    setEditingSurvey(null);
    fetchSurveys(); // Refresh the surveys list
    fetchOverallStats(); // Refresh overall statistics
  };

  const handleViewResponses = (survey) => {
    navigate(`/company/surveys/${survey._id || survey.id}/responses`);
  };

  const handleQCPerformance = (survey) => {
    navigate(`/company/surveys/${survey._id || survey.id}/qc-performance`);
  };

  const handleDeleteSurvey = async (surveyId) => {
    try {
      // Deleting survey
      const response = await surveyAPI.deleteSurvey(surveyId);
      if (response.success) {
        // Survey deleted successfully
        fetchSurveys(); // Refresh the surveys list
        fetchOverallStats(); // Refresh overall statistics
        setDeleteConfirm(null);
        // Show success toast message
        showSuccess(
          'Survey Deleted!',
          'The survey has been successfully deleted.',
          4000
        );
      }
    } catch (error) {
      console.error('Error deleting survey:', error);
      // Show error toast message
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete survey';
      showError(
        'Delete Failed',
        errorMessage,
        6000
      );
      setDeleteConfirm(null); // Close the confirmation modal
    }
  };


  // Fetch overall statistics (unfiltered)
  const fetchOverallStats = async () => {
    try {
      // Fetching overall statistics
      const response = await surveyAPI.getSurveys({ limit: 1000 }); // Get all surveys for stats
      
      if (response.success && response.data.surveys) {
        const allSurveys = response.data.surveys;
        const stats = {
          totalSurveys: allSurveys.length,
          activeSurveys: allSurveys.filter(s => s.status === 'active').length,
          totalResponses: allSurveys.reduce((sum, s) => sum + (s.responses || 0), 0),
          totalCost: allSurveys.reduce((sum, s) => sum + (s.cost || 0), 0)
        };
        setOverallStats(stats);
        // Overall stats loaded successfully
      }
    } catch (error) {
      console.error('Error fetching overall stats:', error);
    }
  };

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        status: filterStatus,
        category: filterCategory
      };
      
      const response = await surveyAPI.getSurveys(params);
      
      if (response.success) {
        setSurveys(response.data.surveys || []);
        
        // Transform backend pagination format to frontend format
        const backendPagination = response.data.pagination || {};
        setPagination({
          currentPage: backendPagination.current || 1,
          totalPages: backendPagination.pages || 1,
          totalSurveys: backendPagination.total || 0,
          hasNext: (backendPagination.current || 1) < (backendPagination.pages || 1),
          hasPrev: (backendPagination.current || 1) > 1
        });
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
      // Set empty state on error
      setSurveys([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalSurveys: 0,
        hasNext: false,
        hasPrev: false
      });
    } finally {
      setLoading(false);
      setSearchLoading(false);
      setInitialLoad(false);
    }
  };

  // Only show full-screen loading on initial load, not during search/filter
  if (initialLoad && loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading surveys...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Survey Management</h1>
            <p className="text-gray-600">Create, manage, and monitor your company's surveys</p>
          </div>
          
          <button
            onClick={handleCreateSurvey}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Survey</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Surveys</p>
              <p className="text-2xl font-bold text-gray-900">{overallStats.totalSurveys}</p>
            </div>
            <div className="p-3 bg-[#E6F0F8] rounded-lg">
              <BarChart3 className="w-6 h-6 text-[#001D48]" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Surveys</p>
              <p className="text-2xl font-bold text-green-600">
                {overallStats.activeSurveys}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Responses</p>
              <p className="text-2xl font-bold text-[#373177]">
                {overallStats.totalResponses.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-[#E8E6F5] rounded-lg">
              <Users className="w-6 h-6 text-[#373177]" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-orange-600">
                ₹{overallStats.totalCost.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#001D48]"></div>
              </div>
            )}
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div>
            <select
              value={filterCategory}
              onChange={(e) => handleCategoryFilter(e.target.value)}
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

          <div className="flex space-x-2">
            <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              <span>More Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Surveys List */}
      <div className="relative">
        {/* Loading overlay for search/filter operations */}
        {(loading || searchLoading) && !initialLoad && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-xl">
            <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#001D48]"></div>
              <span className="text-gray-600 text-sm">
                {searchLoading ? 'Searching...' : 'Loading...'}
              </span>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          {displayedSurveys.map((survey) => (
          <div key={survey._id || survey.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{survey.surveyName || survey.name}</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(survey.status)}`}>
                    {getStatusIcon(survey.status)}
                    <span className="capitalize">{survey.status}</span>
                  </span>
                </div>
                
                {/* Interview Mode Display */}
                <div className="mb-3">
                  <span className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium bg-[#E6F0F8] text-[#001D48] rounded-full">
                    <span>{getModeDisplayText(survey.mode)}</span>
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4">{survey.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{(survey.analytics?.totalResponses || 0).toLocaleString()}</div>
                    <p className="text-xs text-gray-600">Approved Responses</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{survey.analytics?.completionRate || 0}%</div>
                    <p className="text-xs text-gray-600">Completion</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{survey.analytics?.assignedInterviewersCount || 0}</div>
                    <p className="text-xs text-gray-600">Interviewers</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">-</div>
                    <p className="text-xs text-gray-600">Budget</p>
                  </div>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <span>Created by {survey.createdBy?.firstName} {survey.createdBy?.lastName}</span>
                    <span>•</span>
                    <span>{survey.category}</span>
                    <span>•</span>
                    <span>Ends {new Date(survey.deadline).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Target: {survey.sampleSize?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>
              
              {/* Vertical Action Buttons */}
              <div className="flex flex-col space-y-2 ml-4">
                {/* View Responses and QC Performance Buttons - Always show */}
                <>
                  <button
                    onClick={() => handleViewResponses(survey)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    title="View Responses"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>View Responses</span>
                  </button>
                  <button
                    onClick={() => handleQCPerformance(survey)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#E8E6F5] text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                    title="QC Performance"
                  >
                    <Target className="w-4 h-4" />
                    <span>QC Performance</span>
                  </button>
                </>
                
                {/* Action Buttons Row 1 */}
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleSurveyAction(survey._id || survey.id, 'view')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#E6F0F8] text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                    title="View Survey"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleSurveyAction(survey._id || survey.id, 'edit')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    title="Edit Survey"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                </div>
                
                {/* Action Buttons Row 2 */}
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleSurveyAction(survey._id || survey.id, 'reports')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#E8E6F5] text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                    title="View Reports"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Reports</span>
                  </button>
                  <button
                    onClick={() => handleSurveyAction(survey._id || survey.id, 'qc-batches')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                    title="View QC Batches"
                  >
                    <FileText className="w-4 h-4" />
                    <span>QC Batches</span>
                  </button>
                  <button
                    onClick={() => handleSurveyAction(survey._id || survey.id, 'findings')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                    title="View Findings"
                  >
                    <Brain className="w-4 h-4" />
                    <span>Findings</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(survey._id || survey.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                    title="Delete Survey"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
                
                {/* More Options Button - Commented out for now */}
                {/* <div className="flex justify-center">
                  <button
                    onClick={() => handleSurveyAction(survey._id || survey.id, 'more')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    title="More Options"
                  >
                    <MoreVertical className="w-4 h-4" />
                    <span>More</span>
                  </button>
                </div> */}
              </div>
            </div>
          </div>
          ))}
        </div>
      </div>

      {/* No Results */}
      {displayedSurveys.length === 0 && !loading && !initialLoad && (
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys found</h3>
          <p className="text-gray-600 mb-6">Try adjusting your search criteria or create a new survey</p>
          <button
            onClick={handleCreateSurvey}
            className="flex items-center space-x-2 px-6 py-3 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Create Your First Survey</span>
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {displayedSurveys.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                Showing {displayedSurveys.length} of {pagination.totalSurveys} surveys
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            {/* Pagination Navigation */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = pagination.currentPage <= 3 
                    ? i + 1 
                    : pagination.currentPage + i - 2;
                  
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 border rounded-lg transition-colors ${
                        pageNum === pagination.currentPage
                          ? 'bg-[#001D48] text-white border-[#001D48]'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNext}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Survey Builder Modal */}
      {showSurveyBuilder && (
        <SurveyBuilder
          editingSurvey={editingSurvey}
          onClose={handleSurveyBuilderClose}
        />
      )}

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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Delete Survey</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this survey? This action cannot be undone and will permanently remove all survey data.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSurvey(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
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
                  <h1 className="text-3xl font-bold text-gray-900">{survey.surveyName || survey.name}</h1>
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

export default CompanySurveysManagement;
