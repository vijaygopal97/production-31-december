/**
 * Main Stress Test Orchestrator
 * Runs the complete stress test workflow:
 * 1. Generate test data
 * 2. Run stress test with monitoring
 * 3. Generate reports
 * 4. Optionally cleanup test data
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class StressTestOrchestrator {
  constructor() {
    this.scriptsDir = __dirname;
    this.reportDir = path.join(__dirname, '../reports');
    this.dataDir = path.join(__dirname, '../data');
    this.testId = `quality-checks-${Date.now()}`;
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`\n▶️  Running: ${command} ${args.join(' ')}`);
      
      const proc = spawn(command, args, {
        cwd: this.scriptsDir,
        stdio: 'inherit',
        ...options
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Command completed successfully\n`);
          resolve();
        } else {
          console.error(`❌ Command failed with code ${code}\n`);
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });
      
      proc.on('error', (error) => {
        console.error(`❌ Error running command: ${error.message}\n`);
        reject(error);
      });
    });
  }

  async step1_GenerateTestData() {
    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: Generating Test Data');
    console.log('='.repeat(80));
    
    await this.runCommand('node', ['generate-test-data.js']);
    
    // Verify test data was created
    const summaryFile = path.join(this.dataDir, 'test-data-summary.json');
    if (!fs.existsSync(summaryFile)) {
      throw new Error('Test data summary file not found after generation');
    }
    
    console.log('✅ Test data generation complete');
  }

  async step2_RunStressTest() {
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: Running Stress Test');
    console.log('='.repeat(80));
    
    await this.runCommand('node', ['emulate-quality-checks.js']);
    
    console.log('✅ Stress test execution complete');
  }

  async step3_GenerateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: Generating Report');
    console.log('='.repeat(80));
    
    // Find the latest test ID from results files
    const files = fs.readdirSync(this.reportDir).filter(f => f.startsWith('results-'));
    if (files.length === 0) {
      throw new Error('No results files found');
    }
    
    // Extract test ID from the most recent file
    const latestFile = files.sort().reverse()[0];
    const testId = latestFile.replace('results-', '').replace('.json', '');
    
    await this.runCommand('node', ['generate-report.js', testId]);
    
    console.log('✅ Report generation complete');
    return testId;
  }

  async step4_Cleanup(confirm = false) {
    if (!confirm) {
      console.log('\n⚠️  Skipping cleanup (use --cleanup flag to enable)');
      return;
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: Cleaning Up Test Data');
    console.log('='.repeat(80));
    
    await this.runCommand('node', ['cleanup-test-data.js']);
    
    console.log('✅ Cleanup complete');
  }

  async run(options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('\n🚀 Starting Stress Test Orchestration');
      console.log(`📅 Test ID: ${this.testId}`);
      console.log(`📁 Reports Directory: ${this.reportDir}\n`);
      
      // Step 1: Generate test data
      await this.step1_GenerateTestData();
      
      // Step 2: Run stress test
      await this.step2_RunStressTest();
      
      // Step 3: Generate report
      const testId = await this.step3_GenerateReport();
      
      // Step 4: Cleanup (if requested)
      await this.step4_Cleanup(options.cleanup);
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n' + '='.repeat(80));
      console.log('✅ STRESS TEST COMPLETE');
      console.log('='.repeat(80));
      console.log(`⏱️  Total Time: ${totalTime} seconds`);
      console.log(`📊 Test ID: ${testId}`);
      console.log(`📄 Report: ${path.join(this.reportDir, `report-${testId}.html`)}`);
      console.log(`📈 Metrics CSV: ${path.join(this.reportDir, `metrics-${testId}.csv`)}`);
      console.log('='.repeat(80) + '\n');
      
    } catch (error) {
      console.error('\n❌ STRESS TEST FAILED');
      console.error('Error:', error.message);
      console.error('\n⚠️  Test data may still exist. Run cleanup script manually if needed.');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {
    cleanup: args.includes('--cleanup')
  };
  
  const orchestrator = new StressTestOrchestrator();
  await orchestrator.run(options);
}

if (require.main === module) {
  main();
}

module.exports = StressTestOrchestrator;





