import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSummaryGenerator } from '$lib/agents/summaryGenerator';
import { extractFullTextWithSpeakers } from '$lib/utils/extractWordsFromEditor';
import { prisma } from '$lib/db/client';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { isSupportedLanguage } from '$lib/utils/language';

const GenerateSummarySchema = z.object({
	fileId: z.string(),
	forceRegenerate: z.boolean().default(false),
	uiLanguage: z.string().optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Parse and validate request
		const body = await request.json();
		const { fileId, forceRegenerate, uiLanguage } = GenerateSummarySchema.parse(body);

		// Validate UI language if provided
		if (uiLanguage && !isSupportedLanguage(uiLanguage)) {
			return json({ error: 'Unsupported UI language' }, { status: 400 });
		}

		// Get file and verify ownership
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				uploader: true,
				initialTranscription: true,
				initialTranscriptionPath: true,
				text: true,
				language: true
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		if (file.uploader !== session.user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Parse the transcription content
		let transcriptText: string;

		// Try to load from file path first
		if (file.initialTranscriptionPath) {
			try {
				const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');
				const transcriptionData = JSON.parse(content);

				// Check if it's TipTap format or plain text
				if (transcriptionData.type === 'doc' && transcriptionData.content) {
					// TipTap format - extract text with speakers
					transcriptText = extractFullTextWithSpeakers(transcriptionData);
				} else if (typeof transcriptionData === 'string') {
					// Plain text
					transcriptText = transcriptionData;
				} else {
					// Try to extract text from other formats
					transcriptText = JSON.stringify(transcriptionData);
				}
			} catch (error) {
				console.error('Failed to read transcription file:', error);
				// Fall back to other fields
			}
		}

		// If no transcriptText yet, try other fields
		if (!transcriptText) {
			if (file.text) {
				transcriptText = file.text;
			} else if (file.initialTranscription) {
				try {
					const transcriptionData = JSON.parse(file.initialTranscription);
					if (transcriptionData.type === 'doc' && transcriptionData.content) {
						transcriptText = extractFullTextWithSpeakers(transcriptionData);
					} else {
						transcriptText = file.initialTranscription;
					}
				} catch {
					transcriptText = file.initialTranscription;
				}
			} else {
				console.error('No transcription found. File data:', {
					hasInitialTranscriptionPath: !!file.initialTranscriptionPath,
					hasInitialTranscription: !!file.initialTranscription,
					hasText: !!file.text,
					initialTranscriptionLength: file.initialTranscription?.length || 0,
					textLength: file.text?.length || 0
				});
				return json({ error: 'No transcription available' }, { status: 400 });
			}
		}

		if (!transcriptText || transcriptText.trim().length === 0) {
			console.error('Transcript text is empty after parsing');
			return json({ error: 'Transcription is empty' }, { status: 400 });
		}

		// Generate summary
		const summaryGenerator = getSummaryGenerator();
		const summary = await summaryGenerator.generateSummary(fileId, transcriptText, {
			forceRegenerate,
			uiLanguage
		});

		return json(summary);
	} catch (error) {
		console.error('Generate summary error:', error);

		if (error instanceof z.ZodError) {
			return json({ error: 'Invalid request', details: error.errors }, { status: 400 });
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate summary' },
			{ status: 500 }
		);
	}
};
