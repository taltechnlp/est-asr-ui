import type { RequestHandler } from './$types';
import { prisma } from "$lib/db/client";
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
    const fileId = url.searchParams.get('fileId');
    const externalId = url.searchParams.get('externalId');
    
    if (!fileId && !externalId) {
        return json({ error: 'Either fileId or externalId parameter is required' }, { status: 400 });
    }

    try {
        let file;
        
        if (fileId) {
            file = await prisma.file.findUnique({
                where: { id: fileId },
                include: {
                    workflows: {
                        orderBy: { utc_time: 'desc' },
                        include: {
                            processes: {
                                orderBy: { submit: 'desc' }
                            }
                        }
                    }
                }
            });
        } else {
            file = await prisma.file.findFirst({
                where: { externalId },
                include: {
                    workflows: {
                        orderBy: { utc_time: 'desc' },
                        include: {
                            processes: {
                                orderBy: { submit: 'desc' }
                            }
                        }
                    }
                }
            });
        }

        if (!file) {
            return json({ error: 'File not found' }, { status: 404 });
        }

        // Calculate current progress
        let progress = -1;
        let progressDetails = null;
        
        if (file.workflows && file.workflows.length > 0) {
            const workflow = file.workflows[0];
            
            if (workflow.progressLength && workflow.progressLength > 0) {
                const totalProcesses = workflow.progressLength;
                const completedProcesses = (workflow.succeededCount || 0) + (workflow.failedCount || 0);
                progress = Math.min(100, Math.floor((completedProcesses / totalProcesses) * 100));
                
                progressDetails = {
                    method: 'workflow_stats',
                    totalProcesses,
                    completedProcesses,
                    succeededCount: workflow.succeededCount || 0,
                    failedCount: workflow.failedCount || 0,
                    runningCount: workflow.runningCount || 0,
                    pendingCount: workflow.pendingCount || 0
                };
            } else if (workflow.processes && workflow.processes.length > 0) {
                const completedProcesses = workflow.processes.filter(p => 
                    p.status === 'COMPLETED' || p.status === 'ERROR' || p.status === 'FAILED'
                ).length;
                const totalProcesses = workflow.processes.length;
                const estimatedTotal = Math.max(totalProcesses, 20);
                progress = Math.min(100, Math.floor((completedProcesses / estimatedTotal) * 100));
                
                progressDetails = {
                    method: 'process_count_fallback',
                    totalProcesses: estimatedTotal,
                    completedProcesses,
                    actualProcessCount: totalProcesses
                };
            } else if (workflow.event) {
                const eventProgress = {
                    'started': 10,
                    'process_submitted': 20,
                    'process_started': 30,
                    'process_completed': 80,
                    'completed': 100,
                    'error': 0
                };
                progress = eventProgress[workflow.event] || 0;
                
                progressDetails = {
                    method: 'event_based',
                    event: workflow.event,
                    estimatedProgress: progress
                };
            }
        }

        const debugInfo = {
            file: {
                id: file.id,
                filename: file.filename,
                externalId: file.externalId,
                state: file.state,
                language: file.language
            },
            workflows: file.workflows.map(wf => ({
                runId: wf.run_id,
                event: wf.event,
                utcTime: wf.utc_time,
                progressLength: wf.progressLength,
                succeededCount: wf.succeededCount,
                runningCount: wf.runningCount,
                pendingCount: wf.pendingCount,
                failedCount: wf.failedCount,
                processCount: wf.processes.length,
                processes: wf.processes.map(p => ({
                    taskId: p.task_id,
                    process: p.process,
                    status: p.status,
                    tag: p.tag,
                    submit: p.submit,
                    start: p.start,
                    complete: p.complete
                }))
            })),
            progress: {
                current: progress,
                details: progressDetails
            },
            analysis: {
                shouldBeReady: file.state === 'READY',
                hasCompletedEvent: file.workflows.some(wf => wf.event === 'completed'),
                hasFailedProcesses: file.workflows.some(wf => (wf.failedCount || 0) > 0),
                totalWorkflowEvents: file.workflows.length,
                totalProcessEvents: file.workflows.reduce((sum, wf) => sum + wf.processes.length, 0)
            }
        };

        return json(debugInfo);
    } catch (error) {
        console.error('[DEBUG API ERROR]', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}; 