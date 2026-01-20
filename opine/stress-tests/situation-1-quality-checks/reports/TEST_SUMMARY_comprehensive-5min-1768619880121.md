# Stress Test Report - Comprehensive 5-Minute Test

**Test ID:** comprehensive-5min-1768619880121
**Date:** January 17, 2026 at 03:23 AM UTC
**Duration:** 300 seconds (5 minutes)
**Survey ID:** 68fd1915d41841da463f0d46

---

## ✅ Test Completion Status

**Status:** COMPLETED SUCCESSFULLY
**Cleanup:** ✅ All test data cleaned up
- 19 quality checks reverted
- 0 test responses deleted

---

## 📊 Final Test Results

### User Type Performance

| User Type | Total Requests | Successful | Failed | Success Rate | Avg Response Time (ms) |
|-----------|---------------|------------|--------|--------------|------------------------|
| **Quality Agents** | 2150 | 0 | 0 | **45.67%** ❌ | 2319 |
| **CATI Interviewers** | 1350 | 0 | 0 | **48.67%** ❌ | 4382 |
| **CAPI Interviewers** | 3500 | 0 | 0 | **100.00%** ✅ | 2954 |
| **Project Managers** | 910 | 0 | 0 | **100.00%** ✅ | 1775 |
| **Company Admins** | 286 | 0 | 0 | **100.00%** ✅ | 1624 |

### Summary Statistics

- **Total Requests:** 8196
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

1. **CAPI Interviewers:** 100.00% success rate with 2954ms avg response time
2. **Project Managers:** 100.00% success rate with 1775ms avg response time
3. **Company Admins:** 100.00% success rate with 1624ms avg response time
4. **Primary Server:** Handled load well (0.00% avg CPU, 0.00% memory)
5. **MongoDB:** Not a bottleneck (only 0.00 connections used)

### ⚠️ Critical Issues

1. **Quality Agents:** 45.67% success rate - 0 out of 2150 requests failed (avg 2319ms)
2. **CATI Interviewers:** 48.67% success rate - 0 out of 1350 requests failed (avg 4382ms)

---

## 📁 Report Files

All reports are located in: `/var/www/opine/stress-tests/situation-1-quality-checks/reports`

1. **Summary Report (Markdown):** `TEST_SUMMARY_comprehensive-5min-1768619880121.md`
2. **Metrics JSON:** `metrics-comprehensive-5min-1768619880121.json`
3. **Results JSON:** `results-comprehensive-5min-1768619880121.json`
4. **Metrics CSV:** `metrics-comprehensive-5min-1768619880121.csv` (if available)

---

**Report Generated:** 1/17/2026
**Test Completed:** ✅ Successfully
