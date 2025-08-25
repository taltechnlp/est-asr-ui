import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getPositionAwareAgent } from '$lib/agents/coordinatingAgentPosition';
import { prisma } from '$lib/db/client';
import { z } from 'zod';
import { isSupportedLanguage } from '$lib/utils/language';
import {
	extractSpeakerSegmentsWithPositions,
	type PositionAwareSegment
} from '$lib/services/positionAwareExtractor';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';

const AnalyzeSegmentPositionSchema = z.object({
	fileId: z.string(),
	editorContent: z.any(), // TipTap editor content
	summaryId: z.string(),
	audioFilePath: z.string(),
	uiLanguage: z.string().optional(),
	usePositions: z.boolean().optional().default(true)
});

/**
 * Position-based segment analysis endpoint
 * This endpoint uses absolute document positions for more reliable text replacement
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Parse and validate request
		const body = await request.json();
		const { fileId, editorContent, summaryId, audioFilePath, uiLanguage, usePositions } =
			AnalyzeSegmentPositionSchema.parse(body);

		// Validate UI language if provided
		if (uiLanguage && !isSupportedLanguage(uiLanguage)) {
			return json({ error: 'Unsupported UI language' }, { status: 400 });
		}

		// Verify file ownership
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				uploader: true,
				path: true
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		if (file.uploader !== session.user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Get summary
		const summary = await prisma.transcriptSummary.findUnique({
			where: { id: summaryId }
		});

		if (!summary || summary.fileId !== fileId) {
			return json({ error: 'Summary not found' }, { status: 404 });
		}

		// Use the actual file path from database if audioFilePath is not provided correctly
		const actualAudioPath = audioFilePath || file.path;

		if (!usePositions) {
			// Fall back to text-based approach if requested
			return json(
				{
					error:
						'Text-based approach not supported in this endpoint. Use /api/transcript-analysis/segment instead'
				},
				{ status: 400 }
			);
		}

		// Create a headless editor instance for position extraction
		const editor = new Editor({
			extensions: [Document, Text],
			content: editorContent
		});

		// Extract position-aware segments
		const segments = extractSpeakerSegmentsWithPositions(editor);

		if (segments.length === 0) {
			return json({ error: 'No segments found in document' }, { status: 400 });
		}

		// Initialize position-aware agent
		const agent = getPositionAwareAgent();
		agent.setEditor(editor);

		// Analyze all segments with position information
		const result = await agent.analyzeWithPositions({
			fileId,
			segments,
			summary,
			audioFilePath: actualAudioPath,
			uiLanguage
		});

		// Destroy the headless editor
		editor.destroy();

		return json({
			...result,
			method: 'position-based',
			segmentCount: segments.length
		});
	} catch (error) {
		console.error('Position-based segment analysis error:', error);

		if (error instanceof z.ZodError) {
			return json({ error: 'Invalid request', details: error.errors }, { status: 400 });
		}

		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to analyze segments with positions'
			},
			{ status: 500 }
		);
	}
};
