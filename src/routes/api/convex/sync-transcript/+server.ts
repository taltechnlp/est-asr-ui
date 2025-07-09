import { json } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import type { RequestHandler } from './$types';

// Create a Convex client for server-side usage
const convexUrl = process.env.CONVEX_URL || "http://localhost:3210";
const convex = new ConvexHttpClient(convexUrl);

// Import the API from the root convex directory
import { api } from '../../../../../convex/_generated/api';

// Validation schemas
interface SyncRequest {
	transcriptId: string;
	title: string;
	words: Array<{
		text: string;
		start: number;
		end: number;
		speakerTag: string;
	}>;
}

function validateSyncRequest(data: any): SyncRequest {
	// Check if all required fields exist
	if (!data || typeof data !== 'object') {
		throw new Error('Invalid request body');
	}

	if (!data.transcriptId || typeof data.transcriptId !== 'string') {
		throw new Error('transcriptId is required and must be a string');
	}

	if (!data.title || typeof data.title !== 'string') {
		throw new Error('title is required and must be a string');
	}

	if (!Array.isArray(data.words)) {
		throw new Error('words must be an array');
	}

	// Validate transcriptId format (only allow demo-transcript-{number} for demo)
	if (!/^demo-transcript-\d+$/.test(data.transcriptId)) {
		throw new Error('Invalid transcriptId format. Only demo-transcript-{number} is allowed');
	}

	// Validate title length
	if (data.title.length < 1 || data.title.length > 200) {
		throw new Error('Title must be between 1 and 200 characters');
	}

	// Validate words array
	if (data.words.length === 0) {
		throw new Error('At least one word is required');
	}

	if (data.words.length > 10000) {
		throw new Error('Too many words. Maximum 10,000 words allowed');
	}

	// Validate each word
	const validatedWords = data.words.map((word: any, index: number) => {
		if (!word || typeof word !== 'object') {
			throw new Error(`Word at index ${index} is invalid`);
		}

		if (!word.text || typeof word.text !== 'string') {
			throw new Error(`Word at index ${index} must have a text property`);
		}

		if (word.text.length === 0 || word.text.length > 100) {
			throw new Error(`Word at index ${index} text must be between 1 and 100 characters`);
		}

		if (typeof word.start !== 'number' || word.start < 0) {
			throw new Error(`Word at index ${index} must have a valid start time (non-negative number)`);
		}

		if (typeof word.end !== 'number' || word.end < 0) {
			throw new Error(`Word at index ${index} must have a valid end time (non-negative number)`);
		}

		if (word.end <= word.start) {
			throw new Error(`Word at index ${index} end time must be greater than start time`);
		}

		if (!word.speakerTag || typeof word.speakerTag !== 'string') {
			throw new Error(`Word at index ${index} must have a speakerTag property`);
		}

		if (word.speakerTag.length === 0 || word.speakerTag.length > 50) {
			throw new Error(`Word at index ${index} speakerTag must be between 1 and 50 characters`);
		}

		return {
			text: word.text.trim(),
			start: Math.round(word.start * 100) / 100, // Round to 2 decimal places
			end: Math.round(word.end * 100) / 100,
			speakerTag: word.speakerTag.trim()
		};
	});

	// Check for reasonable timing (words should be in chronological order)
	for (let i = 1; i < validatedWords.length; i++) {
		if (validatedWords[i].start < validatedWords[i - 1].start) {
			throw new Error(`Words must be in chronological order. Word at index ${i} starts before previous word`);
		}
	}

	return {
		transcriptId: data.transcriptId.trim(),
		title: data.title.trim(),
		words: validatedWords
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	const session = await locals.auth();
	console.log('🔐 [API] Auth check - session:', !!session, 'user:', !!session?.user);
	
	// For demo routes, allow access without authentication
	// In production, you would want to add proper authentication here
	const isDemoRoute = true; // You can make this more sophisticated based on the request
	
	if (!isDemoRoute && !session?.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Optional: Add role-based access control
	// if (session.user.role !== 'admin' && session.user.role !== 'editor') {
	// 	return json({ error: 'Insufficient permissions' }, { status: 403 });
	// }
	try {
		// Parse and validate request body
		let requestData: any;
		try {
			requestData = await request.json();
		} catch (error) {
			return json({ error: 'Invalid JSON in request body' }, { status: 400 });
		}

		// Validate the request data
		let validatedData: SyncRequest;
		try {
			validatedData = validateSyncRequest(requestData);
		} catch (error) {
			return json({ 
				error: 'Validation failed', 
				details: error instanceof Error ? error.message : 'Unknown validation error' 
			}, { status: 400 });
		}

		const { transcriptId, title, words } = validatedData;

		console.log('🚀 [CONVEX SYNC] Starting sync operation:', { 
			transcriptId, 
			title, 
			wordCount: words.length,
			totalDuration: words.length > 0 ? words[words.length - 1].end - words[0].start : 0,
			user: session?.user?.email || session?.user?.id || 'demo-user',
			mode: isDemoRoute ? 'demo' : 'authenticated',
			timestamp: new Date().toISOString()
		});

		// Rate limiting check (simple in-memory check - in production use Redis or similar)
		// For demo purposes, we'll allow multiple requests but log them
		console.log(`📊 [CONVEX SYNC] Request logged for ${transcriptId} at ${new Date().toISOString()}`);

		// First, check if transcript exists
		console.log(`🔍 [CONVEX SYNC] Checking if transcript exists: ${transcriptId}`);
		const existingTranscript = await convex.query(api.transcripts.getTranscript, { 
			transcriptId 
		});

		let transcriptDbId: any; // Convex ID type

		if (existingTranscript) {
			// Update existing transcript
			console.log(`📝 [CONVEX SYNC] Updating existing transcript:`, {
				convexId: existingTranscript._id,
				transcriptId,
				title,
				status: 'completed'
			});
			transcriptDbId = existingTranscript._id as any;
			
			// Update transcript title and status
			await convex.mutation(api.transcripts.updateTranscript, {
				transcriptId: existingTranscript._id as any,
				title,
				status: 'completed'
			}) as any;
			console.log(`✅ [CONVEX SYNC] Successfully updated transcript metadata`);
		} else {
			// Create new transcript
			console.log(`🆕 [CONVEX SYNC] Creating new transcript:`, {
				transcriptId,
				title,
				customId: transcriptId
			});
			transcriptDbId = await convex.mutation(api.transcripts.createTranscript, {
				title,
				customId: transcriptId,
				words: [] // We'll add words separately
			}) as any; // Type assertion for Convex ID
			console.log(`✅ [CONVEX SYNC] Successfully created new transcript with Convex ID:`, transcriptDbId);
		}

		// Clear existing words for this transcript (hard reset)
		console.log(`🗑️ [CONVEX SYNC] Clearing existing words for transcript: ${transcriptId}`);
		const clearResult = await convex.mutation(api.transcripts.clearWordsForTranscript, {
			transcriptId: transcriptDbId
		}) as any;

		console.log(`✅ [CONVEX SYNC] Cleared ${clearResult.deletedCount} existing words`);

		// Add all words in batches to avoid overwhelming the database
		console.log(`📝 [CONVEX SYNC] Starting to add ${words.length} words in batches...`);
		const batchSize = 100;
		const totalBatches = Math.ceil(words.length / batchSize);
		
		for (let i = 0; i < words.length; i += batchSize) {
			const batch = words.slice(i, i + batchSize);
			const batchNumber = Math.floor(i / batchSize) + 1;
			
			console.log(`📦 [CONVEX SYNC] Processing batch ${batchNumber}/${totalBatches} (${batch.length} words)`);
			
			// Process batch in parallel for better performance
			await Promise.all(batch.map((word, batchIndex) => 
				convex.mutation(api.transcripts.addWord, {
					transcriptId: transcriptDbId,
					text: word.text,
					start: word.start,
					end: word.end,
					speakerTag: word.speakerTag,
					wordIndex: i + batchIndex
				}) as any
			));
			
			console.log(`✅ [CONVEX SYNC] Completed batch ${batchNumber}/${totalBatches}`);
		}

		console.log(`🎉 [CONVEX SYNC] SUCCESS! Synced ${words.length} words for transcript ${transcriptId}`);
		console.log(`📊 [CONVEX SYNC] Final summary:`, {
			transcriptId,
			convexId: transcriptDbId,
			totalWords: words.length,
			clearedWords: clearResult.deletedCount,
			totalBatches,
			user: session?.user?.email || session?.user?.id || 'demo-user',
			mode: isDemoRoute ? 'demo' : 'authenticated',
			completedAt: new Date().toISOString()
		});

		return json({
			success: true,
			transcriptId: transcriptDbId,
			wordCount: words.length,
			clearedWords: clearResult.deletedCount,
			message: `Successfully synced ${words.length} words to Convex`,
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('❌ [CONVEX SYNC] Error syncing transcript to Convex:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString()
		});
		
		// Don't expose internal error details in production
		const isDevelopment = process.env.NODE_ENV === 'development';
		
		return json({ 
			error: 'Failed to sync transcript to Convex',
			details: isDevelopment && error instanceof Error ? error.message : 'Internal server error'
		}, { status: 500 });
	}
}; 