import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import SuperAdminDashboard from './SuperAdminDashboard';
import CompanyAdminDashboard from './CompanyAdminDashboard';
import ProjectManagerDashboard from './ProjectManagerDashboard';
import ProjectManagerSurveyReports from './ProjectManagerSurveyReports';
import ProjectManagerSurveyReportsPage from './ProjectManagerSurveyReportsPage';
import ProjectManagerQCPerformancePage from './ProjectManagerQCPerformancePage';
import ProjectManagerTeamManagement from './ProjectManagerTeamManagement';
import InterviewerDashboard from './InterviewerDashboard';
import QualityAgentDashboard from './QualityAgentDashboard';
import DataAnalystDashboard from './DataAnalystDashboard';
import ComingSoon from './ComingSoon';
import AddUser from './AddUser';
import ManageUsers from './ManageUsers';
import ManageCompanies from './ManageCompanies';
import CompanyAdminUserManagement from './CompanyAdminUserManagement';
import CompanySurveysManagement from './CompanySurveysManagement';
import AvailableSurveys from './AvailableSurveys';
import MyInterviews from './MyInterviews';
import SurveyApprovals from './SurveyApprovals';
import InterviewerProfile from './InterviewerProfile';
import PerformanceMonitoring from './PerformanceMonitoring';
import QualityAgentPerformanceMonitoring from './QualityAgentPerformanceMonitoring';
import DocumentVerification from './DocumentVerification';
import SuperAdminDocumentVerification from './SuperAdminDocumentVerification';
import ProfileCompletionGate from './ProfileCompletionGate';
import GenerateReport from './GenerateReport';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboard = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      window.location.href = '/login';
    }
  }, [loading, isAuthenticated]);

  // Get the current path to determine which component to render
  const getCurrentComponent = () => {
    const path = location.pathname;
    
    // Super Admin specific routes
    if (user?.userType === 'super_admin') {
      if (path === '/admin/add-user') {
      return <AddUser />;
      }
      if (path === '/admin/manage-users') {
        return <ManageUsers />;
      }
      if (path === '/admin/manage-companies') {
        return <ManageCompanies />;
      }
      if (path === '/admin/document-verification') {
        return <SuperAdminDocumentVerification />;
      }
      if (path === '/admin/survey-templates') {
        return <ComingSoon title="Survey Templates" description="Manage and create survey templates for your platform" features={["Template Library", "Custom Templates", "Category Management", "Template Sharing"]} />;
      }
      if (path === '/admin/reports') {
        return <ComingSoon title="Reports & Analytics" description="Comprehensive reporting and analytics dashboard" features={["Revenue Reports", "User Analytics", "Performance Metrics", "Export Options"]} />;
      }
      if (path === '/admin/settings') {
        return <ComingSoon title="System Settings" description="Configure platform settings and preferences" features={["System Configuration", "Security Settings", "API Management", "Backup Options"]} />;
      }
      if (path === '/admin/profile') {
        return <ComingSoon title="Profile Settings" description="Manage your admin profile and preferences" features={["Profile Information", "Security Settings", "Notification Preferences", "Account Management"]} />;
      }
      return <SuperAdminDashboard />;
    }
    
    // Company Admin routes
    if (user?.userType === 'company_admin') {
      if (path === '/company/dashboard') {
        return <CompanyAdminDashboard />;
      }
      if (path === '/company/team-management') {
        return <CompanyAdminUserManagement />;
      }
      if (path === '/company/surveys') {
        return <CompanySurveysManagement />;
      }
      if (path === '/company/survey-approvals') {
        return <SurveyApprovals />;
      }
      if (path === '/company/document-verification') {
        return <DocumentVerification />;
      }
      if (path === '/company/performance') {
        return <PerformanceMonitoring />;
      }
      if (path === '/company/payment-settings') {
        return <ComingSoon title="Payment Settings" description="Configure payment methods and settings" features={["Payment Gateways", "Pricing Configuration", "Payment History", "Financial Reports"]} />;
      }
      if (path === '/company/account-settings') {
        return <ComingSoon title="Account Settings" description="Manage your company account settings" features={["Company Information", "Billing Settings", "Security Configuration", "Integration Settings"]} />;
      }
      if (path === '/company/profile') {
        return <ComingSoon title="Profile Settings" description="Manage your personal profile and preferences" features={["Personal Information", "Contact Details", "Notification Settings", "Account Security"]} />;
      }
      if (path === '/company/generate-report') {
        return <GenerateReport />;
      }
      return <CompanyAdminDashboard />;
    }
    
    // Project Manager routes
    if (user?.userType === 'project_manager') {
      if (path === '/project-manager/survey-reports') {
        return <ProjectManagerSurveyReports />;
      }
      if (path === '/project-manager/team-management') {
        return <ProjectManagerTeamManagement />;
      }
      if (path.startsWith('/project-manager/surveys/') && path.endsWith('/reports')) {
        return <ProjectManagerSurveyReportsPage />;
      }
      if (path.startsWith('/project-manager/surveys/') && path.endsWith('/qc-performance')) {
        return <ProjectManagerQCPerformancePage />;
      }
      // Default to survey reports
      return <ProjectManagerSurveyReports />;
    }
    
    // Interviewer routes
    if (user?.userType === 'interviewer') {
      // Profile page is always accessible
      if (path === '/interviewer/profile') {
        return <InterviewerProfile />;
      }
      
      // All other routes are wrapped with ProfileCompletionGate
      if (path === '/interviewer/dashboard') {
        return (
          <ProfileCompletionGate>
            <InterviewerDashboard />
          </ProfileCompletionGate>
        );
      }
      if (path === '/interviewer/available-surveys') {
        return (
          <ProfileCompletionGate>
            <AvailableSurveys />
          </ProfileCompletionGate>
        );
      }
      if (path === '/interviewer/my-interviews') {
        return (
          <ProfileCompletionGate>
            <MyInterviews />
          </ProfileCompletionGate>
        );
      }
      if (path === '/interviewer/performance') {
        return (
          <ProfileCompletionGate>
            <PerformanceMonitoring />
          </ProfileCompletionGate>
        );
      }
      if (path === '/interviewer/payments-history') {
        return (
          <ProfileCompletionGate>
            <ComingSoon title="Payments History" description="View your payment history and earnings" features={["Payment History", "Earnings Breakdown", "Payment Status", "Financial Reports"]} />
          </ProfileCompletionGate>
        );
      }
      if (path === '/interviewer/payment-settings') {
        return (
          <ProfileCompletionGate>
            <ComingSoon title="Payment Settings" description="Configure your payment preferences" features={["Bank Details", "Payment Methods", "Tax Information", "Payment Preferences"]} />
          </ProfileCompletionGate>
        );
      }
      
      // Default route for interviewer - redirect to profile if not complete, otherwise dashboard
      return (
        <ProfileCompletionGate>
          <InterviewerDashboard />
        </ProfileCompletionGate>
      );
    }
    
    // Quality Agent routes
    if (user?.userType === 'quality_agent') {
      if (path === '/quality-agent/dashboard') {
        return <QualityAgentDashboard />;
      }
      if (path === '/quality-agent/available-surveys') {
        return <ComingSoon title="Available Interviews" description="Review interviews assigned for quality validation" features={["Validation Queue", "Interview Details", "Quality Metrics", "Assignment Priority"]} />;
      }
      if (path === '/quality-agent/survey-approvals') {
        return <SurveyApprovals />;
      }
      if (path === '/quality-agent/validation-history') {
        return <ComingSoon title="Validation History" description="View your validation history and performance" features={["Validation Records", "Quality Scores", "Feedback History", "Performance Trends"]} />;
      }
      if (path === '/quality-agent/performance') {
        return <QualityAgentPerformanceMonitoring />;
      }
      if (path === '/quality-agent/payments-history') {
        return <ComingSoon title="Payments History" description="View your payment history and earnings" features={["Payment History", "Earnings Breakdown", "Payment Status", "Financial Reports"]} />;
      }
      if (path === '/quality-agent/payment-settings') {
        return <ComingSoon title="Payment Settings" description="Configure your payment preferences" features={["Bank Details", "Payment Methods", "Tax Information", "Payment Preferences"]} />;
      }
      if (path === '/quality-agent/profile') {
        return <ComingSoon title="Profile Settings" description="Manage your quality agent profile" features={["Personal Information", "Skills & Expertise", "Availability Settings", "Contact Preferences"]} />;
      }
      return <QualityAgentDashboard />;
    }
    
    // Data Analyst routes
    if (user?.userType === 'Data_Analyst') {
      if (path === '/data-analyst/dashboard') {
        return <DataAnalystDashboard />;
      }
      if (path === '/data-analyst/available-gigs') {
        return <ComingSoon title="Available Gigs" description="Browse available data analysis opportunities" features={["Analysis Gigs", "Project Details", "Complexity Levels", "Payment Information"]} />;
      }
      if (path === '/data-analyst/my-work') {
        return <ComingSoon title="My Work" description="Manage your analysis projects and assignments" features={["Active Projects", "Work History", "Project Status", "Delivery Tracking"]} />;
      }
      if (path === '/data-analyst/performance') {
        return <ComingSoon title="Performance Monitoring" description="Track your analysis performance and metrics" features={["Analysis Metrics", "Quality Scores", "Client Ratings", "Performance Reports"]} />;
      }
      if (path === '/data-analyst/payments-history') {
        return <ComingSoon title="Payments History" description="View your payment history and earnings" features={["Payment History", "Earnings Breakdown", "Payment Status", "Financial Reports"]} />;
      }
      if (path === '/data-analyst/payment-settings') {
        return <ComingSoon title="Payment Settings" description="Configure your payment preferences" features={["Bank Details", "Payment Methods", "Tax Information", "Payment Preferences"]} />;
      }
      if (path === '/data-analyst/profile') {
        return <ComingSoon title="Profile Settings" description="Manage your data analyst profile" features={["Personal Information", "Skills & Expertise", "Portfolio Management", "Contact Preferences"]} />;
      }
      return <DataAnalystDashboard />;
    }
    
    // Default fallback
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome, {user?.firstName} {user?.lastName}!
        </h2>
        <p className="text-gray-600">
          Dashboard for {user?.userType?.replace('_', ' ')} is coming soon.
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout user={user}>
      {getCurrentComponent()}
    </DashboardLayout>
  );
};

export default AdminDashboard;
