import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Homepage from './components/Homepage';
import About from './components/About';
import Contact from './components/Contact';
import Register from './components/Register';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import AdminDashboard from './components/dashboard/AdminDashboard';
import CompanyAdminDashboard from './components/dashboard/CompanyAdminDashboard';
import ProjectManagerDashboard from './components/dashboard/ProjectManagerDashboard';
import InterviewerDashboard from './components/dashboard/InterviewerDashboard';
import QualityAgentDashboard from './components/dashboard/QualityAgentDashboard';
import DataAnalystDashboard from './components/dashboard/DataAnalystDashboard';
import ComingSoon from './components/dashboard/ComingSoon';
import ViewResponsesPage from './pages/ViewResponsesPage';
import ViewResponsesV2Page from './pages/ViewResponsesV2Page';
import SurveyReportsPage from './pages/SurveyReportsPage';
import SurveyReportsV2Page from './pages/SurveyReportsV2Page';
import CallerPerformancePage from './pages/CallerPerformancePage';
import QCPerformancePage from './pages/QCPerformancePage';
import QCBatchesPage from './pages/QCBatchesPage';
import FindingsDashboard from './pages/FindingsDashboard';
import PageTitleManager from './components/PageTitleManager';
import './App.css';

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
          <div className="App">
            <PageTitleManager />
            <Routes>
            {/* Public routes with Header and Footer */}
            <Route path="/" element={
              <>
                <Header />
                <Homepage />
                <Footer />
              </>
            } />
            <Route path="/about" element={
              <>
                <Header />
                <About />
                <Footer />
              </>
            } />
            <Route path="/contact" element={
              <>
                <Header />
                <Contact />
                <Footer />
              </>
            } />
            <Route path="/register" element={
              <>
                <Header />
                <Register />
                <Footer />
              </>
            } />
            <Route path="/login" element={
              <>
                <Header />
                <Login />
                <Footer />
              </>
            } />
            <Route path="/forgot-password" element={
              <>
                <Header />
                <ForgotPassword />
                <Footer />
              </>
            } />
            
            {/* Super Admin routes */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/add-user" element={<AdminDashboard />} />
            <Route path="/admin/manage-users" element={<AdminDashboard />} />
            <Route path="/admin/manage-companies" element={<AdminDashboard />} />
            <Route path="/admin/document-verification" element={<AdminDashboard />} />
            <Route path="/admin/survey-templates" element={<AdminDashboard />} />
            <Route path="/admin/reports" element={<AdminDashboard />} />
            <Route path="/admin/settings" element={<AdminDashboard />} />
            <Route path="/admin/profile" element={<AdminDashboard />} />
            
            {/* Company Admin routes */}
            <Route path="/company/dashboard" element={<AdminDashboard />} />
            <Route path="/company/team-management" element={<AdminDashboard />} />
            <Route path="/company/surveys" element={<AdminDashboard />} />
            <Route path="/company/survey-approvals" element={<AdminDashboard />} />
            <Route path="/company/document-verification" element={<AdminDashboard />} />
            <Route path="/company/performance" element={<AdminDashboard />} />
            <Route path="/company/generate-report" element={<AdminDashboard />} />
            <Route path="/company/payment-settings" element={<AdminDashboard />} />
            <Route path="/company/account-settings" element={<AdminDashboard />} />
            <Route path="/company/profile" element={<AdminDashboard />} />
            
            {/* Survey Responses Page */}
            <Route path="/company/surveys/:surveyId/responses" element={<ViewResponsesPage />} />
            
            {/* Survey Responses V2 Page (Optimized) */}
            <Route path="/company/surveys/:surveyId/responses-v2" element={<ViewResponsesV2Page />} />
            
            {/* Survey Reports Page */}
            <Route path="/company/surveys/:surveyId/reports" element={<SurveyReportsPage />} />
            
            {/* Survey Reports V2 Page (Optimized) */}
            <Route path="/company/surveys/:surveyId/reports-2" element={<SurveyReportsV2Page />} />
            
            {/* Caller Performance Page */}
            <Route path="/company/surveys/:surveyId/caller-performance" element={<CallerPerformancePage />} />
            
            {/* QC Performance Page */}
            <Route path="/company/surveys/:surveyId/qc-performance" element={<QCPerformancePage />} />
            
            {/* QC Batches Page */}
            <Route path="/company/surveys/:surveyId/qc-batches" element={<QCBatchesPage />} />
            
            {/* Findings Dashboard Page */}
            <Route path="/company/surveys/:surveyId/findings" element={<FindingsDashboard />} />
            
            {/* Project Manager routes */}
            <Route path="/project-manager/survey-reports" element={<AdminDashboard />} />
            <Route path="/project-manager/team-management" element={<AdminDashboard />} />
            <Route path="/project-manager/surveys/:surveyId/reports" element={<AdminDashboard />} />
            <Route path="/project-manager/surveys/:surveyId/reports-2" element={<SurveyReportsV2Page />} />
            <Route path="/project-manager/surveys/:surveyId/caller-performance" element={<CallerPerformancePage />} />
            <Route path="/project-manager/surveys/:surveyId/responses" element={<ViewResponsesPage />} />
            <Route path="/project-manager/surveys/:surveyId/responses-v2" element={<ViewResponsesV2Page />} />
            <Route path="/project-manager/surveys/:surveyId/qc-performance" element={<AdminDashboard />} />
            
            {/* Interviewer routes */}
            <Route path="/interviewer/dashboard" element={<AdminDashboard />} />
            <Route path="/interviewer/available-surveys" element={<AdminDashboard />} />
            <Route path="/interviewer/my-interviews" element={<AdminDashboard />} />
            <Route path="/interviewer/performance" element={<AdminDashboard />} />
            <Route path="/interviewer/payments-history" element={<AdminDashboard />} />
            <Route path="/interviewer/payment-settings" element={<AdminDashboard />} />
            <Route path="/interviewer/profile" element={<AdminDashboard />} />
            
            {/* Quality Agent routes */}
            <Route path="/quality-agent/dashboard" element={<AdminDashboard />} />
            <Route path="/quality-agent/available-surveys" element={<AdminDashboard />} />
            <Route path="/quality-agent/survey-approvals" element={<AdminDashboard />} />
            <Route path="/quality-agent/validation-history" element={<AdminDashboard />} />
            <Route path="/quality-agent/performance" element={<AdminDashboard />} />
            <Route path="/quality-agent/payments-history" element={<AdminDashboard />} />
            <Route path="/quality-agent/payment-settings" element={<AdminDashboard />} />
            <Route path="/quality-agent/profile" element={<AdminDashboard />} />
            
            {/* Data Analyst routes */}
            <Route path="/data-analyst/dashboard" element={<AdminDashboard />} />
            <Route path="/data-analyst/available-gigs" element={<AdminDashboard />} />
            <Route path="/data-analyst/my-work" element={<AdminDashboard />} />
            <Route path="/data-analyst/performance" element={<AdminDashboard />} />
            <Route path="/data-analyst/payments-history" element={<AdminDashboard />} />
            <Route path="/data-analyst/payment-settings" element={<AdminDashboard />} />
            <Route path="/data-analyst/profile" element={<AdminDashboard />} />
            
            {/* Default dashboard route */}
            <Route path="/dashboard" element={<AdminDashboard />} />
            </Routes>
          </div>
        </Router>
        </ToastProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;