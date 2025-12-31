import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { 
  FileBarChart,
  Upload,
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  Loader,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import { reportAPI } from '../../services/api';

const GenerateReport = () => {
  const { showSuccess, showError } = useToast();
  const [excelFile, setExcelFile] = useState(null);
  const [referenceDate, setReferenceDate] = useState(() => {
    // Default to today's date
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingAudit, setGeneratingAudit] = useState(false);
  const [reportFile, setReportFile] = useState(null);
  const [auditFile, setAuditFile] = useState(null);
  const [uploadedExcelPath, setUploadedExcelPath] = useState(null);

  // Get today's date for max date validation
  const today = new Date().toISOString().split('T')[0];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
      ];
      const validExtensions = ['.xlsx', '.xls'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        showError(
          'Invalid File Type',
          'Please upload a valid Excel file (.xlsx or .xls)',
          5000
        );
        return;
      }

      // Validate file size (800MB max)
      if (file.size > 800 * 1024 * 1024) {
        showError(
          'File Too Large',
          'File size must be less than 800MB',
          5000
        );
        return;
      }

      setExcelFile(file);
      setReportFile(null);
      setAuditFile(null);
      setUploadedExcelPath(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await reportAPI.downloadTemplate();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'report_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess(
        'Template Downloaded',
        'Excel template has been downloaded successfully',
        3000
      );
    } catch (error) {
      console.error('Error downloading template:', error);
      showError(
        'Download Failed',
        error.response?.data?.message || error.message || 'Failed to download template',
        5000
      );
    }
  };

  const handleGenerateReport = async () => {
    if (!excelFile) {
      showError(
        'File Required',
        'Please upload an Excel file first',
        5000
      );
      return;
    }

    if (!referenceDate) {
      showError(
        'Date Required',
        'Please select a reference date',
        5000
      );
      return;
    }

    try {
      setGeneratingReport(true);
      setReportFile(null);
      setAuditFile(null);

      const response = await reportAPI.generateReport(excelFile, referenceDate);

      if (response.success) {
        setReportFile({
          fileName: response.fileName,
          filePath: response.filePath
        });
        // Store the Excel path for audit trail generation
        const excelPathToStore = response.excelPath || excelFile.name;
        setUploadedExcelPath(excelPathToStore);
        
        showSuccess(
          'Report Generated',
          'Report has been generated successfully. You can now download it.',
          5000
        );

        // Automatically start generating audit trail after a short delay
        setTimeout(() => {
          handleGenerateAuditTrail(excelPathToStore);
        }, 1000);
      } else {
        throw new Error(response.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      showError(
        'Generation Failed',
        error.response?.data?.message || error.message || 'Failed to generate report',
        6000
      );
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleGenerateAuditTrail = async (excelPath = null) => {
    const pathToUse = excelPath || uploadedExcelPath;
    
    if (!pathToUse) {
      showError(
        'Excel File Required',
        'Please generate the report first',
        5000
      );
      return;
    }

    try {
      setGeneratingAudit(true);
      setAuditFile(null);

      // Use the Excel path as-is (backend will handle finding the file)
      const excelFileName = pathToUse.includes('/') 
        ? pathToUse.split('/').pop() 
        : pathToUse;

      const response = await reportAPI.generateAuditTrail(excelFileName, referenceDate);

      if (response.success) {
        setAuditFile({
          fileName: response.fileName,
          filePath: response.filePath
        });
        
        showSuccess(
          'Audit Trail Generated',
          'Calculation audit trail has been generated successfully.',
          5000
        );
      } else {
        throw new Error(response.message || 'Failed to generate audit trail');
      }
    } catch (error) {
      console.error('Error generating audit trail:', error);
      showError(
        'Audit Generation Failed',
        error.response?.data?.message || error.message || 'Failed to generate audit trail',
        6000
      );
    } finally {
      setGeneratingAudit(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      const blob = await reportAPI.downloadFile(file.fileName);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess(
        'Download Started',
        `${file.fileName} is being downloaded`,
        3000
      );
    } catch (error) {
      console.error('Error downloading file:', error);
      showError(
        'Download Failed',
        error.response?.data?.message || error.message || 'Failed to download file',
        5000
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-[#373177] rounded-lg">
            <FileBarChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Generate Report</h1>
            <p className="text-gray-600 mt-1">
              Upload raw data with normalization weights and generate comprehensive reports with calculation audit trails
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="space-y-8">
          {/* Excel File Upload Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Raw Data Excel File</span>
              </div>
            </label>
            
            <div className="space-y-4">
              {/* Template Download */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="w-5 h-5 text-[#373177]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Download Excel Template</p>
                    <p className="text-xs text-gray-600">Get the template with column headers and structure</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors duration-200">
                <input
                  type="file"
                  id="excelFile"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="excelFile"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="p-4 bg-gray-100 rounded-full mb-4">
                    <Upload className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {excelFile ? excelFile.name : 'Click to upload Excel file'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {excelFile ? 'Click to change file' : 'Supports .xlsx and .xls files (max 800MB)'}
                  </p>
                </label>
              </div>

              {excelFile && (
                <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-700">{excelFile.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(excelFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    onClick={() => {
                      setExcelFile(null);
                      setReportFile(null);
                      setAuditFile(null);
                      setUploadedExcelPath(null);
                    }}
                    className="ml-auto p-1 hover:bg-green-100 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Date Selection Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Reference Date</span>
              </div>
            </label>
            <div className="max-w-xs">
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                max={today}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              <p className="text-xs text-gray-500 mt-2">
                Select the reference date for calculations (default: today, cannot select future dates)
              </p>
            </div>
          </div>

          {/* Generate Report Button */}
          <div>
            <button
              onClick={handleGenerateReport}
              disabled={!excelFile || generatingReport || generatingAudit}
              className={`w-full flex items-center justify-center space-x-2 px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
                !excelFile || generatingReport || generatingAudit
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#373177] to-[#373177] text-white hover:from-blue-700 hover:to-purple-700 transform hover:scale-[1.02] shadow-lg'
              }`}
            >
              {generatingReport ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <FileBarChart className="w-5 h-5" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>

          {/* Report Download Section */}
          {reportFile && (
            <div className="p-6 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Report Generated Successfully</p>
                    <p className="text-xs text-gray-600">{reportFile.fileName}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(reportFile)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          )}

          {/* Audit Trail Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Calculation Audit Trail</span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Complete audit of all calculations performed in the report
                </p>
              </div>
            </div>

            {generatingAudit && (
              <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <Loader className="w-5 h-5 animate-spin text-[#373177]" />
                  <span className="text-sm font-medium text-gray-700">Generating audit trail...</span>
                </div>
              </div>
            )}

            {auditFile && (
              <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Audit Trail Generated</p>
                      <p className="text-xs text-gray-600">{auditFile.fileName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(auditFile)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Audit</span>
                  </button>
                </div>
              </div>
            )}

            {!generatingAudit && !auditFile && reportFile && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  Audit trail will be generated automatically after report generation.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateReport;


