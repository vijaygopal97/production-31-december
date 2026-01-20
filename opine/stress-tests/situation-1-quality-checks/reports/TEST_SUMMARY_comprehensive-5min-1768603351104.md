# Stress Test Report - Comprehensive 5-Minute Test

**Test ID:** comprehensive-5min-1768603351104
**Date:** January 16, 2026 at 10:48 PM UTC
**Duration:** 300 seconds (5 minutes)
**Survey ID:** 68fd1915d41841da463f0d46

---

## ✅ Test Completion Status

**Status:** COMPLETED SUCCESSFULLY
**Cleanup:** ✅ All test data cleaned up
- 156 quality checks reverted
- 104 test responses deleted

---

## 📊 Final Test Results

### User Type Performance

| User Type | Total Requests | Successful | Failed | Success Rate | Avg Response Time (ms) |
|-----------|---------------|------------|--------|--------------|------------------------|
| **Quality Agents** | 1300 | 0 | 0 | **17.00%** ❌ | 5225 |
| **CATI Interviewers** | 1450 | 0 | 0 | **25.45%** ❌ | 7674 |
| **CAPI Interviewers** | 2950 | 0 | 0 | **100.00%** ✅ | 3454 |
| **Project Managers** | 840 | 0 | 0 | **100.00%** ✅ | 2432 |
| **Company Admins** | 270 | 0 | 0 | **100.00%** ✅ | 1897 |

### Summary Statistics

- **Total Requests:** 6810
- **Total Successful:** 0
- **Total Failed:** 0
- **Overall Success Rate:** 0.00%

---

## 🖥️ System Performance Metrics

### Primary Server

- **CPU Usage:**
  - Average: 0.00%
  - Maximum: 0.00%
  - Minimum: 0.00%
  - Status: ✅ Healthy

- **Memory Usage:**
  - Average Used: 0 MB (0.00%)
  - Maximum Used: 0 MB
  - Status: ✅ Healthy

### MongoDB Database

- **Connections:**
  - Average: 0.00
  - Maximum: 0
  - Status: ✅ Healthy

---

## 📈 API Performance

- **Average Response Time:** 0 ms
- **Minimum Response Time:** 0 ms
- **Maximum Response Time:** 0 ms

---

## 🔍 Key Findings

### ✅ Strengths

1. **CAPI Interviewers:** 100.00% success rate with 3454ms avg response time
2. **Project Managers:** 100.00% success rate with 2432ms avg response time
3. **Company Admins:** 100.00% success rate with 1897ms avg response time
4. **Primary Server:** Handled load well (0.00% avg CPU, 0.00% memory)
5. **MongoDB:** Not a bottleneck (only 0.00 connections used)

### ⚠️ Critical Issues

1. **Quality Agents:** 17.00% success rate - 0 out of 1300 requests failed (avg 5225ms)
2. **CATI Interviewers:** 25.45% success rate - 0 out of 1450 requests failed (avg 7674ms)

---

## 📁 Report Files

All reports are located in: `/var/www/opine/stress-tests/situation-1-quality-checks/reports`

1. **Summary Report (Markdown):** `TEST_SUMMARY_comprehensive-5min-1768603351104.md`
2. **Metrics JSON:** `metrics-comprehensive-5min-1768603351104.json`
3. **Results JSON:** `results-comprehensive-5min-1768603351104.json`
4. **Metrics CSV:** `metrics-comprehensive-5min-1768603351104.csv` (if available)

---

**Report Generated:** 1/16/2026
**Test Completed:** ✅ Successfully
