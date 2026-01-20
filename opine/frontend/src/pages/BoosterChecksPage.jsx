import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  ArrowLeft,
  Filter, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Calendar,
  MapPin,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react';
import { surveyResponseAPI, surveyAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ResponseDetailsModal from '../components/dashboard/ResponseDetailsModal';

const BoosterChecksPage = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResponses: 0,
    hasNext: false,
    hasPrev: false
  });
  
  const [filters, setFilters] = useState({
    status: 'approved_rejected_pending',
    dateRange: 'today',
    startDate: '',
    endDate: '',
    ac: '',
    interviewerId: '',
    gpsCheck: '',
    interviewMode: 'capi'
  });
  
  const [showFilters, setShowFilters] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [fullResponseDetails, setFullResponseDetails] = useState(null);
  const [loadingResponseDetails, setLoadingResponseDetails] = useState(false);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [selectedResponses, setSelectedResponses] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const surveyResponse = await surveyAPI.getSurvey(surveyId);
        if (surveyResponse.success && isMountedRef.current) {
          setSurvey(surveyResponse.data);
        }
      } catch (error) {
        console.error('Error fetching survey:', error);
      }
    };
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);
  
  const fetchResponses = useCallback(async (page = 1) => {
    if (!surveyId || !isMountedRef.current) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      const params = {
        page,
        limit: 20,
        status: filters.status || 'approved_rejected_pending',
        dateRange: filters.dateRange || 'today',
        startDate: filters.startDate || '',
        endDate: filters.endDate || '',
        ac: filters.ac || '',
        interviewerId: filters.interviewerId || '',
        gpsCheck: filters.gpsCheck || '',
        interviewMode: filters.interviewMode || 'capi'
      };
      
      const response = await surveyResponseAPI.getBoosterChecks(surveyId, params, signal);
      
      if (signal.aborted || !isMountedRef.current) return;
      
      if (response.success) {
        setResponses(response.responses || []);
        setPagination(response.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalResponses: 0,
          hasNext: false,
          hasPrev: false
        });
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Error fetching booster checks:', error);
      if (isMountedRef.current) {
        showError('Failed to fetch booster checks');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [surveyId, filters, showError]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResponses(1);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [fetchResponses]);
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };
  
  const handleDateRangeChange = (value) => {
    if (value === 'custom') {
      handleFilterChange('dateRange', 'custom');
    } else {
      handleFilterChange('dateRange', value);
      handleFilterChange('startDate', '');
      handleFilterChange('endDate', '');
    }
  };
  
  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
    fetchResponses(page);
  };
  
  const handleViewResponse = async (response) => {
    setSelectedResponse(response);
    setLoadingResponseDetails(true);
    setShowResponseDetails(true);
    
    try {
      // Use the response data we already have, or fetch full details if needed
      setFullResponseDetails(response);
    } catch (error) {
      console.error('Error fetching response details:', error);
      showError('Failed to load response details');
    } finally {
      setLoadingResponseDetails(false);
    }
  };
  
  const handleCloseModal = () => {
    setShowResponseDetails(false);
    setSelectedResponse(null);
    setFullResponseDetails(null);
  };
  
  const handleSelectAll = () => {
    if (selectedResponses.size === responses.length) {
      setSelectedResponses(new Set());
    } else {
      setSelectedResponses(new Set(responses.map(r => r._id)));
    }
  };
  
  const handleSelectResponse = (responseId) => {
    setSelectedResponses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(responseId)) {
        newSet.delete(responseId);
      } else {
        newSet.add(responseId);
      }
      return newSet;
    });
  };
  
  const handleBulkAction = async (action) => {
    if (selectedResponses.size === 0) {
      showError('Please select at least one response');
      return;
    }
    
    setBulkActionLoading(true);
    const responseIds = Array.from(selectedResponses);
    
    try {
      let result;
      if (action === 'approve') {
        result = await surveyResponseAPI.bulkApproveBoosterChecks(responseIds);
      } else if (action === 'reject') {
        result = await surveyResponseAPI.bulkRejectBoosterChecks(responseIds);
      } else if (action === 'pending') {
        result = await surveyResponseAPI.bulkSetPendingBoosterChecks(responseIds);
      }
      
      if (result && result.success) {
        showSuccess(`Successfully ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'set to pending'} ${responseIds.length} response(s)`);
        setSelectedResponses(new Set());
        fetchResponses(pagination.currentPage);
      }
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error);
      showError(`Failed to ${action} responses`);
    } finally {
      setBulkActionLoading(false);
    }
  };
  
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .booster-checks-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .booster-checks-page * {
        max-width: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);
  
  return (
    <div className="booster-checks-page min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/company/surveys')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Booster Checks - {survey?.surveyName || 'Survey'}
                </h1>
                <p className="text-sm text-gray-600 mt-1">CAPI responses with booster enabled or distance &gt; 5.1km</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="approved_rejected_pending">All (Approved, Rejected, Pending)</option>
                  <option value="approved_pending">Approved & Pending</option>
                  <option value="pending">Pending Only</option>
                  <option value="Approved">Approved Only</option>
                  <option value="Rejected">Rejected Only</option>
                </select>
              </div>
              
              {/* GPS Check */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GPS Check</label>
                <select
                  value={filters.gpsCheck}
                  onChange={(e) => handleFilterChange('gpsCheck', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  <option value="pass">Pass (≤5.1km)</option>
                  <option value="fail">Fail (&gt;5.1km)</option>
                </select>
              </div>
              
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range {filters.dateRange === 'all' && <span className="text-orange-600">(May be slow)</span>}
                </label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="all">All Time (May be slow)</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {/* AC */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AC</label>
                <input
                  type="text"
                  value={filters.ac}
                  onChange={(e) => handleFilterChange('ac', e.target.value)}
                  placeholder="Filter by AC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Interviewer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer ID</label>
                <input
                  type="text"
                  value={filters.interviewerId}
                  onChange={(e) => handleFilterChange('interviewerId', e.target.value)}
                  placeholder="Filter by Interviewer ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Custom Date Range */}
              {filters.dateRange === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <DatePicker
                      selected={filters.startDate ? new Date(filters.startDate) : null}
                      onChange={(date) => handleFilterChange('startDate', date ? date.toISOString().split('T')[0] : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      dateFormat="yyyy-MM-dd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <DatePicker
                      selected={filters.endDate ? new Date(filters.endDate) : null}
                      onChange={(date) => handleFilterChange('endDate', date ? date.toISOString().split('T')[0] : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      dateFormat="yyyy-MM-dd"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Actions */}
      {selectedResponses.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                {selectedResponses.size} response(s) selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={bulkActionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={bulkActionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleBulkAction('pending')}
                  disabled={bulkActionLoading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Set Pending
                </button>
                <button
                  onClick={() => setSelectedResponses(new Set())}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="mb-6">
              <div className="bg-white p-4 rounded-lg shadow inline-block max-w-xs">
                <div className="text-sm text-gray-600">Total Responses</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.totalResponses.toLocaleString()}</div>
              </div>
            </div>
            
            {/* Responses Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedResponses.size === responses.length && responses.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response ID</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interviewer</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AC</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance from PS</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GPS Check</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {responses.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-4 sm:px-6 py-8 text-center text-gray-500">
                          No responses found matching the filters
                        </td>
                      </tr>
                    ) : (
                      responses.map((response, index) => {
                        const serialNumber = (pagination.currentPage - 1) * 20 + index + 1;
                        const distance = response.distanceFromPollingStation;
                        const gpsCheckPass = response.gpsCheckPass;
                        
                        return (
                          <tr key={response._id} className="hover:bg-gray-50">
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedResponses.has(response._id)}
                                onChange={() => handleSelectResponse(response._id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{serialNumber}</td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                              {response.responseId || response._id?.toString().slice(-8) || 'N/A'}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {response.interviewer?.memberId || response.interviewer?.email || 'N/A'}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                response.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                response.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {response.status}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {response.selectedAC || 'N/A'}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {distance !== null ? `${distance.toFixed(2)} km` : 'N/A'}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              {gpsCheckPass !== null ? (
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  gpsCheckPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {gpsCheckPass ? 'Pass' : 'Fail'}
                                </span>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(response.startTime || response.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleViewResponse(response)}
                                disabled={loadingResponseDetails}
                                className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="View Response Details"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={!pagination.hasNext}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(pagination.currentPage - 1) * 20 + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.currentPage * 20, pagination.totalResponses)}
                        </span>{' '}
                        of <span className="font-medium">{pagination.totalResponses.toLocaleString()}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(pagination.currentPage - 1)}
                          disabled={!pagination.hasPrev}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNum === pagination.currentPage
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => handlePageChange(pagination.currentPage + 1)}
                          disabled={!pagination.hasNext}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Response Details Modal */}
      {showResponseDetails && (fullResponseDetails || selectedResponse) && (
        <ResponseDetailsModal
          response={fullResponseDetails || selectedResponse}
          survey={survey}
          onClose={handleCloseModal}
          onStatusChange={(updatedResponse) => {
            setResponses(prev => 
              prev.map(r => 
                (r._id === updatedResponse._id) 
                  ? updatedResponse 
                  : r
              )
            );
            setSelectedResponse(updatedResponse);
            setFullResponseDetails(updatedResponse);
          }}
        />
      )}
    </div>
  );
};

export default BoosterChecksPage;

