import type { AnalysisSegment } from '@prisma/client';

// Simple in-memory cache for analyzed segments per file
// Stores a Promise to avoid duplicate concurrent requests
const cache = new Map<string, Promise<Map<number, AnalysisSegment>>>();

async function fetchAll(fileId: string): Promise<Map<number, AnalysisSegment>> {
	const res = await fetch(`/api/transcript-analysis/segments/${fileId}/`);
	if (!res.ok) {
		throw new Error(`Failed to load analyzed segments for ${fileId}`);
	}
	const arr = await res.json();
	const map = new Map<number, AnalysisSegment>();
	if (Array.isArray(arr)) {
		for (const seg of arr as AnalysisSegment[]) {
			map.set(seg.segmentIndex as unknown as number, seg);
		}
	}
	return map;
}

export function getAnalyzedSegmentsMap(fileId: string): Promise<Map<number, AnalysisSegment>> {
	if (!fileId) return Promise.resolve(new Map());
	if (!cache.has(fileId)) {
		cache.set(fileId, fetchAll(fileId));
	}
	return cache.get(fileId)!;
}

export function invalidateAnalyzedSegments(fileId: string) {
	cache.delete(fileId);
}

export async function upsertAnalyzedSegment(fileId: string, seg: AnalysisSegment) {
	if (!fileId || !seg) return;
	let promise = cache.get(fileId);
	if (!promise) {
		// Create a map with just this one to avoid refetch
		const map = new Map<number, AnalysisSegment>();
		map.set(seg.segmentIndex as unknown as number, seg);
		cache.set(fileId, Promise.resolve(map));
		return;
	}
	try {
		const map = await promise;
		map.set(seg.segmentIndex as unknown as number, seg);
	} catch (e) {
		// If previous promise failed, reset cache with this seg
		const map = new Map<number, AnalysisSegment>();
		map.set(seg.segmentIndex as unknown as number, seg);
		cache.set(fileId, Promise.resolve(map));
	}
}
