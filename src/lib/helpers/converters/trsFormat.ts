/**
 * Converts editor JSON to TRS (Transcriber) XML format
 * Based on the json2trs.py script from est-asr-pipeline
 */

type EditorWord = {
	text: string;
	start: number;
	end: number;
};

type SpeakerSegment = {
	speakerId: string;
	speakerName: string;
	start: number;
	end: number;
	text: string;
	words: EditorWord[];
};

type Turn = {
	speaker: string;
	speakerName: string;
	startTime: number;
	endTime: number;
	segments: Array<{ syncTime: number; text: string }>;
};

/**
 * Extract speaker segments from editor JSON content
 */
function extractSpeakerSegments(content: any): SpeakerSegment[] {
	const segments: SpeakerSegment[] = [];

	if (!content || !content.content) {
		return segments;
	}

	// Iterate through speaker nodes
	for (const speakerNode of content.content) {
		if (speakerNode.type !== 'speaker' || !speakerNode.content) continue;

		const speakerId = speakerNode.attrs?.id || 'unknown';
		const speakerName = speakerNode.attrs?.['data-name'] || 'Unknown';
		const words: EditorWord[] = [];
		let textParts: string[] = [];

		// Extract words and text from the speaker's content
		for (const contentNode of speakerNode.content) {
			if (contentNode.type === 'text') {
				const text = contentNode.text || '';
				textParts.push(text);

				// Find word marks with timing information
				if (contentNode.marks) {
					const wordMark = contentNode.marks.find((mark: any) => mark.type === 'word');
					if (wordMark && wordMark.attrs) {
						words.push({
							text: text,
							start: wordMark.attrs.start,
							end: wordMark.attrs.end
						});
					}
				}
			}
		}

		// Only add segment if it has words with timing
		if (words.length > 0) {
			segments.push({
				speakerId,
				speakerName,
				start: words[0].start,
				end: words[words.length - 1].end,
				text: textParts.join('').trim(),
				words
			});
		}
	}

	return segments;
}

/**
 * Group consecutive segments from the same speaker into turns with sync points
 * Follows the logic from json2trs.py: merge turns from same speaker if they're consecutive
 */
function groupIntoTurns(segments: SpeakerSegment[]): Turn[] {
	const turns: Turn[] = [];

	if (segments.length === 0) {
		return turns;
	}

	// Create speaker ID mapping (spk1, spk2, etc.)
	const speakerMap = new Map<string, string>();
	let speakerCounter = 1;

	for (const segment of segments) {
		if (!speakerMap.has(segment.speakerId)) {
			speakerMap.set(segment.speakerId, `spk${speakerCounter}`);
			speakerCounter++;
		}
	}

	let currentTurn: Turn | null = null;

	for (const segment of segments) {
		const mappedSpeaker = speakerMap.get(segment.speakerId)!;

		// Check if we can merge with the current turn (same speaker and consecutive timing)
		if (
			currentTurn &&
			currentTurn.speaker === mappedSpeaker &&
			Math.abs(currentTurn.endTime - segment.start) < 0.0001
		) {
			// Merge into current turn by adding a sync point
			currentTurn.segments.push({
				syncTime: segment.start,
				text: segment.text
			});
			currentTurn.endTime = segment.end;
		} else {
			// Create a new turn
			if (currentTurn) {
				turns.push(currentTurn);
			}

			currentTurn = {
				speaker: mappedSpeaker,
				speakerName: segment.speakerName,
				startTime: segment.start,
				endTime: segment.end,
				segments: [{ syncTime: segment.start, text: segment.text }]
			};
		}
	}

	// Push the last turn
	if (currentTurn) {
		turns.push(currentTurn);
	}

	return turns;
}

/**
 * Get unique speakers with their mapped IDs
 */
function getSpeakers(segments: SpeakerSegment[]): Map<string, { id: string; name: string }> {
	const speakerMap = new Map<string, { id: string; name: string }>();
	let speakerCounter = 1;

	for (const segment of segments) {
		if (!speakerMap.has(segment.speakerId)) {
			speakerMap.set(segment.speakerId, {
				id: `spk${speakerCounter}`,
				name: segment.speakerName
			});
			speakerCounter++;
		}
	}

	return speakerMap;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Generate TRS XML content
 */
function generateTrsXml(
	speakers: Map<string, { id: string; name: string }>,
	turns: Turn[],
	audioFilename: string
): string {
	const lines: string[] = [];

	// XML declaration and DOCTYPE
	lines.push('<?xml version="1.0" encoding="UTF-8"?>');
	lines.push('<!DOCTYPE Trans SYSTEM "trans-14.dtd">');

	// Root element with audio filename
	lines.push(`<Trans audio_filename="${escapeXml(audioFilename)}">`);

	// Speakers section
	lines.push('  <Speakers>');
	for (const [_, speaker] of speakers) {
		lines.push(`    <Speaker id="${speaker.id}" name="${escapeXml(speaker.name)}"/>`);
	}
	lines.push('  </Speakers>');

	// Episode section
	lines.push('  <Episode>');

	if (turns.length > 0) {
		const sectionStart = turns[0].startTime;
		const sectionEnd = turns[turns.length - 1].endTime;

		// Single section of type "report" containing all turns
		lines.push(
			`    <Section type="report" startTime="${sectionStart}" endTime="${sectionEnd}">`
		);

		for (const turn of turns) {
			lines.push(
				`      <Turn speaker="${turn.speaker}" startTime="${turn.startTime}" endTime="${turn.endTime}">`
			);

			// Add segments with sync tags
			for (let i = 0; i < turn.segments.length; i++) {
				const segment = turn.segments[i];
				if (i === 0) {
					// First segment: text goes directly in the turn
					lines.push(`        <Sync time="${segment.syncTime}"/>`);
					lines.push(`        ${escapeXml(segment.text)}`);
				} else {
					// Subsequent segments: preceded by sync tags
					lines.push(`        <Sync time="${segment.syncTime}"/>`);
					lines.push(`        ${escapeXml(segment.text)}`);
				}
			}

			lines.push('      </Turn>');
		}

		lines.push('    </Section>');
	}

	lines.push('  </Episode>');
	lines.push('</Trans>');

	return lines.join('\n');
}

/**
 * Convert editor JSON to TRS format
 */
export function toTRS(editorContent: any, audioFilename: string = 'audio'): string {
	// Extract speaker segments from editor
	const segments = extractSpeakerSegments(editorContent);

	if (segments.length === 0) {
		// Return minimal valid TRS
		return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Trans SYSTEM "trans-14.dtd">
<Trans audio_filename="${escapeXml(audioFilename)}">
  <Speakers>
  </Speakers>
  <Episode>
  </Episode>
</Trans>`;
	}

	// Get unique speakers
	const speakers = getSpeakers(segments);

	// Group segments into turns
	const turns = groupIntoTurns(segments);

	// Generate TRS XML
	return generateTrsXml(speakers, turns, audioFilename);
}
