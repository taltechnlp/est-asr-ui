import type { Alternative, Segment, NewTurn } from '$lib/helpers/api.d';

export interface MatchedAlternatives {
  turnIndex: number;
  turn: NewTurn;
  alternatives: Alternative[];
}

/**
 * Check if two time ranges overlap
 */
function doRangesOverlap(
  start1: number, 
  end1: number, 
  start2: number, 
  end2: number,
  tolerance = 0.1
): boolean {
  // Add tolerance to account for minor timing differences
  return Math.max(start1, start2) <= Math.min(end1, end2) + tolerance;
}

/**
 * Calculate overlap percentage between two time ranges
 */
function calculateOverlap(
  start1: number, 
  end1: number, 
  start2: number, 
  end2: number
): number {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  
  if (overlapEnd <= overlapStart) return 0;
  
  const overlapDuration = overlapEnd - overlapStart;
  const totalDuration = Math.min(end1 - start1, end2 - start2);
  
  return overlapDuration / totalDuration;
}

/**
 * Match alternative hypotheses to speech turns based on timing overlap
 * @param turns Array of speech turns from best hypothesis
 * @param alternativeSegments Array of segments with alternatives
 * @param minOverlapThreshold Minimum overlap percentage to consider a match (0.3 = 30%)
 * @returns Array of turns with their matched alternatives
 */
export function matchAlternativesToTurns(
  turns: NewTurn[],
  alternativeSegments: Segment[],
  minOverlapThreshold = 0.3
): MatchedAlternatives[] {
  const results: MatchedAlternatives[] = [];

  turns.forEach((turn, turnIndex) => {
    const matchedAlternatives: Alternative[] = [];
    
    // Find alternative segments that overlap with this turn
    alternativeSegments.forEach(segment => {
      if (doRangesOverlap(turn.start, turn.end, segment.start, segment.end)) {
        const overlapPercentage = calculateOverlap(
          turn.start, 
          turn.end, 
          segment.start, 
          segment.end
        );
        
        // Only include alternatives if overlap is significant
        if (overlapPercentage >= minOverlapThreshold) {
          // Sort alternatives by rank and add them
          const sortedAlternatives = [...segment.alternatives].sort((a, b) => a.rank - b.rank);
          matchedAlternatives.push(...sortedAlternatives);
        }
      }
    });

    results.push({
      turnIndex,
      turn,
      alternatives: matchedAlternatives
    });
  });

  return results;
}

/**
 * Get alternatives for a specific segment based on timing
 * @param segmentStart Start time of the segment
 * @param segmentEnd End time of the segment
 * @param alternativeSegments Array of segments with alternatives
 * @param minOverlapThreshold Minimum overlap percentage to consider a match
 * @returns Array of alternatives for the segment
 */
export function getAlternativesForSegment(
  segmentStart: number,
  segmentEnd: number,
  alternativeSegments: Segment[],
  minOverlapThreshold = 0.3
): Alternative[] {
  const matchedAlternatives: Alternative[] = [];
  
  alternativeSegments.forEach(segment => {
    if (doRangesOverlap(segmentStart, segmentEnd, segment.start, segment.end)) {
      const overlapPercentage = calculateOverlap(
        segmentStart, 
        segmentEnd, 
        segment.start, 
        segment.end
      );
      
      if (overlapPercentage >= minOverlapThreshold) {
        // Sort alternatives by rank and add them
        const sortedAlternatives = [...segment.alternatives].sort((a, b) => a.rank - b.rank);
        matchedAlternatives.push(...sortedAlternatives);
      }
    }
  });

  // Remove duplicates and sort by rank
  const uniqueAlternatives = matchedAlternatives.filter((alt, index, arr) => 
    arr.findIndex(other => other.text === alt.text && other.rank === alt.rank) === index
  );
  
  return uniqueAlternatives.sort((a, b) => a.rank - b.rank);
}

/**
 * Create a summary of timing matches for debugging
 */
export function createMatchingSummary(
  turns: NewTurn[],
  alternativeSegments: Segment[]
): { totalTurns: number; turnsWithAlternatives: number; totalAlternatives: number } {
  const matches = matchAlternativesToTurns(turns, alternativeSegments);
  
  return {
    totalTurns: turns.length,
    turnsWithAlternatives: matches.filter(m => m.alternatives.length > 0).length,
    totalAlternatives: alternativeSegments.reduce((sum, seg) => sum + seg.alternatives.length, 0)
  };
}