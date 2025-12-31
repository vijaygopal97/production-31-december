import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search,
  Filter,
  BarChart3,
  Users,
  CheckCircle,
  AlertCircle,
  Eye,
  FileText,
  Calendar,
  TrendingUp,
  Target,
  Phone
} from 'lucide-react';
import { surveyAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const ProjectManagerSurveyReports = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalSurveys: 0,
    hasNext: false,
    hasPrev: false
  });

  useEffect(() => {
    fetchSurveys();
  }, [currentPage, pageSize, searchTerm, filterStatus]);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        status: filterStatus
      };
      
      const response = await surveyAPI.getSurveys(params);
      
      if (response.success) {
        setSurveys(response.data.surveys || []);
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
      showError('Failed to load surveys');
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleViewReports = (survey) => {
    navigate(`/project-manager/surveys/${survey._id || survey.id}/reports`);
  };

  const handleViewReportsV2 = (survey) => {
    navigate(`/project-manager/surveys/${survey._id || survey.id}/reports-2`);
  };

  const handleViewQCPerformance = (survey) => {
    navigate(`/project-manager/surveys/${survey._id || survey.id}/qc-performance`);
  };

  const handleViewResponses = (survey) => {
    navigate(`/project-manager/surveys/${survey._id || survey.id}/responses`);
  };

  const handleViewResponsesV2 = (survey) => {
    navigate(`/project-manager/surveys/${survey._id || survey.id}/responses-v2`);
  };

  const handleViewCallerPerformance = (survey) => {
    navigate(`/project-manager/surveys/${survey._id || survey.id}/caller-performance`);
  };

  const filteredSurveys = surveys.filter(survey => {
    const matchesSearch = !searchTerm || 
      (survey.surveyName || survey.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || survey.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Survey Reports</h1>
        <p className="text-gray-600 mt-1">View reports and QC performance for your company surveys</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>

      {/* Surveys List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredSurveys.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No surveys found</h3>
            <p className="text-gray-600">
              {searchTerm || filterStatus 
                ? 'Try adjusting your search or filters'
                : 'No surveys available in your company'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      Survey Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Responses
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSurveys.map((survey) => (
                    <tr key={survey._id || survey.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={survey.surveyName || survey.title || 'Untitled Survey'}>
                          {survey.surveyName || survey.title || 'Untitled Survey'}
                        </div>
                        {survey.description && (
                          <div className="text-xs text-gray-500 mt-1 truncate max-w-xs" title={survey.description}>
                            {survey.description.length > 40 
                              ? `${survey.description.substring(0, 40)}...`
                              : survey.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(survey.status)}`}>
                          {survey.status || 'draft'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {survey.responses || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {survey.createdAt 
                          ? new Date(survey.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex flex-col items-end space-y-2">
                          {/* Reports button hidden to encourage use of Reports V2 */}
                          {/* <button
                            onClick={() => handleViewReports(survey)}
                            className="inline-flex items-center px-3 py-1.5 bg-[#001D48] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <BarChart3 className="w-4 h-4 mr-1.5" />
                            Reports
                          </button> */}
                          <button
                            onClick={() => handleViewReportsV2(survey)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            title="View Optimized Reports V2"
                          >
                            <TrendingUp className="w-4 h-4 mr-1.5" />
                            Reports-V2
                          </button>
                          <button
                            onClick={() => handleViewCallerPerformance(survey)}
                            className="inline-flex items-center px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
                            title="View Caller Performance"
                          >
                            <Phone className="w-4 h-4 mr-1.5" />
                            Caller Performance
                          </button>
                          {/* Responses button hidden to encourage use of Responses V2 */}
                          {/* <button
                            onClick={() => handleViewResponses(survey)}
                            className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            Responses
                          </button> */}
                          <button
                            onClick={() => handleViewResponsesV2(survey)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            title="View Optimized Responses V2"
                          >
                            <TrendingUp className="w-4 h-4 mr-1.5" />
                            Responses-V2
                          </button>
                          <button
                            onClick={() => handleViewQCPerformance(survey)}
                            className="inline-flex items-center px-3 py-1.5 bg-[#373177] text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <Users className="w-4 h-4 mr-1.5" />
                            QC Performance
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.currentPage - 1) * pageSize) + 1} to {Math.min(pagination.currentPage * pageSize, pagination.totalSurveys)} of {pagination.totalSurveys} surveys
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={!pagination.hasPrev}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={!pagination.hasNext}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectManagerSurveyReports;

