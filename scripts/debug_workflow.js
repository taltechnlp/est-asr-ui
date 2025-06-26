#!/usr/bin/env node

/**
 * Debug script for Nextflow workflow progress
 * Usage: node scripts/debug_workflow.js <fileId|externalId>
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function debugWorkflow(identifier) {
    try {
        const url = new URL('/api/process/debug', BASE_URL);
        
        // Determine if it's a fileId or externalId
        // FileId is typically 30 characters, externalId is longer
        if (identifier.length === 30) {
            url.searchParams.set('fileId', identifier);
        } else {
            url.searchParams.set('externalId', identifier);
        }

        console.log(`🔍 Debugging workflow for: ${identifier}`);
        console.log(`📡 Requesting: ${url.toString()}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error ${response.status}: ${errorText}`);
            return;
        }

        const data = await response.json();
        
        console.log('\n📊 WORKFLOW DEBUG REPORT');
        console.log('=' .repeat(50));
        
        // File info
        console.log(`📁 File: ${data.file.filename}`);
        console.log(`🆔 ID: ${data.file.id}`);
        console.log(`🔗 External ID: ${data.file.externalId}`);
        console.log(`📋 State: ${data.file.state}`);
        console.log(`🌐 Language: ${data.file.language}`);
        
        // Progress info
        console.log(`\n📈 Progress: ${data.progress.current}%`);
        if (data.progress.details) {
            console.log(`📊 Method: ${data.progress.details.method}`);
            if (data.progress.details.totalProcesses) {
                console.log(`🔢 Total Processes: ${data.progress.details.totalProcesses}`);
                console.log(`✅ Completed: ${data.progress.details.completedProcesses}`);
            }
            if (data.progress.details.succeededCount !== undefined) {
                console.log(`✅ Succeeded: ${data.progress.details.succeededCount}`);
                console.log(`❌ Failed: ${data.progress.details.failedCount}`);
                console.log(`🔄 Running: ${data.progress.details.runningCount}`);
                console.log(`⏳ Pending: ${data.progress.details.pendingCount}`);
            }
        }
        
        // Analysis
        console.log(`\n🔍 Analysis:`);
        console.log(`   Should be READY: ${data.analysis.shouldBeReady ? '✅' : '❌'}`);
        console.log(`   Has completed event: ${data.analysis.hasCompletedEvent ? '✅' : '❌'}`);
        console.log(`   Has failed processes: ${data.analysis.hasFailedProcesses ? '⚠️' : '✅'}`);
        console.log(`   Total workflow events: ${data.analysis.totalWorkflowEvents}`);
        console.log(`   Total process events: ${data.analysis.totalProcessEvents}`);
        
        // Workflow events
        if (data.workflows && data.workflows.length > 0) {
            console.log(`\n🔄 Workflow Events:`);
            data.workflows.forEach((wf, index) => {
                console.log(`   ${index + 1}. ${wf.event} (${wf.utcTime})`);
                console.log(`      Run ID: ${wf.runId}`);
                console.log(`      Progress Length: ${wf.progressLength || 'N/A'}`);
                console.log(`      Succeeded: ${wf.succeededCount || 0}`);
                console.log(`      Failed: ${wf.failedCount || 0}`);
                console.log(`      Running: ${wf.runningCount || 0}`);
                console.log(`      Pending: ${wf.pendingCount || 0}`);
                console.log(`      Processes: ${wf.processCount}`);
            });
        }
        
        // Process details (show first few)
        if (data.workflows && data.workflows.length > 0 && data.workflows[0].processes) {
            const processes = data.workflows[0].processes;
            console.log(`\n⚙️  Recent Processes (showing first 5):`);
            processes.slice(0, 5).forEach((p, index) => {
                console.log(`   ${index + 1}. ${p.process} (${p.status})`);
                console.log(`      Task ID: ${p.taskId}`);
                console.log(`      Tag: ${p.tag || 'N/A'}`);
            });
            
            if (processes.length > 5) {
                console.log(`   ... and ${processes.length - 5} more processes`);
            }
        }
        
        console.log('\n' + '=' .repeat(50));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Main execution
const identifier = process.argv[2];

if (!identifier) {
    console.error('❌ Usage: node scripts/debug_workflow.js <fileId|externalId>');
    console.error('   Example: node scripts/debug_workflow.js abc123def456ghi789jkl012mno345');
    console.error('   Example: node scripts/debug_workflow.js my-workflow-name');
    process.exit(1);
}

debugWorkflow(identifier); 