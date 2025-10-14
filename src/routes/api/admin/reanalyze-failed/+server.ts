import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';

/**
 * Re-trigger auto-analysis for files that have autoAnalyze=true but:
 * - Have analysisStatus = 'not_started' or null, OR
 * - Have 0 transcriptCorrections
 *
 * This is a one-time fix for files affected by the segment extraction bug
 * before it was fixed.
 */
export const POST: RequestHandler = async ({ locals, fetch }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Find files that need re-analysis
		const files = await prisma.file.findMany({
			where: {
				state: 'READY',
				autoAnalyze: true,
				OR: [
					{
						analysisStatus: {
							in: ['not_started', null]
						}
					},
					{
						analysisStatus: 'failed'
					}
				]
			},
			select: {
				id: true,
				filename: true,
				analysisStatus: true,
				transcriptCorrections: {
					select: {
						id: true,
						status: true
					}
				}
			}
		});

		// Filter to only files with 0 or failed corrections
		const filesToReanalyze = files.filter((file) => {
			const hasNoCorrections = file.transcriptCorrections.length === 0;
			const hasOnlyFailedCorrections =
				file.transcriptCorrections.length > 0 &&
				file.transcriptCorrections.every((c) => c.status === 'failed');

			return hasNoCorrections || hasOnlyFailedCorrections || file.analysisStatus === 'failed';
		});

		console.log(`[REANALYZE] Found ${filesToReanalyze.length} files to re-analyze`);

		const results = [];

		// Re-trigger analysis for each file
		for (const file of filesToReanalyze) {
			try {
				console.log(
					`[REANALYZE] Triggering analysis for ${file.filename} (${file.id}) - Status: ${file.analysisStatus}, Corrections: ${file.transcriptCorrections.length}`
				);

				const response = await fetch('/api/transcript-analysis/auto-analyze', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ fileId: file.id })
				});

				if (response.ok) {
					const result = await response.json();
					results.push({
						fileId: file.id,
						filename: file.filename,
						success: true,
						result
					});
					console.log(`[REANALYZE] Successfully triggered analysis for ${file.filename}`);
				} else {
					const errorText = await response.text();
					results.push({
						fileId: file.id,
						filename: file.filename,
						success: false,
						error: errorText
					});
					console.error(`[REANALYZE] Failed to trigger analysis for ${file.filename}: ${errorText}`);
				}
			} catch (error) {
				results.push({
					fileId: file.id,
					filename: file.filename,
					success: false,
					error: error instanceof Error ? error.message : String(error)
				});
				console.error(
					`[REANALYZE] Exception while triggering analysis for ${file.filename}:`,
					error
				);
			}

			// Add small delay between requests to avoid overloading
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		const successCount = results.filter((r) => r.success).length;
		const failureCount = results.filter((r) => !r.success).length;

		return json({
			success: true,
			message: `Re-analyzed ${successCount} files (${failureCount} failed)`,
			filesFound: filesToReanalyze.length,
			successCount,
			failureCount,
			results
		});
	} catch (error) {
		console.error('[REANALYZE] Error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
