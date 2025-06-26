# Workflow Debugging Guide

## Problem Description

The original system had issues with:
1. **Hardcoded progress calculation**: Using `Math.floor(processes.length / 30 * 100)` which didn't adapt to different workflow sizes
2. **Poor event logging**: Minimal logging made it difficult to debug workflow issues
3. **Inconsistent READY state**: Files weren't properly marked as READY even when workflows completed
4. **120% progress display**: Progress could exceed 100% due to inaccurate calculations

## Improvements Made

### 1. Enhanced Event Logging

The `/api/process` endpoint now includes comprehensive logging:

```typescript
console.log(`[WORKFLOW EVENT] Received ${workflow.event} event for run: ${workflow.runName}`, {
    event: workflow.event,
    runName: workflow.runName,
    runId: workflow.runId,
    utcTime: workflow.utcTime,
    hasTrace: !!workflow.trace,
    hasMetadata: !!workflow.metadata,
    metadataStats: workflow.metadata?.workflow?.stats
});
```

**Benefits:**
- Track all workflow events in real-time
- Debug missing or incorrect events
- Monitor progress calculation accuracy

### 2. Dynamic Progress Calculation

Replaced the hardcoded progress calculation with a three-tier approach:

#### Method 1: Workflow Statistics (Most Accurate)
```typescript
if (workflow.progressLength && workflow.progressLength > 0) {
    const totalProcesses = workflow.progressLength;
    const completedProcesses = (workflow.succeededCount || 0) + (workflow.failedCount || 0);
    progress = Math.min(100, Math.floor((completedProcesses / totalProcesses) * 100));
}
```

#### Method 2: Process Count Fallback
```typescript
else if (workflow.processes && workflow.processes.length > 0) {
    const completedProcesses = workflow.processes.filter(p => 
        p.status === 'COMPLETED' || p.status === 'ERROR' || p.status === 'FAILED'
    ).length;
    const estimatedTotal = Math.max(workflow.processes.length, 20);
    progress = Math.min(100, Math.floor((completedProcesses / estimatedTotal) * 100));
}
```

#### Method 3: Event-Based Estimation
```typescript
else if (workflow.event) {
    const eventProgress = {
        'started': 10,
        'process_submitted': 20,
        'process_started': 30,
        'process_completed': 80,
        'completed': 100,
        'error': 0
    };
    progress = eventProgress[workflow.event] || 0;
}
```

**Benefits:**
- Adapts to different workflow sizes automatically
- Prevents progress from exceeding 100%
- Provides fallback methods for different scenarios

### 3. Improved READY State Logic

Enhanced the completion detection:

```typescript
else if (workflow.event === "completed") {
    console.log(`[WORKFLOW COMPLETION] Checking completion criteria:`, {
        succeededCount: workflow.metadata.workflow.stats.succeededCount,
        progressLength: workflow.metadata.workflow.stats.progressLength,
        isEqual: workflow.metadata.workflow.stats.succeededCount === workflow.metadata.workflow.stats.progressLength
    });
    
    if (workflow.metadata.workflow.stats.succeededCount === workflow.metadata.workflow.stats.progressLength) {
        // Set file to READY
    } else {
        console.log(`[WORKFLOW WARNING] Completed event received but not all processes succeeded`);
    }
}
```

**Benefits:**
- Clear logging of completion criteria
- Better error detection when completion is incomplete
- Prevents premature READY state

### 4. Debug API Endpoint

Created `/api/process/debug` endpoint for troubleshooting:

**Usage:**
```bash
# Debug by file ID
GET /api/process/debug?fileId=abc123def456ghi789jkl012mno345

# Debug by external ID
GET /api/process/debug?externalId=my-workflow-name
```

**Response includes:**
- File information and current state
- Detailed progress calculation breakdown
- All workflow events and their statistics
- Process-level details
- Analysis of completion status

### 5. Debug Script

Created `scripts/debug_workflow.js` for command-line debugging:

```bash
# Debug by file ID
node scripts/debug_workflow.js abc123def456ghi789jkl012mno345

# Debug by external ID
node scripts/debug_workflow.js my-workflow-name
```

**Features:**
- Colorful, formatted output
- Comprehensive workflow analysis
- Process-level details
- Completion status analysis

## How to Use

### 1. Monitor Workflow Events

Check server logs for workflow events:
```bash
# Look for workflow event logs
grep "WORKFLOW EVENT" /path/to/server.log

# Look for progress calculation logs
grep "PROGRESS DEBUG" /path/to/server.log
```

### 2. Debug Specific Files

Use the debug script:
```bash
# Find the file ID or external ID from your database or logs
node scripts/debug_workflow.js <identifier>
```

### 3. Check API Endpoint

Access the debug API directly:
```bash
curl "http://localhost:5173/api/process/debug?fileId=your-file-id"
```

### 4. Monitor Progress Calculation

The system now logs detailed progress information:
```
[PROGRESS DEBUG] Calculating progress for file example.mp3
[PROGRESS DEBUG] Using workflow stats: 15/20 = 75%
[PROGRESS FINAL] File example.mp3 progress: 75%
```

## Troubleshooting Common Issues

### Issue: Progress Shows 120%

**Cause:** Old hardcoded calculation method
**Solution:** The new system prevents progress > 100%

### Issue: File Not Marked as READY

**Debug Steps:**
1. Use debug script to check workflow events
2. Look for "WORKFLOW COMPLETION" logs
3. Verify `succeededCount === progressLength`

### Issue: Missing Workflow Events

**Debug Steps:**
1. Check Nextflow weblog configuration
2. Monitor "WORKFLOW EVENT" logs
3. Verify API endpoint is accessible

### Issue: Inaccurate Progress

**Debug Steps:**
1. Check "PROGRESS DEBUG" logs
2. Verify workflow statistics are being received
3. Use debug API to analyze calculation method

## Database Schema

The system uses these key fields for progress tracking:

- `NfWorkflow.progressLength`: Total expected processes
- `NfWorkflow.succeededCount`: Successfully completed processes
- `NfWorkflow.failedCount`: Failed processes
- `NfWorkflow.runningCount`: Currently running processes
- `NfWorkflow.pendingCount`: Pending processes
- `NfWorkflow.event`: Current workflow event

## Best Practices

1. **Monitor logs regularly** for workflow events and progress calculations
2. **Use the debug tools** when investigating issues
3. **Check completion criteria** when files aren't marked as READY
4. **Verify Nextflow configuration** if events are missing
5. **Test with different file sizes** to ensure progress calculation adapts

## Future Improvements

1. **Real-time progress updates** via WebSocket
2. **Progress history tracking** to show trends
3. **Automated alerting** for stuck workflows
4. **Performance metrics** for workflow optimization
5. **Visual progress dashboard** for administrators 