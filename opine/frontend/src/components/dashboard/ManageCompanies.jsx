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
  Building2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  X,
  Check,
  Users,
  Mail,
  Phone,
  Globe,
  Calendar,
  MapPin
} from 'lucide-react';
import { companyAPI } from '../../services/api';
import EditCompanyModal from './EditCompanyModal';

const ManageCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({});

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // UI states
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load companies data
  const loadCompanies = async () => {
    try {
      setLoading(true);

      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        status: selectedStatus,
        industry: selectedIndustry
      };

      const response = await companyAPI.getAllCompanies(params);

      if (response.success) {
        setCompanies(response.data.companies);
        setPagination(response.data.pagination);
        setFilters(response.data.filters);
      }
    } catch (error) {
      console.error('ManageCompanies - Error loading companies:', error);
      setError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [currentPage, pageSize, searchTerm, selectedStatus, selectedIndustry]);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle filters
  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'status':
        setSelectedStatus(value);
        break;
      case 'industry':
        setSelectedIndustry(value);
        break;
      default:
        break;
    }
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setSelectedIndustry('');
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

  // Handle company actions
  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setShowEditCompany(true);
  };

  const handleUpdateCompany = async (updatedCompanyData) => {
    try {
      const response = await companyAPI.updateCompany(selectedCompany._id, updatedCompanyData);
      if (response.success) {
        loadCompanies(); // Reload companies
        setShowEditCompany(false);
        setSelectedCompany(null);
      }
    } catch (error) {
      console.error('ManageCompanies - Error updating company:', error);
      setError('Failed to update company');
    }
  };

  const handleDeleteCompany = async (companyId) => {
    try {
      const response = await companyAPI.deleteCompany(companyId);
      if (response.success) {
        loadCompanies(); // Reload companies
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('ManageCompanies - Error deleting company:', error);
      setError('Failed to delete company');
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="w-3 h-3" /> },
      inactive: { color: 'bg-gray-100 text-gray-800', icon: <XCircle className="w-3 h-3" /> },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Companies</h1>
          <p className="text-gray-600 mt-1">View, edit, and manage all companies</p>
        </div>
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
                placeholder="Search companies by name, code, industry, or email..."
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

              {/* Industry Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => handleFilterChange('industry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Industries</option>
                  {filters.industries?.map(industry => (
                    <option key={industry} value={industry}>
                      {industry}
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
          Showing {companies.length} of {pagination.totalCompanies} companies
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

      {/* Companies Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-[#001D48]" />
            <span className="ml-2 text-gray-600">Loading companies...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Building2 className="w-6 h-6 mr-2" />
            No companies found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
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
                {companies.map((company) => (
                  <tr key={company._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] rounded-full flex items-center justify-center text-white font-medium">
                          {company.companyName.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {company.companyName}
                          </div>
                          <div className="text-sm text-gray-500">Code: {company.companyCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{company.industry || '-'}</div>
                      <div className="text-sm text-gray-500">{company.companySize || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {company.companyEmail}
                      </div>
                      {company.companyPhone && (
                        <div className="text-sm text-gray-500 flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {company.companyPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(company.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditCompany(company)}
                          className="text-[#001D48] hover:text-[#001D48] transition-colors"
                          title="Edit Company"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(company._id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Delete Company"
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

      {/* Edit Company Modal */}
      {showEditCompany && selectedCompany && (
        <EditCompanyModal
          company={selectedCompany}
          onSave={handleUpdateCompany}
          onCancel={() => {
            setShowEditCompany(false);
            setSelectedCompany(null);
          }}
        />
      )}
      

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Delete Company</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this company? This action cannot be undone and will affect all associated users.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCompany(deleteConfirm)}
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

export default ManageCompanies;
