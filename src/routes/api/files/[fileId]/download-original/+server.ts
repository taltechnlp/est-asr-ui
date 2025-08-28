import { error, json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';
import { promises as fs } from 'fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return error(401, 'Unauthorized');
	}

	// Get file with user check
	const file = await prisma.file.findUnique({
		where: { id: params.fileId },
		select: {
			id: true,
			filename: true,
			initialTranscriptionPath: true,
			initialTranscription: true,
			text: true, // Also check if there's processed text
			state: true,
			User: {
				select: { id: true }
			}
		}
	});

	if (!file) {
		return error(404, 'File not found');
	}

	if (session.user.id !== file.User?.id) {
		return error(403, 'Access denied');
	}

	// Debug: log what data is available for this file
	console.log('File data:', {
		id: file.id,
		filename: file.filename,
		state: file.state,
		hasInitialTranscriptionPath: !!file.initialTranscriptionPath,
		initialTranscriptionPath: file.initialTranscriptionPath,
		hasInitialTranscription: !!file.initialTranscription,
		initialTranscriptionLength: file.initialTranscription?.length || 0,
		hasText: !!file.text,
		textLength: file.text?.length || 0
	});

	let transcriptionData: any;

	// Try to read from file path first, then fallback to database
	if (file.initialTranscriptionPath) {
		console.log('Checking file path:', file.initialTranscriptionPath);
		
		// Check if file exists first
		try {
			await fs.access(file.initialTranscriptionPath);
			console.log('File exists, reading from path');
			const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');
			transcriptionData = JSON.parse(content);
			console.log('Successfully parsed from file path');
		} catch (fileError) {
			console.log('File does not exist or cannot be read:', fileError.code, fileError.message);
			
			// Try database fallback
			if (file.initialTranscription) {
				console.log('Falling back to database transcription');
				try {
					transcriptionData = JSON.parse(file.initialTranscription);
					console.log('Successfully parsed from database');
				} catch (dbError) {
					console.error('Database transcription also failed:', dbError.message);
					return error(500, `Failed to read transcription from both file (${fileError.message}) and database (${dbError.message})`);
				}
			} else {
				return error(404, `Transcription file not found at: ${file.initialTranscriptionPath} and no database backup available`);
			}
		}
	} else if (file.initialTranscription) {
		console.log('No file path, reading from database field');
		try {
			transcriptionData = JSON.parse(file.initialTranscription);
			console.log('Successfully parsed from database');
		} catch (dbError) {
			return error(500, `Failed to parse database transcription: ${dbError.message}`);
		}
	} else {
		console.log('No transcription source found, checking if processed text is available');
		
		// Last fallback: check if there's any processed text data
		if (file.text) {
			console.log('Using processed text as fallback');
			try {
				// Try to parse as JSON first (might be TipTap format)
				const parsedText = JSON.parse(file.text);
				
				// If it's TipTap format, we can't extract original ASR data
				if (parsedText.type === 'doc' && parsedText.content) {
					return error(400, 'This file only has processed editor content, no original ASR data available');
				}
				
				// If it's some other JSON format, use it
				transcriptionData = parsedText;
			} catch (parseError) {
				// If it's not JSON, treat as plain text
				// This is not ideal since we lose timing info, but it's better than nothing
				return new Response(file.text, {
					headers: {
						'Content-Type': 'text/plain; charset=utf-8',
						'Content-Disposition': `attachment; filename="${file.filename.replace(/\.[^/.]+$/, '')}_processed.txt"`,
						'Cache-Control': 'no-cache'
					}
				});
			}
		} else {
			console.log('No transcription data found anywhere:', {
				hasPath: !!file.initialTranscriptionPath,
				hasDatabase: !!file.initialTranscription,
				hasText: !!file.text,
				pathValue: file.initialTranscriptionPath,
				state: file.state
			});
			
			return error(404, `No original transcription available for this file. File state: ${file.state}. Available data: ${
				[
					file.initialTranscriptionPath ? 'path (missing file)' : null,
					file.initialTranscription ? 'database' : null,
					file.text ? 'processed text' : null
				].filter(Boolean).join(', ') || 'none'
			}`);
		}
	}

	// Check if it's the TipTap format (editor content) or original ASR format
	if (transcriptionData.type === 'doc' && transcriptionData.content) {
		console.log('File contains TipTap editor content, not original ASR data');
		return error(400, 'This file only has editor content, no original ASR data');
	}

	console.log('Transcription data structure:', {
		type: typeof transcriptionData,
		keys: Object.keys(transcriptionData || {}),
		hasSections: !!transcriptionData.sections,
		sectionsIsArray: Array.isArray(transcriptionData.sections),
		sectionsLength: transcriptionData.sections?.length || 0,
		hasTurns: !!transcriptionData.turns,
		turnsIsArray: Array.isArray(transcriptionData.turns),
		turnsLength: transcriptionData.turns?.length || 0
	});

	// Extract text from original ASR format
	const textLines: string[] = [];

	if (transcriptionData.sections && Array.isArray(transcriptionData.sections)) {
		console.log('Processing sections structure');
		// Process sections -> turns -> words structure
		for (const section of transcriptionData.sections) {
			if (section.turns && Array.isArray(section.turns)) {
				for (const turn of section.turns) {
					if (turn.transcript && typeof turn.transcript === 'string') {
						textLines.push(turn.transcript.trim());
					}
				}
			}
		}
	} else if (transcriptionData.turns && Array.isArray(transcriptionData.turns)) {
		console.log('Processing turns structure');
		// Direct turns structure
		for (const turn of transcriptionData.turns) {
			if (turn.transcript && typeof turn.transcript === 'string') {
				textLines.push(turn.transcript.trim());
			}
		}
	} else {
		console.log('Unrecognized transcription format. Full data:', JSON.stringify(transcriptionData).substring(0, 500));
		return error(400, 'Unrecognized transcription format');
	}

	console.log('Extracted text lines:', textLines.length);

	// Join with newlines (each segment on a new line as requested)
	const plainText = textLines.filter(line => line.length > 0).join('\n');

	if (!plainText) {
		return error(404, 'No text content found in transcription');
	}

	// Generate filename
	const baseFilename = file.filename.replace(/\.[^/.]+$/, ''); // Remove extension
	const downloadFilename = `${baseFilename}_original.txt`;

	// Return as downloadable file
	return new Response(plainText, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Content-Disposition': `attachment; filename="${downloadFilename}"`,
			'Cache-Control': 'no-cache'
		}
	});
};