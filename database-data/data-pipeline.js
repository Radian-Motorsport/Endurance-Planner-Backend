const refreshSeasonsData = require('./refresh-seasons-data');
const refreshSchedulesData = require('./refresh-schedules-data');
const refreshCarsData = require('./refresh-cars-data');
const refreshTracksData = require('./refresh-tracks-data');
const refreshDriversData = require('./refresh-drivers-data');
const config = require('./config.json');

/**
 * Data Pipeline Orchestrator
 * Manages the complete iRacing data refresh process
 */

class DataPipeline {
    constructor() {
        this.results = {};
        this.errors = [];
        this.startTime = new Date();
    }

    /**
     * Run a single refresh operation with error handling
     */
    async runOperation(name, operation, priority = 'normal') {
        try {
            console.log(`\\n${'='.repeat(60)}`);
            console.log(`🚀 Starting: ${name}`);
            console.log(`${'='.repeat(60)}`);
            
            const startTime = new Date();
            const result = await operation();
            const duration = new Date() - startTime;
            
            this.results[name] = {
                success: true,
                duration: `${Math.round(duration / 1000)}s`,
                result,
                priority
            };
            
            console.log(`✅ ${name} completed in ${Math.round(duration / 1000)}s`);
            
        } catch (error) {
            console.error(`❌ ${name} failed:`, error.message);
            
            this.results[name] = {
                success: false,
                error: error.message,
                priority
            };
            
            this.errors.push({ operation: name, error: error.message, priority });
            
            // For high priority operations, stop the pipeline
            if (priority === 'high') {
                throw new Error(`High priority operation ${name} failed: ${error.message}`);
            }
        }
    }

    /**
     * Run full data refresh pipeline
     */
    async runFullRefresh() {
        try {
            console.log('🌟 STARTING FULL iRACING DATA REFRESH PIPELINE');
            console.log(`📅 Started at: ${this.startTime.toISOString()}`);
            console.log(`📊 Rate limit: ${config.apiLimits.maxRequestsPerHour} requests/hour`);
            
            // High priority: Core racing data
            await this.runOperation('Seasons Data', refreshSeasonsData, 'high');
            await this.runOperation('Schedules Data', refreshSchedulesData, 'high');
            
            // Medium priority: Supporting data
            await this.runOperation('Drivers Data', refreshDriversData, 'medium');
            
            // Low priority: Reference data (less frequent updates needed)
            await this.runOperation('Cars Data', refreshCarsData, 'low');
            await this.runOperation('Tracks Data', refreshTracksData, 'low');
            
        } catch (error) {
            console.error('❌ Pipeline stopped due to high priority failure:', error.message);
        }
        
        await this.generateSummaryReport();
    }

    /**
     * Run quick refresh (high priority only)
     */
    async runQuickRefresh() {
        try {
            console.log('⚡ STARTING QUICK iRACING DATA REFRESH');
            console.log(`📅 Started at: ${this.startTime.toISOString()}`);
            
            await this.runOperation('Seasons Data', refreshSeasonsData, 'high');
            await this.runOperation('Schedules Data', refreshSchedulesData, 'high');
            
        } catch (error) {
            console.error('❌ Quick refresh failed:', error.message);
        }
        
        await this.generateSummaryReport();
    }

    /**
     * Run weekly refresh (racing data + drivers)
     */
    async runWeeklyRefresh() {
        try {
            console.log('📅 STARTING WEEKLY iRACING DATA REFRESH');
            console.log(`📅 Started at: ${this.startTime.toISOString()}`);
            
            await this.runOperation('Seasons Data', refreshSeasonsData, 'high');
            await this.runOperation('Schedules Data', refreshSchedulesData, 'high');
            await this.runOperation('Drivers Data', refreshDriversData, 'medium');
            
        } catch (error) {
            console.error('❌ Weekly refresh failed:', error.message);
        }
        
        await this.generateSummaryReport();
    }

    /**
     * Generate comprehensive summary report
     */
    async generateSummaryReport() {
        const endTime = new Date();
        const totalDuration = endTime - this.startTime;
        
        const summary = {
            pipeline: {
                startTime: this.startTime.toISOString(),
                endTime: endTime.toISOString(),
                totalDuration: `${Math.round(totalDuration / 1000)}s`,
                operationsRun: Object.keys(this.results).length,
                successfulOperations: Object.values(this.results).filter(r => r.success).length,
                failedOperations: this.errors.length
            },
            results: this.results,
            errors: this.errors,
            recommendations: this.generateRecommendations()
        };
        
        // Save summary
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fs = require('fs').promises;
        const summaryFilename = `pipeline-summary-${timestamp}.json`;
        await fs.writeFile(summaryFilename, JSON.stringify(summary, null, 2));
        
        // Console output
        console.log(`\\n${'='.repeat(80)}`);
        console.log('📊 PIPELINE SUMMARY REPORT');
        console.log(`${'='.repeat(80)}`);
        console.log(`⏱️  Total Duration: ${Math.round(totalDuration / 1000)}s`);
        console.log(`✅ Successful: ${summary.pipeline.successfulOperations}/${summary.pipeline.operationsRun} operations`);
        console.log(`❌ Failed: ${summary.pipeline.failedOperations} operations`);
        
        if (this.errors.length > 0) {
            console.log('\\n🚨 Errors:');
            this.errors.forEach(error => {
                console.log(`   ❌ ${error.operation}: ${error.error}`);
            });
        }
        
        console.log('\\n📈 Operation Results:');
        Object.entries(this.results).forEach(([name, result]) => {
            const status = result.success ? '✅' : '❌';
            const duration = result.duration || 'N/A';
            console.log(`   ${status} ${name}: ${duration}`);
        });
        
        if (summary.recommendations.length > 0) {
            console.log('\\n💡 Recommendations:');
            summary.recommendations.forEach(rec => {
                console.log(`   💡 ${rec}`);
            });
        }
        
        console.log(`\\n📁 Summary saved: ${summaryFilename}`);
        
        return summary;
    }

    /**
     * Generate recommendations based on results
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.errors.length > 0) {
            recommendations.push('Review failed operations and check API credentials/rate limits');
        }
        
        const highPriorityFailures = this.errors.filter(e => e.priority === 'high');
        if (highPriorityFailures.length > 0) {
            recommendations.push('High priority failures detected - these should be resolved immediately');
        }
        
        const successfulOps = Object.values(this.results).filter(r => r.success).length;
        if (successfulOps === Object.keys(this.results).length) {
            recommendations.push('All operations successful - consider running database deployment scripts');
        }
        
        return recommendations;
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    const pipeline = new DataPipeline();
    
    switch (command) {
        case 'full':
            await pipeline.runFullRefresh();
            break;
        case 'quick':
            await pipeline.runQuickRefresh();
            break;
        case 'weekly':
            await pipeline.runWeeklyRefresh();
            break;
        case 'seasons':
            await pipeline.runOperation('Seasons Data', refreshSeasonsData);
            await pipeline.generateSummaryReport();
            break;
        case 'schedules':
            await pipeline.runOperation('Schedules Data', refreshSchedulesData);
            await pipeline.generateSummaryReport();
            break;
        case 'cars':
            await pipeline.runOperation('Cars Data', refreshCarsData);
            await pipeline.generateSummaryReport();
            break;
        case 'tracks':
            await pipeline.runOperation('Tracks Data', refreshTracksData);
            await pipeline.generateSummaryReport();
            break;
        case 'drivers':
            await pipeline.runOperation('Drivers Data', refreshDriversData);
            await pipeline.generateSummaryReport();
            break;
        default:
            console.log('🚀 iRacing Data Pipeline');
            console.log('');
            console.log('Usage: node data-pipeline.js <command>');
            console.log('');
            console.log('Commands:');
            console.log('  full     - Run complete data refresh (all operations)');
            console.log('  quick    - Run quick refresh (seasons + schedules only)');
            console.log('  weekly   - Run weekly refresh (seasons + schedules + drivers)');
            console.log('  seasons  - Refresh seasons data only');
            console.log('  schedules- Refresh schedules data only');
            console.log('  cars     - Refresh cars data only');
            console.log('  tracks   - Refresh tracks data only');
            console.log('  drivers  - Refresh drivers data only');
            console.log('');
            console.log('Examples:');
            console.log('  node data-pipeline.js full');
            console.log('  node data-pipeline.js quick');
            console.log('  node data-pipeline.js drivers');
            process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('✅ Pipeline completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Pipeline failed:', error.message);
            process.exit(1);
        });
}

module.exports = DataPipeline;