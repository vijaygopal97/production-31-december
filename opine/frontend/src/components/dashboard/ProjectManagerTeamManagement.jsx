import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  BarChart3,
  Loader,
  X,
  Check,
  AlertCircle,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Power,
  PowerOff
} from 'lucide-react';
import { authAPI, surveyAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import AddProjectManagerInterviewer from './AddProjectManagerInterviewer';
import EditProjectManagerInterviewer from './EditProjectManagerInterviewer';

const ProjectManagerTeamManagement = () => {
  const { showSuccess, showError } = useToast();
  const { user: currentUser } = useAuth();
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedInterviewerType, setSelectedInterviewerType] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  
  // UI states
  const [showAddInterviewer, setShowAddInterviewer] = useState(false);
  const [showEditInterviewer, setShowEditInterviewer] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Load assigned interviewers for the project manager
  const loadInterviewers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch current user with populated assignedTeamMembers
      const userResponse = await authAPI.getMe();
      
      if (!userResponse.success || !userResponse.data?.assignedTeamMembers) {
        setInterviewers([]);
        setPagination({ totalUsers: 0, current: 1, pages: 1 });
        return;
      }

      const assignedTeamMembers = userResponse.data.assignedTeamMembers;
      
      // Extract interviewer data directly from assignedTeamMembers
      let interviewers = assignedTeamMembers
        .filter(member => member.userType === 'interviewer' && member.user)
        .map(member => {
          const user = member.user;
          return {
            _id: user._id || user,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || '',
            memberId: user.memberId || '',
            userType: user.userType || 'interviewer',
            interviewModes: user.interviewModes || null,
            status: user.status || 'active',
            preferences: user.preferences ? {
              ...user.preferences,
              locationControlBooster: user.preferences.locationControlBooster || false
            } : {
              locationControlBooster: false
            },
            createdAt: user.createdAt || new Date()
          };
        });

      if (interviewers.length === 0) {
        setInterviewers([]);
        setPagination({ totalUsers: 0, current: 1, pages: 1 });
        return;
      }

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        interviewers = interviewers.filter(user => 
          (user.firstName && user.firstName.toLowerCase().includes(searchLower)) ||
          (user.lastName && user.lastName.toLowerCase().includes(searchLower)) ||
          (user.email && user.email.toLowerCase().includes(searchLower)) ||
          (user.phone && user.phone.includes(searchTerm)) ||
          (user.memberId && user.memberId.toLowerCase().includes(searchLower))
        );
      }

      // Apply status filter
      if (selectedStatus) {
        interviewers = interviewers.filter(user => user.status === selectedStatus);
      }

      // Apply interviewer type filter
      if (selectedInterviewerType) {
        interviewers = interviewers.filter(user => {
          const modes = user.interviewModes || '';
          if (selectedInterviewerType === 'CAPI') {
            return modes.includes('CAPI') || modes.includes('Face To Face');
          } else if (selectedInterviewerType === 'CATI') {
            return modes.includes('CATI') || modes.includes('Telephonic');
          } else if (selectedInterviewerType === 'Both') {
            return (modes.includes('CAPI') || modes.includes('Face To Face')) &&
                   (modes.includes('CATI') || modes.includes('Telephonic'));
          }
          return true;
        });
      }

      // Apply pagination
      const totalUsers = interviewers.length;
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedUsers = interviewers.slice(startIndex, endIndex);
      
      setInterviewers(paginatedUsers);
      setPagination({
        current: currentPage,
        pages: Math.ceil(totalUsers / pageSize),
        totalUsers: totalUsers,
        hasNext: endIndex < totalUsers,
        hasPrev: currentPage > 1
      });
    } catch (error) {
      console.error('Error loading interviewers:', error);
      setError('Failed to load interviewers');
      setInterviewers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterviewers();
  }, [currentPage, pageSize, searchTerm, selectedStatus, selectedInterviewerType]);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Handle filters
  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'status':
        setSelectedStatus(value);
        break;
      case 'interviewerType':
        setSelectedInterviewerType(value);
        break;
      default:
        break;
    }
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setSelectedInterviewerType('');
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Handle interviewer actions
  const handleEditInterviewer = (interviewer) => {
    setSelectedInterviewer(interviewer);
    setShowEditInterviewer(true);
  };


  const handleUpdateInterviewer = async () => {
    // This function is called by EditProjectManagerInterviewer component
    // The actual update is handled inside EditProjectManagerInterviewer
    // using updateInterviewerByPM and updateInterviewerPreferencesByPM
    // Just reload the interviewers list
    await loadInterviewers();
  };

  const handleToggleLocationBooster = async (interviewer) => {
    const currentValue = interviewer.preferences?.locationControlBooster || false;
    const newValue = !currentValue;
    
    // Optimistic update - update UI immediately
    setInterviewers(prevInterviewers => 
      prevInterviewers.map(int => 
        int._id === interviewer._id 
          ? {
              ...int,
              preferences: {
                ...int.preferences,
                locationControlBooster: newValue
              }
            }
          : int
      )
    );
    
    try {
      const response = await authAPI.updateInterviewerPreferencesByPM(interviewer._id, {
        preferences: {
          locationControlBooster: newValue
        }
      });
      
      if (response.success) {
        showSuccess(
          newValue 
            ? `Location Booster enabled for ${interviewer.firstName} ${interviewer.lastName}` 
            : `Location Booster disabled for ${interviewer.firstName} ${interviewer.lastName}`
        );
        // Reload to ensure we have the latest data
        loadInterviewers();
      } else {
        // Revert on failure
        setInterviewers(prevInterviewers => 
          prevInterviewers.map(int => 
            int._id === interviewer._id 
              ? {
                  ...int,
                  preferences: {
                    ...int.preferences,
                    locationControlBooster: currentValue
                  }
                }
              : int
          )
        );
        showError('Failed to update location booster setting');
      }
    } catch (error) {
      console.error('Error updating location booster:', error);
      // Revert on error
      setInterviewers(prevInterviewers => 
        prevInterviewers.map(int => 
          int._id === interviewer._id 
            ? {
                ...int,
                preferences: {
                  ...int.preferences,
                  locationControlBooster: currentValue
                }
              }
            : int
        )
      );
      showError('Failed to update location booster setting');
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', icon: <UserCheck className="w-3 h-3" /> },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="w-3 h-3" /> },
      inactive: { color: 'bg-gray-100 text-gray-800', icon: <UserX className="w-3 h-3" /> },
      suspended: { color: 'bg-red-100 text-red-800', icon: <X className="w-3 h-3" /> }
    };
    
    const config = statusConfig[status] || statusConfig.inactive;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        <span className="ml-1 capitalize">{status}</span>
      </span>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get interviewer type badge
  const getInterviewerTypeBadge = (interviewModes) => {
    if (!interviewModes || typeof interviewModes !== 'string') {
      return <span className="text-xs text-gray-500">N/A</span>;
    }
    
    const modesStr = interviewModes.toString();
    const isCAPI = modesStr.includes('CAPI') || modesStr.includes('Face To Face');
    const isCATI = modesStr.includes('CATI') || modesStr.includes('Telephonic');
    
    if (isCAPI && isCATI) {
      return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Both</span>;
    } else if (isCAPI) {
      return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">CAPI</span>;
    } else if (isCATI) {
      return <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">CATI</span>;
    }
    
    return <span className="text-xs text-gray-500">N/A</span>;
  };

  if (showAddInterviewer) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => setShowAddInterviewer(false)}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Back to Team Management
          </button>
        </div>
        <AddProjectManagerInterviewer 
          onInterviewerCreated={() => {
            setShowAddInterviewer(false);
            loadInterviewers();
          }} 
        />
      </div>
    );
  }

  if (showEditInterviewer && selectedInterviewer) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              setShowEditInterviewer(false);
              setSelectedInterviewer(null);
            }}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Back to Team Management
          </button>
        </div>
        <EditProjectManagerInterviewer 
          interviewer={selectedInterviewer}
          onInterviewerUpdated={handleUpdateInterviewer}
          onCancel={() => {
            setShowEditInterviewer(false);
            setSelectedInterviewer(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-1">Manage your assigned interviewers</p>
        </div>
        <button
          onClick={() => setShowAddInterviewer(true)}
          className="flex items-center px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Interviewer
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, phone, or Interviewer ID..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Interviewer Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Interviewer Type</label>
                <select
                  value={selectedInterviewerType}
                  onChange={(e) => handleFilterChange('interviewerType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="CAPI">CAPI</option>
                  <option value="CATI">CATI</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Showing {interviewers.length} of {pagination.totalUsers || interviewers.length} interviewers
        </div>
        <div className="flex items-center space-x-2">
          <span>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={45}>45</option>
          </select>
        </div>
      </div>

      {/* Interviewers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-[#373177]" />
            <span className="ml-2 text-gray-600">Loading interviewers...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : interviewers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Users className="w-12 h-12 mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">No interviewers found</p>
            <p className="text-sm">Add your first interviewer to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interviewer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location Booster
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {interviewers.map((interviewer) => (
                  <tr key={interviewer._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#373177] to-[#373177] rounded-full flex items-center justify-center text-white font-medium">
                          {interviewer.firstName?.charAt(0) || 'I'}{interviewer.lastName?.charAt(0) || 'U'}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {interviewer.firstName} {interviewer.lastName}
                            </span>
                            {interviewer.memberId && (
                              <span className="text-xs bg-[#E6F0F8] text-blue-700 px-2 py-0.5 rounded font-mono">
                                ID: {interviewer.memberId}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{interviewer.email}</div>
                          {interviewer.phone && (
                            <div className="text-xs text-gray-400">{interviewer.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getInterviewerTypeBadge(interviewer.interviewModes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(interviewer.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleLocationBooster(interviewer)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          interviewer.preferences?.locationControlBooster
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={interviewer.preferences?.locationControlBooster 
                          ? 'Location Booster is ON - Click to switch off' 
                          : 'Location Booster is OFF - Click to turn on'}
                      >
                        {interviewer.preferences?.locationControlBooster ? (
                          <>
                            <PowerOff className="w-4 h-4 mr-1.5" />
                            Turn Off Booster
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4 mr-1.5" />
                            Turn Booster ON
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(interviewer.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditInterviewer(interviewer)}
                          className="text-[#373177] hover:text-[#001D48] transition-colors"
                          title="Edit Interviewer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-4 border-t border-gray-200 rounded-b-lg">
          <div className="text-sm text-gray-600">
            Page {pagination.current || currentPage} of {pagination.pages || 1}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange((pagination.current || currentPage) - 1)}
              disabled={(pagination.current || currentPage) === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange((pagination.current || currentPage) + 1)}
              disabled={(pagination.current || currentPage) >= (pagination.pages || 1)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectManagerTeamManagement;

