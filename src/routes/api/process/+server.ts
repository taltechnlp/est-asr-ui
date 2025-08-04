import type { RequestHandler } from './$types';
import { prisma } from '$lib/db/client';
import type { IWeblog } from '$lib/helpers/api.d';
import { sendEmail, createEmail } from '$lib/email';
import { ORIGIN } from '$env/static/private';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const workflow: IWeblog = await request.json();
	if (!workflow) {
		console.error('Nextflow sent an empty POST message.');
		return new Response('Unexpected POST message format', { status: 400 });
	} else {
		const file = await prisma.file.findFirst({
			where: {
				externalId: workflow.runName
			},
			select: {
				id: true,
				externalId: true,
				filename: true,
				notify: true,
				User: {
					select: {
						email: true
					}
				}
			}
		});
		if (!file) {
			console.error(`File not found in database for externalId: ${workflow.runName}`);
			return new Response('File not found in the database.', { status: 404 });
		}

		// trace is only provided for the following events: process_submitted, process_started, process_completed, error
		if (workflow.trace) {
			try {
				await prisma.nfWorkflow.upsert({
					where: {
						run_name: file.externalId
					},
					create: {
						run_id: workflow.runId,
						event: workflow.event,
						run_name: workflow.runName,
						file: {
							connect: {
								id: file.id
							}
						},
						utc_time: new Date(workflow.utcTime),
						processes: {
							create: {
								task_id: workflow.trace.task_id,
								process: workflow.trace.process,
								tag: workflow.trace.tag,
								hash: workflow.trace.hash,
								status: workflow.trace.status,
								exit: workflow.trace.exit ? new Date(workflow.trace.exit) : null,
								submit: workflow.trace.submit ? new Date(workflow.trace.submit) : null,
								start: workflow.trace.start ? new Date(workflow.trace.start) : null,
								complete: workflow.trace.complete ? new Date(workflow.trace.complete) : null,
								duration: workflow.trace.duration,
								realtime: workflow.trace.realtime
							}
						}
					},
					update: {
						run_id: workflow.runId,
						// event: workflow.event,  Avoid overwriting the workflow status / event
						run_name: workflow.runName,
						file: {
							connect: {
								id: file.id
							}
						},
						utc_time: new Date(workflow.utcTime),
						processes: {
							create: {
								task_id: workflow.trace.task_id,
								process: workflow.trace.process,
								tag: workflow.trace.tag,
								hash: workflow.trace.hash,
								status: workflow.trace.status,
								exit: workflow.trace.exit ? new Date(workflow.trace.exit) : null,
								submit: workflow.trace.submit ? new Date(workflow.trace.submit) : null,
								start: workflow.trace.start ? new Date(workflow.trace.start) : null,
								complete: workflow.trace.complete ? new Date(workflow.trace.complete) : null,
								duration: workflow.trace.duration,
								realtime: workflow.trace.realtime
							}
						}
					}
				});
			} catch (e) {
				console.error('Failed to save trace event to database:', e);
			}
		} else if (workflow.event === 'error') {
			try {
				await prisma.nfWorkflow.upsert({
					where: {
						run_name: file.externalId
					},
					create: {
						run_id: workflow.runId,
						event: workflow.event,
						run_name: workflow.runName,
						file: {
							connect: {
								id: file.id
							}
						},
						utc_time: new Date(workflow.utcTime),
						failedCount: 1
					},
					update: {
						run_id: workflow.runId,
						event: workflow.event,
						run_name: workflow.runName,
						file: {
							connect: {
								id: file.id
							}
						},
						utc_time: new Date(workflow.utcTime),
						failedCount: 1
					}
				});
			} catch (e) {
				console.error('Failed to save error event to database:', e);
			}
		}
		// metadata is only provided for the following events: started, completed
		else if (workflow.metadata) {
			try {
				const updatedWf = await prisma.nfWorkflow.upsert({
					where: {
						run_name: file.externalId
					},
					create: {
						run_id: workflow.runId,
						event: workflow.event,
						run_name: workflow.runName,
						file: {
							connect: {
								id: file.id
							}
						},
						utc_time: new Date(workflow.utcTime),
						succeededCount: workflow.metadata.workflow.stats.succeededCount,
						runningCount: workflow.metadata.workflow.stats.runningCount,
						pendingCount: workflow.metadata.workflow.stats.pendingCount,
						failedCount: workflow.metadata.workflow.stats.failedCount,
						progressLength: workflow.metadata.workflow.stats.progressLength
					},
					update: {
						run_id: workflow.runId,
						event: workflow.event,
						run_name: workflow.runName,
						file: {
							connect: {
								id: file.id
							}
						},
						utc_time: new Date(workflow.utcTime),
						succeededCount: workflow.metadata.workflow.stats.succeededCount,
						runningCount: workflow.metadata.workflow.stats.runningCount,
						pendingCount: workflow.metadata.workflow.stats.pendingCount,
						failedCount: workflow.metadata.workflow.stats.failedCount,
						progressLength: workflow.metadata.workflow.stats.progressLength
					},
					select: {
						file_id: true
					}
				});

				if (workflow.metadata.workflow.stats.failedCount > 0) {
					try {
						await prisma.file.update({
							data: { state: 'PROCESSING_ERROR' },
							where: {
								id: updatedWf.file_id
							}
						});

						if (file.notify) {
							await sendEmail({
								to: file.User.email,
								subject: 'Transkribeerimine ebaõnnestus - tekstiks.ee',
								html: createEmail(`Teenusel tekstiks.ee ei õnnestunud teie faili paraku transkribeerida.
                                
                                \n\n
                                Rikete kohta võib infot saada kasutajatoelt, kirjutades konetuvastus@taltech.ee aadressile.

                                \n\n
                                <a href="${ORIGIN}/files">Klõpsa siia, et tutvuda oma ülesse laaditud failidega.</a>`)
							});
							await prisma.file.update({
								data: {
									notified: true
								},
								where: {
									id: updatedWf.file_id
								}
							});
						}
					} catch (e) {
						console.error('Failed to save failed transcription or send email notification:', e);
					}
				} else {
					const stats = workflow.metadata.workflow.stats;
					const totalCompleted = (stats.succeededCount || 0) + (stats.failedCount || 0);
					const totalExpected = stats.progressLength;

					// Mark as READY if we get a 'completed' event with no failures
					// This handles cases where workflows have fewer steps than expected
					if (workflow.event === 'completed' && (stats.failedCount || 0) === 0) {
						try {
							await prisma.file.update({
								data: { state: 'READY' },
								where: {
									id: updatedWf.file_id
								}
							});
							console.log(`Transcription completed successfully for file: ${file.filename}`);

							if (file.notify) {
								await sendEmail({
									to: file.User.email,
									subject: 'Transkribeerimine õnnestus - tekstiks.ee',
									html: createEmail(
										`Teie faili nimega ${file.filename} transkribeerimine on lõpetatud!\n\n<a href=\"${ORIGIN}/files/${file.id}\">Tuvastatud tekst asub siin.</a>`
									)
								});
								await prisma.file.update({
									data: {
										notified: true
									},
									where: {
										id: updatedWf.file_id
									}
								});
							}
						} catch (e) {
							console.error(
								'Failed to save successful transcription result or send email notification:',
								e
							);
						}
					} else if (totalExpected && totalCompleted === totalExpected) {
						// Fallback: Set READY if all expected processes are finished (succeeded or failed)
						try {
							await prisma.file.update({
								data: { state: 'READY' },
								where: {
									id: updatedWf.file_id
								}
							});
							console.log(`Transcription completed successfully for file: ${file.filename}`);

							if (file.notify) {
								await sendEmail({
									to: file.User.email,
									subject: 'Transkribeerimine õnnestus - tekstiks.ee',
									html: createEmail(
										`Teie faili nimega ${file.filename} transkribeerimine on lõpetatud!\n\n<a href=\"${ORIGIN}/files/${file.id}\">Tuvastatud tekst asub siin.</a>`
									)
								});
								await prisma.file.update({
									data: {
										notified: true
									},
									where: {
										id: updatedWf.file_id
									}
								});
							}
						} catch (e) {
							console.error(
								'Failed to save successful transcription result or send email notification:',
								e
							);
						}
					}
				}
			} catch (e) {
				console.error('Failed to save metadata event to database:', e);
			}
		}
		return new Response('received', { status: 200 });
	}
};
