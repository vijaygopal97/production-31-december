import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { surveyAPI, surveyResponseAPI } from '../services/api';
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Users,
  Target,
  CheckCircle,
  FileText,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Loader2,
  Menu,
  X
} from 'lucide-react';

const FindingsDashboard = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError } = useToast();
  
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState('fieldwork-progress');
  const [expandedSections, setExpandedSections] = useState({
    demographics: false,
    findings: false
  });
  
  // Stats for FieldWork Progress
  const [fieldworkStats, setFieldworkStats] = useState({
    targetSample: 0,
    interviewsAttempted: 0,
    interviewsAchieved: 0
  });

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    try {
      setLoading(true);
      const response = await surveyAPI.getSurvey(surveyId);
      console.log('🔍 FindingsDashboard - Full API response:', response);
      if (response.success) {
        // Backend returns { success: true, data: { survey } }
        const surveyData = response.data?.survey || response.data;
        console.log('🔍 FindingsDashboard - Survey data extracted:', surveyData);
        console.log('🔍 FindingsDashboard - Sample size:', surveyData?.sampleSize);
        setSurvey(surveyData);
        // Fetch stats after survey is loaded
        await fetchFieldworkStats(surveyData);
      } else {
        showError('Failed to load survey data');
      }
    } catch (error) {
      console.error('Error fetching survey:', error);
      showError('Failed to load survey data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldworkStats = async (surveyData = null) => {
    try {
      // Use passed surveyData or current survey state
      const currentSurvey = surveyData || survey;
      
      // Debug: Log survey data
      console.log('🔍 FindingsDashboard - Survey data for target sample:', {
        surveyId,
        hasSurvey: !!currentSurvey,
        sampleSize: currentSurvey?.sampleSize,
        sampleSizeType: typeof currentSurvey?.sampleSize,
        surveyKeys: currentSurvey ? Object.keys(currentSurvey) : [],
        fullSurvey: currentSurvey
      });
      
      // Fetch all responses with status Approved, Rejected, or Pending_Approval
      const params = {
        page: 1,
        limit: 10000, // Get all responses
        status: 'approved_rejected_pending'
      };
      
      const response = await surveyResponseAPI.getSurveyResponses(surveyId, params);
      
      if (response.success) {
        const responses = response.data.responses || [];
        
        // Calculate stats
        const interviewsAttempted = responses.length; // All responses (Approved, Rejected, Pending_Approval)
        const interviewsAchieved = responses.filter(r => r.status === 'Approved').length;
        
        // Get target sample from survey - use sampleSize field (same as surveys page)
        // Try multiple possible field names
        const targetSample = currentSurvey?.sampleSize 
          ? Number(currentSurvey.sampleSize) 
          : currentSurvey?.targetSampleSize 
          ? Number(currentSurvey.targetSampleSize)
          : 0;
        
        console.log('🔍 FindingsDashboard - Calculated stats:', {
          targetSample,
          interviewsAttempted,
          interviewsAchieved
        });
        
        setFieldworkStats({
          targetSample,
          interviewsAttempted,
          interviewsAchieved
        });
      }
    } catch (error) {
      console.error('Error fetching fieldwork stats:', error);
      showError('Failed to load fieldwork statistics');
    }
  };

  // Update stats when survey state changes
  useEffect(() => {
    if (survey && surveyId) {
      fetchFieldworkStats(survey);
    }
  }, [survey?.sampleSize, surveyId]); // Only re-fetch if sampleSize changes

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handlePageChange = (page) => {
    setActivePage(page);
  };

  const menuItems = [
    {
      id: 'fieldwork-progress',
      label: 'FieldWork Progress',
      icon: BarChart3,
      isDefault: true
    },
    {
      id: 'demographics',
      label: 'Demographics',
      icon: Users,
      hasSubmenu: true,
      submenu: [
        { id: 'basic-demographics', label: 'Basic Demographics' },
        { id: 'caste', label: 'Caste' }
      ]
    },
    {
      id: 'findings',
      label: 'Findings',
      icon: TrendingUp,
      hasSubmenu: true,
      submenu: [
        { id: 'vote-share-estimates', label: 'Vote Share Estimates' },
        { id: 'gain-and-losses', label: 'Gain and Losses' },
        { id: 'second-choice', label: 'Second Choice' },
        { id: 'approval-ratings', label: 'Approval Ratings' },
        { id: 'wisdom-of-crowds', label: 'Wisdom of Crowds' }
      ]
    }
  ];

  const renderPageContent = () => {
    switch (activePage) {
      case 'fieldwork-progress':
        return <FieldWorkProgressPage stats={fieldworkStats} />;
      case 'basic-demographics':
      case 'caste':
      case 'vote-share-estimates':
      case 'gain-and-losses':
      case 'second-choice':
      case 'approval-ratings':
      case 'wisdom-of-crowds':
        return <ComingSoonPage pageName={activePage} />;
      default:
        return <FieldWorkProgressPage stats={fieldworkStats} />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#373177] animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading Findings Dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!survey) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Survey not found</h3>
            <p className="text-gray-600 mb-4">The requested survey could not be found.</p>
            <button
              onClick={() => navigate('/company/surveys')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Surveys</span>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col min-h-full relative -m-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <button
                onClick={() => navigate('/company/surveys')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Surveys</span>
              </button>
              <div className="h-6 w-px bg-gray-300 hidden sm:block flex-shrink-0"></div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
                  {survey.surveyName || survey.name || 'Survey Findings'}
                </h1>
                <p className="text-sm text-gray-600">Findings Dashboard</p>
              </div>
            </div>
            
            {/* Toggle Right Sidebar Button - Fixed Position */}
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0 ml-4"
              title={rightSidebarOpen ? 'Hide Menu' : 'Show Menu'}
            >
              {rightSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Main Content Area - Full Width */}
        <div className="relative w-full px-6 pb-6 mt-6">
          {/* Main Content - Always Full Width */}
          <div className="w-full">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {renderPageContent()}
            </div>
          </div>

          {/* Right Sidebar - Overlay - Completely Hidden When Closed */}
          <div
            className={`fixed top-0 right-0 h-screen bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
              rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            } w-80 overflow-y-auto`}
            style={{ top: '64px' }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-gray-200 z-10">
                <h2 className="text-lg font-semibold text-gray-900">Findings Menu</h2>
                <button
                  onClick={() => setRightSidebarOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1 mt-4">
                {menuItems.map((item) => (
                  <div key={item.id}>
                    {item.hasSubmenu ? (
                      <div>
                        <button
                          onClick={() => toggleSection(item.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                            expandedSections[item.id]
                              ? 'bg-[#E6F0F8] text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                          </div>
                          {expandedSections[item.id] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        {expandedSections[item.id] && (
                          <div className="ml-8 mt-1 space-y-1">
                            {item.submenu.map((subItem) => (
                              <button
                                key={subItem.id}
                                onClick={() => handlePageChange(subItem.id)}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                                  activePage === subItem.id
                                    ? 'bg-[#E6F0F8] text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {subItem.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePageChange(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                          activePage === item.id
                            ? 'bg-[#E6F0F8] text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Overlay for mobile when sidebar is open */}
          {rightSidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setRightSidebarOpen(false)}
              style={{ top: '64px' }}
            ></div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

// FieldWork Progress Page Component
const FieldWorkProgressPage = ({ stats }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">FieldWork Progress</h2>
        <p className="text-gray-600">Overview of survey fieldwork completion status</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Target Sample */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#E6F0F8]0 rounded-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Target Sample</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.targetSample.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Target sample size for this survey</p>
        </div>

        {/* Interviews Attempted */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#E8E6F5]0 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Interviews Attempted</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.interviewsAttempted.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">
            Total responses (Approved, Rejected, Pending)
          </p>
        </div>

        {/* Interviews Achieved */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Interviews Achieved</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.interviewsAchieved.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Approved responses only</p>
        </div>
      </div>

      {/* Progress Bar */}
      {stats.targetSample > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Completion Progress</span>
            <span className="text-sm font-medium text-gray-700">
              {((stats.interviewsAchieved / stats.targetSample) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((stats.interviewsAchieved / stats.targetSample) * 100, 100)}%`
              }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{stats.interviewsAchieved.toLocaleString()} of {stats.targetSample.toLocaleString()} completed</span>
            <span>
              {stats.targetSample - stats.interviewsAchieved > 0
                ? `${(stats.targetSample - stats.interviewsAchieved).toLocaleString()} remaining`
                : 'Target achieved!'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Coming Soon Page Component
const ComingSoonPage = ({ pageName }) => {
  const pageNames = {
    'basic-demographics': 'Basic Demographics',
    'caste': 'Caste',
    'vote-share-estimates': 'Vote Share Estimates',
    'gain-and-losses': 'Gain and Losses',
    'second-choice': 'Second Choice',
    'approval-ratings': 'Approval Ratings',
    'wisdom-of-crowds': 'Wisdom of Crowds'
  };

  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center">
        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {pageNames[pageName] || 'Page'}
        </h3>
        <p className="text-gray-600">This section is coming soon.</p>
      </div>
    </div>
  );
};

export default FindingsDashboard;

