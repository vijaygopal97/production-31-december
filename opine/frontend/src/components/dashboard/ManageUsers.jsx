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
  Loader,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { authAPI } from '../../services/api';
import AddUser from './AddUser';
import EditUserModal from './EditUserModal';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({});
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  
  // UI states
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load users data
  const loadUsers = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        userType: selectedUserType,
        status: selectedStatus,
        company: selectedCompany
      };
      
      const response = await authAPI.getAllUsers(params);
      
      if (response.success) {
        setUsers(response.data.users);
        setPagination(response.data.pagination);
        setFilters(response.data.filters);
      }
    } catch (error) {
      console.error('ManageUsers - Error loading users:', error);
      console.error('ManageUsers - Error response:', error.response?.data);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentPage, pageSize, searchTerm, selectedUserType, selectedStatus, selectedCompany]);

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
      case 'company':
        setSelectedCompany(value);
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
    setSelectedCompany('');
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
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowEditUser(true);
  };

  const handleUpdateUser = async (updatedUserData) => {
    try {
      console.log('ManageUsers - Updating user:', selectedUser._id, updatedUserData);
      const response = await authAPI.updateUser(selectedUser._id, updatedUserData);
      if (response.success) {
        console.log('ManageUsers - User updated successfully');
        loadUsers(); // Reload users
        setShowEditUser(false);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('ManageUsers - Error updating user:', error);
      setError('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      console.log('ManageUsers - Deleting user:', userId);
      const response = await authAPI.deleteUser(userId);
      if (response.success) {
        console.log('ManageUsers - User deleted successfully');
        loadUsers(); // Reload users
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('ManageUsers - Error deleting user:', error);
      setError('Failed to delete user');
    }
  };

  // Get user type icon
  const getUserTypeIcon = (userType) => {
    switch (userType) {
      case 'super_admin':
        return <Crown className="w-4 h-4 text-red-500" />;
      case 'company_admin':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'project_manager':
        return <BarChart3 className="w-4 h-4 text-green-500" />;
      case 'interviewer':
        return <UserCheck className="w-4 h-4 text-purple-500" />;
      case 'quality_agent':
        return <Shield className="w-4 h-4 text-orange-500" />;
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
            Back to Manage Users
          </button>
        </div>
        <AddUser onUserCreated={() => {
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
          <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-600 mt-1">View, edit, and manage all platform users</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
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
                placeholder="Search users by name, email, or phone..."
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* User Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                <select
                  value={selectedUserType}
                  onChange={(e) => handleFilterChange('userType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  {filters.userTypes?.map(type => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
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
                  {filters.statuses?.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => handleFilterChange('company', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Companies</option>
                  {filters.companies?.map(company => (
                    <option key={company._id} value={company._id}>
                      {company.companyName}
                    </option>
                  ))}
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
          Showing {users.length} of {pagination.totalUsers} users
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
            <span className="ml-2 text-gray-600">Loading users...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Users className="w-6 h-6 mr-2" />
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
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
                        <div className="w-10 h-10 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] rounded-full flex items-center justify-center text-white font-medium">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.company ? user.company.companyName : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-[#373177] hover:text-blue-800 transition-colors"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Delete User</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this user? This action cannot be undone.
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
