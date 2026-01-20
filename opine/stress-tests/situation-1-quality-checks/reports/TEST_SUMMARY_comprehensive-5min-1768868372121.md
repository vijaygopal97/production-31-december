# Stress Test Report - Comprehensive 5-Minute Test

**Test ID:** comprehensive-5min-1768868372121
**Date:** January 20, 2026 at 12:25 AM UTC
**Duration:** 300 seconds (5 minutes)
**Survey ID:** 68fd1915d41841da463f0d46

---

## ✅ Test Completion Status

**Status:** COMPLETED SUCCESSFULLY
**Cleanup:** ✅ All test data cleaned up
- 1273 quality checks reverted
- 102 test responses deleted

---

## 📊 Final Test Results

### User Type Performance

| User Type | Total Requests | Successful | Failed | Success Rate | Avg Response Time (ms) |
|-----------|---------------|------------|--------|--------------|------------------------|
| **Quality Agents** | 3550 | 0 | 0 | **39.61%** ❌ | 1608 |
| **CATI Interviewers** | 2300 | 0 | 0 | **46.13%** ❌ | 3432 |
| **CAPI Interviewers** | 4100 | 0 | 0 | **100.00%** ✅ | 2485 |
| **Project Managers** | 1250 | 0 | 0 | **100.00%** ✅ | 1436 |
| **Company Admins** | 312 | 0 | 0 | **100.00%** ✅ | 1458 |

### Summary Statistics

- **Total Requests:** 11512
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

1. **CAPI Interviewers:** 100.00% success rate with 2485ms avg response time
2. **Project Managers:** 100.00% success rate with 1436ms avg response time
3. **Company Admins:** 100.00% success rate with 1458ms avg response time
4. **Primary Server:** Handled load well (0.00% avg CPU, 0.00% memory)
5. **MongoDB:** Not a bottleneck (only 0.00 connections used)

### ⚠️ Critical Issues

1. **Quality Agents:** 39.61% success rate - 0 out of 3550 requests failed (avg 1608ms)
2. **CATI Interviewers:** 46.13% success rate - 0 out of 2300 requests failed (avg 3432ms)

---

## 📁 Report Files

All reports are located in: `/var/www/opine/stress-tests/situation-1-quality-checks/reports`

1. **Summary Report (Markdown):** `TEST_SUMMARY_comprehensive-5min-1768868372121.md`
2. **Metrics JSON:** `metrics-comprehensive-5min-1768868372121.json`
3. **Results JSON:** `results-comprehensive-5min-1768868372121.json`
4. **Metrics CSV:** `metrics-comprehensive-5min-1768868372121.csv` (if available)

---

**Report Generated:** 1/20/2026
**Test Completed:** ✅ Successfully
