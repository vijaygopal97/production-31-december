/**
 * System Monitor for Stress Tests
 * Tracks API call performance and system metrics
 */

const fs = require('fs');
const path = require('path');

class SystemMonitor {
  constructor(testId, reportDir) {
    this.testId = testId;
    this.reportDir = reportDir;
    this.metrics = {
      apiCalls: [],
      startTime: null,
      endTime: null
    };
    this.intervalId = null;
    this.metricsFile = path.join(reportDir, `metrics-${testId}.json`);
  }

  start(intervalMs = 1000) {
    this.metrics.startTime = Date.now();
    console.log(`📊 System monitor started (metrics will be saved to ${this.metricsFile})`);
    
    // Save metrics periodically
    this.intervalId = setInterval(() => {
      this.saveMetrics();
    }, intervalMs * 10); // Save every 10 seconds
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.metrics.endTime = Date.now();
    this.saveMetrics();
    
    return {
      totalCalls: this.metrics.apiCalls.length,
      duration: this.metrics.endTime - this.metrics.startTime,
      avgResponseTime: this.metrics.apiCalls.length > 0
        ? this.metrics.apiCalls.reduce((sum, call) => sum + call.responseTime, 0) / this.metrics.apiCalls.length
        : 0,
      minResponseTime: this.metrics.apiCalls.length > 0
        ? Math.min(...this.metrics.apiCalls.map(c => c.responseTime))
        : 0,
      maxResponseTime: this.metrics.apiCalls.length > 0
        ? Math.max(...this.metrics.apiCalls.map(c => c.responseTime))
        : 0
    };
  }

  recordAPICall(responseTime) {
    this.metrics.apiCalls.push({
      responseTime,
      timestamp: Date.now()
    });
    
    // Keep only last 10000 calls in memory to prevent memory leaks
    if (this.metrics.apiCalls.length > 10000) {
      this.metrics.apiCalls = this.metrics.apiCalls.slice(-10000);
    }
  }

  saveMetrics() {
    try {
      if (!fs.existsSync(this.reportDir)) {
        fs.mkdirSync(this.reportDir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.metricsFile,
        JSON.stringify(this.metrics, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving metrics:', error.message);
    }
  }
}

module.exports = SystemMonitor;
