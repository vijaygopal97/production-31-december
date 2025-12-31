import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { 
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  Play,
  Download,
  RefreshCw,
  Calendar,
  User,
  FileAudio,
  Info
} from 'lucide-react';
import api, { catiAPI } from '../../services/api';

const CatiTest = () => {
  const { showSuccess, showError } = useToast();
  const [fromNumber, setFromNumber] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [fromType, setFromType] = useState('Number');
  const [toType, setToType] = useState('Number');
  const [fromRingTime, setFromRingTime] = useState(30);
  const [toRingTime, setToRingTime] = useState(30);
  const [timeLimit, setTimeLimit] = useState('');
  const [makingCall, setMakingCall] = useState(false);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recordingBlobUrls, setRecordingBlobUrls] = useState({});

  // Fetch calls on component mount and when filters change
  useEffect(() => {
    fetchCalls();
    fetchStats();
    // Set up polling to refresh calls every 10 seconds
    const interval = setInterval(() => {
      fetchCalls();
      fetchStats();
    }, 10000);
    return () => clearInterval(interval);
  }, [page, search, statusFilter]);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      Object.values(recordingBlobUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const response = await catiAPI.getCalls({
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined
      });
      if (response.success) {
        setCalls(response.data);
        setTotalPages(response.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching calls:', error);
      showError(
        'Failed to Load Calls',
        error.response?.data?.message || error.message || 'Failed to fetch calls',
        5000
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await catiAPI.getCallStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleMakeCall = async () => {
    // Validate inputs
    if (!fromNumber || !toNumber) {
      showError(
        'Missing Information',
        'Please provide both From and To numbers',
        5000
      );
      return;
    }

    // Validate phone numbers (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    const cleanFrom = fromNumber.replace(/[^0-9]/g, '');
    const cleanTo = toNumber.replace(/[^0-9]/g, '');

    if (!phoneRegex.test(cleanFrom) || !phoneRegex.test(cleanTo)) {
      showError(
        'Invalid Phone Number',
        'Please provide valid 10-digit phone numbers',
        5000
      );
      return;
    }

    try {
      setMakingCall(true);
      const callData = {
        fromNumber: cleanFrom,
        toNumber: cleanTo,
        fromType,
        toType,
        fromRingTime: parseInt(fromRingTime) || 30,
        toRingTime: parseInt(toRingTime) || 30
      };

      if (timeLimit) {
        callData.timeLimit = parseInt(timeLimit);
      }

      const response = await catiAPI.makeCall(callData);

      if (response.success) {
        showSuccess(
          'Call Initiated',
          `Call from ${fromNumber} to ${toNumber} has been initiated successfully`,
          5000
        );
        
        // Reset form
        setFromNumber('');
        setToNumber('');
        setTimeLimit('');
        
        // Refresh calls list
        setTimeout(() => {
          fetchCalls();
          fetchStats();
        }, 2000);
      } else {
        throw new Error(response.message || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Error making call:', error);
      showError(
        'Call Failed',
        error.response?.data?.message || error.message || 'Failed to initiate call',
        6000
      );
    } finally {
      setMakingCall(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (call) => {
    // Use statusDescription if available (from webhook), otherwise use default labels
    const status = typeof call === 'object' ? call.callStatus : call;
    const description = typeof call === 'object' && call.statusDescription ? call.statusDescription : null;
    
    const statusConfig = {
      'initiated': { color: 'bg-[#E6F0F8] text-[#001D48]', icon: Loader, label: 'Initiated' },
      'ringing': { color: 'bg-yellow-100 text-yellow-800', icon: Phone, label: 'Ringing' },
      'answered': { color: 'bg-green-100 text-green-800', icon: PhoneCall, label: 'Answered' },
      'completed': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
      'busy': { color: 'bg-orange-100 text-orange-800', icon: Phone, label: 'Busy' },
      'no-answer': { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'No Answer' },
      'failed': { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
      'cancelled': { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' }
    };

    const config = statusConfig[status] || statusConfig['initiated'];
    const Icon = config.icon;
    const displayLabel = description || config.label;

    return (
      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${config.color}`} title={description ? `Status Code: ${typeof call === 'object' ? call.originalStatusCode : 'N/A'}` : ''}>
        <Icon className="w-3 h-3" />
        <span>{displayLabel}</span>
      </span>
    );
  };

  const handleViewDetails = async (call) => {
    try {
      // Always fetch fresh data from server
      const response = await catiAPI.getCallById(call._id);
      if (response.success) {
        setSelectedCall(response.data);
        
        // If there's a recording, fetch it with credentials and create blob URL
        if (response.data.recordingUrl) {
          try {
            const recordingResponse = await api.get(`/api/cati/recording/${call._id}`, {
              responseType: 'blob' // Important: axios needs responseType: 'blob' for binary data
            });
            
            if (recordingResponse.data) {
              const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
              const blobUrl = URL.createObjectURL(blob);
              setRecordingBlobUrls(prev => ({
                ...prev,
                [call._id]: blobUrl
              }));
            }
          } catch (recordingError) {
            console.error('Error fetching recording:', recordingError);
            // Don't show error to user, just log it - audio element will try direct URL as fallback
          }
        }
      }
    } catch (error) {
      showError(
        'Failed to Load Details',
        error.response?.data?.message || error.message || 'Failed to fetch call details',
        5000
      );
    }
  };

  const handleRefreshCall = async (call) => {
    try {
      // Refresh the specific call data
      const response = await catiAPI.getCallById(call._id);
      if (response.success) {
        // Update the call in the list
        setCalls(prevCalls => 
          prevCalls.map(c => c._id === call._id ? response.data : c)
        );
        showSuccess(
          'Call Refreshed',
          'Call details have been refreshed',
          3000
        );
      }
    } catch (error) {
      showError(
        'Refresh Failed',
        error.response?.data?.message || error.message || 'Failed to refresh call',
        5000
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg">
            <PhoneCall className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CATI Test</h1>
            <p className="text-gray-600 mt-1">
              Test and manage Computer-Assisted Telephone Interviewing (CATI) calls with real-time monitoring
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Calls</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCalls || 0}</p>
              </div>
              <div className="p-3 bg-[#E6F0F8] rounded-lg">
                <Phone className="w-6 h-6 text-[#001D48]" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.successfulCalls || 0}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.failedCalls || 0}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Duration</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatDuration(stats.totalDuration || 0)}</p>
              </div>
              <div className="p-3 bg-[#E8E6F5] rounded-lg">
                <Clock className="w-6 h-6 text-[#373177]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Make Call Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
          <PhoneOutgoing className="w-5 h-5" />
          <span>Make a Call</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* From Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              From Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="Enter 10-digit phone number"
              maxLength={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">The number that will be called first</p>
          </div>

          {/* To Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              To Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="Enter 10-digit phone number"
              maxLength={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">The number that will be called after From answers</p>
          </div>

          {/* From Ring Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              From Ring Time (seconds)
            </label>
            <input
              type="number"
              value={fromRingTime}
              onChange={(e) => setFromRingTime(e.target.value)}
              min="1"
              max="50"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum ring duration for From number (1-50 seconds)</p>
          </div>

          {/* To Ring Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              To Ring Time (seconds)
            </label>
            <input
              type="number"
              value={toRingTime}
              onChange={(e) => setToRingTime(e.target.value)}
              min="1"
              max="50"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum ring duration for To number (1-50 seconds)</p>
          </div>

          {/* Time Limit */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Time Limit (seconds) <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              placeholder="Leave empty for unlimited"
              min="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum call duration in seconds</p>
          </div>
        </div>

        {/* Make Call Button */}
        <div className="mt-6">
          <button
            onClick={handleMakeCall}
            disabled={makingCall || !fromNumber || !toNumber}
            className={`w-full flex items-center justify-center space-x-2 px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
              makingCall || !fromNumber || !toNumber
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 transform hover:scale-[1.02] shadow-lg'
            }`}
          >
            {makingCall ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Initiating Call...</span>
              </>
            ) : (
              <>
                <PhoneCall className="w-5 h-5" />
                <span>Make Call</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Calls History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <PhoneIncoming className="w-5 h-5" />
            <span>Call History</span>
          </h2>
          <button
            onClick={() => { fetchCalls(); fetchStats(); }}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone number or call ID..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            >
              <option value="all">All Status</option>
              <option value="initiated">Initiated</option>
              <option value="ringing">Ringing</option>
              <option value="answered">Answered</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="busy">Busy</option>
              <option value="no-answer">No Answer</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Calls Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-green-600" />
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No calls found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">From</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">To</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <PhoneOutgoing className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{call.fromNumber}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <PhoneIncoming className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{call.toNumber}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(call)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(call.callDuration)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{formatDate(call.createdAt)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(call)}
                          className="px-3 py-1 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200"
                        >
                          View Details
                        </button>
                        {call.callStatus === 'initiated' && (
                          <button
                            onClick={() => handleRefreshCall(call)}
                            className="p-1 text-sm font-medium text-[#001D48] bg-[#E6F0F8] rounded-lg hover:bg-[#E6F0F8] transition-colors duration-200"
                            title="Refresh to check for webhook updates"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Call Details Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Call Details</h3>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">From Number</p>
                    <p className="text-base font-medium text-gray-900">{selectedCall.fromNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">To Number</p>
                    <p className="text-base font-medium text-gray-900">{selectedCall.toNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Call ID</p>
                    <p className="text-base font-medium text-gray-900 font-mono text-sm">{selectedCall.callId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedCall)}</div>
                    {selectedCall.statusDescription && (
                      <p className="text-xs text-gray-500 mt-1">{selectedCall.statusDescription}</p>
                    )}
                    {selectedCall.originalStatusCode && (
                      <p className="text-xs text-gray-400 mt-1">Status Code: {selectedCall.originalStatusCode}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Call Timing */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Call Timing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Start Time</p>
                    <p className="text-base font-medium text-gray-900">{formatDate(selectedCall.callStartTime || selectedCall.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">End Time</p>
                    <p className="text-base font-medium text-gray-900">{formatDate(selectedCall.callEndTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Call Duration</p>
                    <p className="text-base font-medium text-gray-900">{formatDuration(selectedCall.callDuration)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Talk Duration</p>
                    <p className="text-base font-medium text-gray-900">{formatDuration(selectedCall.talkDuration)}</p>
                  </div>
                  {selectedCall.ringDuration > 0 && (
                    <div>
                      <p className="text-sm text-gray-600">Ring Duration</p>
                      <p className="text-base font-medium text-gray-900">{formatDuration(selectedCall.ringDuration)}</p>
                    </div>
                  )}
                  {selectedCall.ivrDuration > 0 && (
                    <div>
                      <p className="text-sm text-gray-600">IVR Duration</p>
                      <p className="text-base font-medium text-gray-900">{formatDuration(selectedCall.ivrDuration)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Number Details */}
              {selectedCall.numberDetails && Array.isArray(selectedCall.numberDetails) && selectedCall.numberDetails.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Number Details</h4>
                  <div className="space-y-4">
                    {selectedCall.numberDetails.map((detail, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold text-gray-900">{detail.number || 'N/A'}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              detail.status === 'answered' 
                                ? 'bg-green-100 text-green-800' 
                                : detail.status === 'missed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {detail.status || 'unknown'}
                            </span>
                            {detail.CTC && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#E6F0F8] text-[#001D48]">
                                {detail.CTC}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {detail.totalRingDuration > 0 && (
                            <div>
                              <p className="text-gray-600">Ring Duration</p>
                              <p className="font-medium text-gray-900">{formatDuration(detail.totalRingDuration)}</p>
                            </div>
                          )}
                          {detail.talkDuration > 0 && (
                            <div>
                              <p className="text-gray-600">Talk Duration</p>
                              <p className="font-medium text-gray-900">{formatDuration(detail.talkDuration)}</p>
                            </div>
                          )}
                          {detail.answerSTime && (
                            <div>
                              <p className="text-gray-600">Answer Start</p>
                              <p className="font-medium text-gray-900">{formatDate(detail.answerSTime)}</p>
                            </div>
                          )}
                          {detail.answerETime && (
                            <div>
                              <p className="text-gray-600">Answer End</p>
                              <p className="font-medium text-gray-900">{formatDate(detail.answerETime)}</p>
                            </div>
                          )}
                          {detail.answerDuration > 0 && (
                            <div>
                              <p className="text-gray-600">Answer Duration</p>
                              <p className="font-medium text-gray-900">{formatDuration(detail.answerDuration)}</p>
                            </div>
                          )}
                          {detail.cli && (
                            <div>
                              <p className="text-gray-600">CLI</p>
                              <p className="font-medium text-gray-900">{detail.cli}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recording */}
              {selectedCall.recordingUrl && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <FileAudio className="w-5 h-5" />
                    <span>Call Recording</span>
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <audio controls className="w-full mb-2">
                      <source 
                        src={recordingBlobUrls[selectedCall._id] || `/api/cati/recording/${selectedCall._id}`} 
                        type="audio/mpeg" 
                      />
                      Your browser does not support the audio element.
                    </audio>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600">
                        Duration: {formatDuration(selectedCall.recordingDuration)}
                        {selectedCall.recordingFileSize && ` • Size: ${(selectedCall.recordingFileSize / 1024 / 1024).toFixed(2)} MB`}
                      </span>
                      <a
                        href={recordingBlobUrls[selectedCall._id] || `/api/cati/recording/${selectedCall._id}`}
                        download={`recording_${selectedCall._id}.mp3`}
                        className="flex items-center space-x-2 px-3 py-1 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook Data */}
              {selectedCall.webhookReceived && selectedCall.webhookData && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Info className="w-5 h-5" />
                    <span>Webhook Data</span>
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-xs text-gray-700 overflow-x-auto">
                      {JSON.stringify(selectedCall.webhookData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Error Information */}
              {selectedCall.errorMessage && (
                <div>
                  <h4 className="text-lg font-semibold text-red-900 mb-4">Error Information</h4>
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      <strong>Error:</strong> {selectedCall.errorMessage}
                    </p>
                    {selectedCall.errorCode && (
                      <p className="text-sm text-red-600 mt-1">
                        <strong>Code:</strong> {selectedCall.errorCode}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatiTest;

