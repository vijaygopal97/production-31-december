# Stress Test Report - Comprehensive 5-Minute Test

**Test ID:** comprehensive-5min-1768701722990
**Date:** January 18, 2026 at 02:07 AM UTC
**Duration:** 300 seconds (5 minutes)
**Survey ID:** 68fd1915d41841da463f0d46

---

## ✅ Test Completion Status

**Status:** COMPLETED SUCCESSFULLY
**Cleanup:** ✅ All test data cleaned up
- 944 quality checks reverted
- 104 test responses deleted

---

## 📊 Final Test Results

### User Type Performance

| User Type | Total Requests | Successful | Failed | Success Rate | Avg Response Time (ms) |
|-----------|---------------|------------|--------|--------------|------------------------|
| **Quality Agents** | 2200 | 0 | 0 | **44.45%** ❌ | 2493 |
| **CATI Interviewers** | 1850 | 0 | 0 | **49.30%** ❌ | 3672 |
| **CAPI Interviewers** | 3200 | 0 | 0 | **100.00%** ✅ | 2992 |
| **Project Managers** | 990 | 0 | 0 | **100.00%** ✅ | 1739 |
| **Company Admins** | 294 | 0 | 0 | **100.00%** ✅ | 1580 |

### Summary Statistics

- **Total Requests:** 8534
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

1. **CAPI Interviewers:** 100.00% success rate with 2992ms avg response time
2. **Project Managers:** 100.00% success rate with 1739ms avg response time
3. **Company Admins:** 100.00% success rate with 1580ms avg response time
4. **Primary Server:** Handled load well (0.00% avg CPU, 0.00% memory)
5. **MongoDB:** Not a bottleneck (only 0.00 connections used)

### ⚠️ Critical Issues

1. **Quality Agents:** 44.45% success rate - 0 out of 2200 requests failed (avg 2493ms)
2. **CATI Interviewers:** 49.30% success rate - 0 out of 1850 requests failed (avg 3672ms)

---

## 📁 Report Files

All reports are located in: `/var/www/opine/stress-tests/situation-1-quality-checks/reports`

1. **Summary Report (Markdown):** `TEST_SUMMARY_comprehensive-5min-1768701722990.md`
2. **Metrics JSON:** `metrics-comprehensive-5min-1768701722990.json`
3. **Results JSON:** `results-comprehensive-5min-1768701722990.json`
4. **Metrics CSV:** `metrics-comprehensive-5min-1768701722990.csv` (if available)

---

**Report Generated:** 1/18/2026
**Test Completed:** ✅ Successfully
