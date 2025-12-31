import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  Building2,
  Crown,
  Shield,
  BarChart3,
  Brain,
  Loader,
  X,
  Check,
  AlertCircle,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  XCircle,
  GraduationCap,
  Smartphone,
  CreditCard,
  FileCheck,
  Star,
  FileText,
  FileImage,
  MapPin
} from 'lucide-react';
import { authAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { getFileUrl } from '../../utils/config';
import api from '../../services/api';
import AddCompanyUser from './AddCompanyUser';
import EditUserModal from './EditUserModal';

const CompanyAdminUserManagement = () => {
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({});
  const [documentSignedUrls, setDocumentSignedUrls] = useState({}); // Cache for document signed URLs

  // Helper function to get document URL (prioritizes signed URLs from backend, then fetches if needed)
  const getDocumentUrl = async (docPath, docSignedUrl, userId, fieldName) => {
    if (!docPath) return null;
    
    // If signed URL is already provided by backend, use it
    if (docSignedUrl) {
      return docSignedUrl;
    }
    
    // Check cache
    const cacheKey = `${userId}_${fieldName}`;
    if (documentSignedUrls[cacheKey]) {
      return documentSignedUrls[cacheKey];
    }
    
    // If it's an S3 key, fetch signed URL
    if (docPath.startsWith('documents/') || docPath.startsWith('audio/') || docPath.startsWith('reports/')) {
      try {
        const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(docPath)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.signedUrl) {
            setDocumentSignedUrls(prev => ({ ...prev, [cacheKey]: data.signedUrl }));
            return data.signedUrl;
          }
        }
      } catch (error) {
        console.error('Error fetching signed URL:', error);
      }
    }
    
    // Fallback to getFileUrl for local paths
    return getFileUrl(docPath);
  };
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  
  // UI states
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showViewInterviewer, setShowViewInterviewer] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Load users data for the company
  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('CompanyAdminUserManagement - Loading company users with params:', {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        userType: selectedUserType,
        status: selectedStatus
      });
      
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        userType: selectedUserType,
        status: selectedStatus,
        companyOnly: true // This will be used by backend to filter company users only
      };
      
      console.log('CompanyAdminUserManagement - Calling authAPI.getCompanyUsers...');
      const response = await authAPI.getCompanyUsers(params);
      console.log('CompanyAdminUserManagement - API response:', response);
      
      if (response.success) {
        setUsers(response.data.users);
        setPagination(response.data.pagination);
        setFilters(response.data.filters);
        console.log('CompanyAdminUserManagement - Company users loaded successfully:', response.data.users.length);
      }
    } catch (error) {
      console.error('CompanyAdminUserManagement - Error loading company users:', error);
      console.error('CompanyAdminUserManagement - Error response:', error.response?.data);
      setError('Failed to load company users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentPage, pageSize, searchTerm, selectedUserType, selectedStatus]);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle filters
  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'userType':
        setSelectedUserType(value);
        break;
      case 'status':
        setSelectedStatus(value);
        break;
      default:
        break;
    }
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedUserType('');
    setSelectedStatus('');
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

  // Handle user actions
  const handleEditUser = async (user) => {
    // For project managers, fetch full user data with populated assignedTeamMembers
    if (user.userType === 'project_manager') {
      try {
        setLoading(true);
        // Fetch all project managers to get the one with populated assignedTeamMembers
        const response = await authAPI.getCompanyUsers({
          page: 1,
          limit: 1000, // Get all project managers
          userType: 'project_manager'
        });
        
        if (response.success && response.data.users && response.data.users.length > 0) {
          // Find the exact user by ID
          const fullUser = response.data.users.find(u => u._id === user._id);
          if (fullUser) {
            setSelectedUser(fullUser);
            setShowEditUser(true);
          } else {
            // Fallback to using the user from list
            setSelectedUser(user);
            setShowEditUser(true);
          }
        } else {
          // Fallback to using the user from list
          setSelectedUser(user);
          setShowEditUser(true);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        // Fallback to using the user from list
        setSelectedUser(user);
        setShowEditUser(true);
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedUser(user);
      setShowEditUser(true);
    }
  };

  const handleViewInterviewer = async (user) => {
    try {
      setLoading(true);
      // Fetch the complete interviewer profile data
      const response = await authAPI.getInterviewerProfileById(user._id);
      if (response.success) {
        setSelectedUser(response.data);
        setShowViewInterviewer(true);
        setRejectionFeedback(''); // Reset feedback when opening modal
      } else {
        showError('Failed to Load Profile', 'Failed to load interviewer profile details.');
      }
    } catch (error) {
      console.error('Error fetching interviewer profile:', error);
      showError('Failed to Load Profile', 'Failed to load interviewer profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectProfile = async () => {
    if (!rejectionFeedback.trim()) {
      showError('Feedback Required', 'Please provide feedback for the rejection.');
      return;
    }

    try {
      setRejecting(true);
      
      // Call the API to reject the profile
      const response = await authAPI.reviewProfile({
        userId: selectedUser._id,
        status: 'rejected',
        feedback: rejectionFeedback
      });

      if (response.success) {
        showSuccess('Profile Rejected', 'Profile has been rejected successfully!');
        
        // Close modal and reset state
        setShowViewInterviewer(false);
        setSelectedUser(null);
        setRejectionFeedback('');
        
        // Refresh the users list to show updated status
        loadUsers();
      } else {
        showError('Rejection Failed', 'Failed to reject profile. Please try again.');
      }
    } catch (error) {
      console.error('Error rejecting profile:', error);
      showError('Rejection Failed', 'Failed to reject profile. Please try again.');
    } finally {
      setRejecting(false);
    }
  };

  const handleUpdateUser = async (updatedUserData) => {
    try {
      console.log('CompanyAdminUserManagement - Updating user:', selectedUser._id, updatedUserData);
      const response = await authAPI.updateCompanyUser(selectedUser._id, updatedUserData);
      if (response.success) {
        console.log('CompanyAdminUserManagement - User updated successfully');
        loadUsers(); // Reload users
        setShowEditUser(false);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('CompanyAdminUserManagement - Error updating user:', error);
      setError('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      console.log('CompanyAdminUserManagement - Deleting user:', userId);
      const response = await authAPI.deleteCompanyUser(userId);
      if (response.success) {
        console.log('CompanyAdminUserManagement - User deleted successfully');
        loadUsers(); // Reload users
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('CompanyAdminUserManagement - Error deleting user:', error);
      setError('Failed to delete user');
    }
  };

  // Get user type icon
  const getUserTypeIcon = (userType) => {
    switch (userType) {
      case 'company_admin':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'project_manager':
        return <BarChart3 className="w-4 h-4 text-green-500" />;
      case 'interviewer':
        return <UserCheck className="w-4 h-4 text-purple-500" />;
      case 'quality_agent':
        return <Shield className="w-4 h-4 text-orange-500" />;
      case 'Data_Analyst':
        return <Brain className="w-4 h-4 text-indigo-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-500" />;
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (showAddUser) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => setShowAddUser(false)}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Back to Manage Team Members
          </button>
        </div>
        <AddCompanyUser onUserCreated={() => {
          setShowAddUser(false);
          loadUsers();
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Team Members</h1>
          <p className="text-gray-600 mt-1">View, edit, and manage your company team members</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Team Member
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
                placeholder="Search by name, email, phone, or Member ID..."
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
              {/* User Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                <select
                  value={selectedUserType}
                  onChange={(e) => handleFilterChange('userType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="interviewer">Interviewer</option>
                  <option value="quality_agent">Quality Agent</option>
                  <option value="Data_Analyst">Data Analyst</option>
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
          Showing {users.length} of {pagination.totalUsers} team members
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

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-[#373177]" />
            <span className="ml-2 text-gray-600">Loading team members...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Users className="w-6 h-6 mr-2" />
            No team members found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#373177] to-[#373177] rounded-full flex items-center justify-center text-white font-medium">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </span>
                            {(user.userType === 'interviewer' || user.userType === 'quality_agent') && user.memberId && (
                              <span className="text-xs bg-[#E6F0F8] text-blue-700 px-2 py-0.5 rounded font-mono">
                                ID: {user.memberId}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getUserTypeIcon(user.userType)}
                        <span className="ml-2 text-sm text-gray-900">
                          {user.userType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {user.userType === 'interviewer' && (
                          <>
                            {/* Location Control (Booster) Toggle */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newValue = !(user.preferences?.locationControlBooster || false);
                                
                                // Optimistically update the UI
                                setUsers(prevUsers => 
                                  prevUsers.map(u => 
                                    u._id === user._id 
                                      ? {
                                          ...u,
                                          preferences: {
                                            ...u.preferences,
                                            locationControlBooster: newValue
                                          }
                                        }
                                      : u
                                  )
                                );
                                
                                try {
                                  const updatedPreferences = {
                                    ...user.preferences,
                                    locationControlBooster: newValue
                                  };
                                  const response = await authAPI.updateCompanyUser(user._id, {
                                    preferences: updatedPreferences
                                  });
                                  if (response.success) {
                                    // Show success toast
                                    showSuccess(
                                      newValue 
                                        ? `Location Control (Booster) enabled for ${user.name || user.email}` 
                                        : `Location Control (Booster) disabled for ${user.name || user.email}`
                                    );
                                  } else {
                                    // Revert on failure
                                    setUsers(prevUsers => 
                                      prevUsers.map(u => 
                                        u._id === user._id 
                                          ? {
                                              ...u,
                                              preferences: {
                                                ...u.preferences,
                                                locationControlBooster: !newValue
                                              }
                                            }
                                          : u
                                      )
                                    );
                                    showError('Failed to update location control setting');
                                  }
                                } catch (error) {
                                  console.error('Error updating location control booster:', error);
                                  // Revert on error
                                  setUsers(prevUsers => 
                                    prevUsers.map(u => 
                                      u._id === user._id 
                                        ? {
                                            ...u,
                                            preferences: {
                                              ...u.preferences,
                                              locationControlBooster: !newValue
                                            }
                                          }
                                        : u
                                    )
                                  );
                                  showError('Failed to update location control setting');
                                }
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                user.preferences?.locationControlBooster
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title={user.preferences?.locationControlBooster 
                                ? 'Location Control (Booster) - Enabled - Click to disable' 
                                : 'Location Control (Booster) - Disabled - Click to enable'}
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewInterviewer(user)}
                              className="text-green-600 hover:text-green-800 transition-colors"
                              title="View Interviewer Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-[#373177] hover:text-[#001D48] transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(user._id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
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
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrev}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
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
                      ? 'bg-[#001D48] text-white border-[#373177]'
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
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && selectedUser && (
        <EditUserModal 
          user={selectedUser}
          onSave={handleUpdateUser}
          onCancel={() => {
            setShowEditUser(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* View Interviewer Profile Modal */}
      {showViewInterviewer && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !mt-0">
          <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-[#E6F0F8] rounded-lg">
                  <Shield className="h-6 w-6 text-[#373177]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Profile Details
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedUser.firstName} {selectedUser.lastName} • ID: {selectedUser._id?.slice(-8)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowViewInterviewer(false);
                  setSelectedUser(null);
                  setRejectionFeedback('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Profile Details */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <User className="h-5 w-5 text-[#373177] mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Basic Information</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Full Name</label>
                        <p className="text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Email Address</label>
                        <p className="text-gray-900">{selectedUser.email}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Phone Number</label>
                        <p className="text-gray-900">{selectedUser.phone}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Age</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.age} years</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Gender</label>
                        <p className="text-gray-900 capitalize">{selectedUser.interviewerProfile?.gender || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Personal Details */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <GraduationCap className="h-5 w-5 text-green-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Personal Details</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Languages Spoken</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedUser.interviewerProfile?.languagesSpoken?.map((lang, index) => (
                            <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F0F8] text-[#001D48]">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Highest Degree</label>
                          <p className="text-gray-900">{selectedUser.interviewerProfile?.highestDegree?.name || 'Not specified'}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Institution</label>
                          <p className="text-gray-900">{selectedUser.interviewerProfile?.highestDegree?.institution || 'Not specified'}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Year</label>
                          <p className="text-gray-900">{selectedUser.interviewerProfile?.highestDegree?.year || 'Not specified'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Survey Experience */}
                  <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
                    <div className="flex items-center mb-4">
                      <FileCheck className="h-5 w-5 text-orange-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Survey Experience</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Previous Survey Experience</label>
                        <p className="text-gray-900 mt-1">
                          {selectedUser.interviewerProfile?.hasSurveyExperience === true 
                            ? 'Yes' 
                            : selectedUser.interviewerProfile?.hasSurveyExperience === false 
                            ? 'No' 
                            : 'Not specified'
                          }
                        </p>
                      </div>
                      
                      {selectedUser.interviewerProfile?.hasSurveyExperience === true && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-sm font-medium text-gray-600">Years of Experience</label>
                              <p className="text-gray-900">
                                {selectedUser.interviewerProfile?.surveyExperienceYears || 'Not specified'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">Experience Description</label>
                            <p className="text-gray-900 text-sm leading-relaxed">
                              {selectedUser.interviewerProfile?.surveyExperienceDescription || 'Not provided'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Survey Requirements */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Smartphone className="h-5 w-5 text-[#373177] mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Survey Requirements</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Owns Smartphone</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.ownsSmartphone ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Smartphone Type</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.smartphoneType || 'Not specified'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Willing to Travel</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.willingToTravel ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Has Vehicle</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.hasVehicle ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Willing to Record Audio</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.willingToRecordAudio ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Agrees to Remuneration</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.agreesToRemuneration ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <CreditCard className="h-5 w-5 text-orange-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Payment Details</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Account Number</label>
                        <p className="text-gray-900 font-mono">{selectedUser.interviewerProfile?.bankAccountNumber || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Account Holder</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.bankAccountHolderName || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Bank Name</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.bankName || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">IFSC Code</label>
                        <p className="text-gray-900 font-mono">{selectedUser.interviewerProfile?.bankIfscCode || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Verification Documents */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <FileCheck className="h-5 w-5 text-red-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Verification Documents</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Aadhaar Number</label>
                        <p className="text-gray-900 font-mono">{selectedUser.interviewerProfile?.aadhaarNumber || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">PAN Number</label>
                        <p className="text-gray-900 font-mono">{selectedUser.interviewerProfile?.panNumber || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Agreements */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Star className="h-5 w-5 text-yellow-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Agreements</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Agrees to Share Information</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.agreesToShareInfo ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Agrees to Participate in Surveys</label>
                        <p className="text-gray-900">{selectedUser.interviewerProfile?.agreesToParticipateInSurvey ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Documents & Actions */}
                <div className="space-y-6">
                  {/* Document Previews */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Documents</h4>
                    <div className="space-y-3">
                      {/* CV Document */}
                      {selectedUser.interviewerProfile?.cvUpload && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-[#373177] mr-3" />
                            <span className="text-sm font-medium text-gray-900">CV Document</span>
                          </div>
                          <button
                            onClick={async () => {
                              const docUrl = await getDocumentUrl(
                                selectedUser.interviewerProfile.cvUpload,
                                selectedUser.interviewerProfile.cvUploadSignedUrl,
                                selectedUser._id,
                                'cvUpload'
                              );
                              if (docUrl) {
                                window.open(docUrl, '_blank');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* Aadhaar Document */}
                      {selectedUser.interviewerProfile?.aadhaarDocument && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-green-600 mr-3" />
                            <span className="text-sm font-medium text-gray-900">Aadhaar Card</span>
                          </div>
                          <button
                            onClick={async () => {
                              const docUrl = await getDocumentUrl(
                                selectedUser.interviewerProfile.aadhaarDocument,
                                selectedUser.interviewerProfile.aadhaarDocumentSignedUrl,
                                selectedUser._id,
                                'aadhaarDocument'
                              );
                              if (docUrl) {
                                window.open(docUrl, '_blank');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* PAN Document */}
                      {selectedUser.interviewerProfile?.panDocument && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-[#373177] mr-3" />
                            <span className="text-sm font-medium text-gray-900">PAN Card</span>
                          </div>
                          <button
                            onClick={async () => {
                              const docUrl = await getDocumentUrl(
                                selectedUser.interviewerProfile.panDocument,
                                selectedUser.interviewerProfile.panDocumentSignedUrl,
                                selectedUser._id,
                                'panDocument'
                              );
                              if (docUrl) {
                                window.open(docUrl, '_blank');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* Passport Photo */}
                      {selectedUser.interviewerProfile?.passportPhoto && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-orange-600 mr-3" />
                            <span className="text-sm font-medium text-gray-900">Passport Photo</span>
                          </div>
                          <button
                            onClick={async () => {
                              const docUrl = await getDocumentUrl(
                                selectedUser.interviewerProfile.passportPhoto,
                                selectedUser.interviewerProfile.passportPhotoSignedUrl,
                                selectedUser._id,
                                'passportPhoto'
                              );
                              if (docUrl) {
                                window.open(docUrl, '_blank');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* Bank Document */}
                      {selectedUser.interviewerProfile?.bankDocumentUpload && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-red-600 mr-3" />
                            <span className="text-sm font-medium text-gray-900">Bank Document</span>
                          </div>
                          <button
                            onClick={async () => {
                              const docUrl = await getDocumentUrl(
                                selectedUser.interviewerProfile.bankDocumentUpload,
                                selectedUser.interviewerProfile.bankDocumentUploadSignedUrl,
                                selectedUser._id,
                                'bankDocumentUpload'
                              );
                              if (docUrl) {
                                window.open(docUrl, '_blank');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Info */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Submission Details</h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedUser.interviewerProfile?.lastSubmittedAt ? new Date(selectedUser.interviewerProfile.lastSubmittedAt).toLocaleDateString() : 'Not available'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {selectedUser.interviewerProfile?.lastSubmittedAt ? new Date(selectedUser.interviewerProfile.lastSubmittedAt).toLocaleTimeString() : 'Not available'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Only show review sections if profile is approved/active */}
                  {selectedUser.interviewerProfile?.approvalStatus === 'approved' && (
                    <>
                      {/* Feedback Section */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Review Feedback</h4>
                        <textarea
                          value={rejectionFeedback}
                          onChange={(e) => setRejectionFeedback(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Add your feedback or comments for the interviewer..."
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Review Decision</h4>
                        <div className="space-y-3">
                          <button
                            onClick={handleRejectProfile}
                            disabled={rejecting}
                            className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            {rejecting ? (
                              <Loader className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Reject Profile
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Delete Team Member</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove this team member? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyAdminUserManagement;
