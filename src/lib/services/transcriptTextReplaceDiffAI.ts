import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { v4 as uuidv4 } from 'uuid';

export interface DiffCreationOptions {
  changeType?: string;
  confidence?: number;
  context?: string;
  validateText?: boolean;
  caseSensitive?: boolean;
}

export interface DiffCreationResult {
  success: boolean;
  diffId?: string;
  position?: number;
  error?: string;
}

/**
 * Create a diff node at a specific position in the document (for Word nodes)
 * This is simpler than the mark-based approach since we're dealing with nodes
 */
export function createDiffAtPosition(
  editor: Editor,
  from: number,
  to: number,
  originalText: string,
  suggestedText: string,
  options: DiffCreationOptions = {}
): DiffCreationResult {
  const { changeType = 'text_replacement', confidence = 0.5, context = '', validateText = false } = options;
  
  try {
    const state = editor.state;
    const doc = state.doc;
    
    // Validate positions
    if (from < 0 || to > doc.content.size || from >= to) {
      return {
        success: false,
        error: `Invalid positions: from=${from}, to=${to}, docSize=${doc.content.size}`
      };
    }
    
    // If validation is requested, check the text at the position
    if (validateText) {
      const actualText = doc.textBetween(from, to);
      if (actualText !== originalText) {
        return {
          success: false,
          error: `Text mismatch at position. Expected: "${originalText}", Found: "${actualText}"`
        };
      }
    }
    
    // Generate unique ID for the diff
    const diffId = uuidv4();
    
    // Create the diff node
    const diffNode = editor.schema.nodes.diff.create({
      id: diffId,
      originalText,
      suggestedText,
      changeType,
      confidence,
      context
    });
    
    // Replace the text with the diff node
    editor.chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, diffNode.toJSON())
      .run();
    
    return {
      success: true,
      diffId,
      position: from
    };
  } catch (error) {
    console.error('Error creating diff at position:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Find text in Word nodes and create a diff
 * This is simpler with Word nodes since we can easily traverse them
 */
export function findAndCreateDiff(
  editor: Editor,
  searchText: string,
  suggestedText: string,
  options: DiffCreationOptions & { segmentBounds?: { from: number; to: number }; segmentId?: string } = {}
): DiffCreationResult {
  const { caseSensitive = false } = options;
  
  try {
    const state = editor.state;
    const doc = state.doc;
    
    // Determine search scope
    let bounds = options.segmentBounds ?? undefined;
    if (!bounds && options.segmentId) {
      const resolved = resolveSegmentBoundsById(editor, options.segmentId);
      if (resolved) bounds = resolved;
    }
    const scopeFrom = bounds?.from ?? 0;
    const scopeTo = bounds?.to ?? doc.content.size;

    // Normalize search text for comparison
    const normalizedSearch = caseSensitive ? searchText : searchText.toLowerCase();
    
    let found = false;
    let diffResult: DiffCreationResult = { success: false, error: 'Text not found' };
    
    // First, try to find the text using textBetween which handles node boundaries better
    const fullText = doc.textBetween(scopeFrom, scopeTo, ' ', ' ');
    const normalizedFull = caseSensitive ? fullText : fullText.toLowerCase();
    let searchIndex = normalizedFull.indexOf(normalizedSearch);
    
    if (searchIndex !== -1) {
      // Found the text in the document, now find the exact position
      let charCount = 0;
      
      // Convert string index within scoped text to absolute ProseMirror positions
      const convertScoped = (
        doc: ProseMirrorNode,
        rangeFrom: number,
        rangeTo: number,
        stringFrom: number,
        stringTo: number
      ): { from: number; to: number } | null => {
        let currentStringPos = 0;
        let fromPos: number | null = null;
        let toPos: number | null = null;
        doc.nodesBetween(rangeFrom, rangeTo, (node, pos) => {
          if (fromPos !== null && toPos !== null) return false;
          if (node.isText && node.text) {
            const nodeStringStart = currentStringPos;
            const nodeStringEnd = currentStringPos + node.text.length;
            if (fromPos === null && stringFrom >= nodeStringStart && stringFrom < nodeStringEnd) {
              const offset = stringFrom - nodeStringStart;
              fromPos = pos + offset;
            }
            if (toPos === null && stringTo > nodeStringStart && stringTo <= nodeStringEnd) {
              const offset = stringTo - nodeStringStart;
              toPos = pos + offset;
            }
            currentStringPos += node.text.length;
          }
          return true;
        });
        if (fromPos !== null && toPos !== null) return { from: fromPos, to: toPos };
        return null;
      };

      const mapped = convertScoped(doc, scopeFrom, scopeTo, searchIndex, searchIndex + searchText.length);
      if (mapped) {
        const { from, to } = mapped;
        if (found) return false;
        
        const nodeSize = node.isText ? node.text!.length : node.nodeSize;
        
        // Check if our target position is within this node's range
        if (charCount <= searchIndex && searchIndex < charCount + nodeSize) {
          // Calculate the exact position
          const from = pos + (searchIndex - charCount);
          const to = from + searchText.length;
          
          // Verify the text at this position
          try {
            const actualText = doc.textBetween(from, Math.min(to, doc.content.size), '', '');
            const normalizedActual = caseSensitive ? actualText : actualText.toLowerCase();
            
            if (normalizedActual === normalizedSearch) {
              // Create diff at this position
              diffResult = createDiffAtPosition(
                editor,
                from,
                to,
                searchText,
                suggestedText,
                options
              );
              found = true;
            }
          } catch (e) {
            console.warn('Position verification failed:', e);
          }
        }
      }
    }
    
    // If still not found, try a more flexible search that handles Word nodes specifically
    if (!found) {
      console.log(`Text search failed for: "${searchText}". Trying flexible search...`);
      
      // Build a map of text positions
      let textMap = '';
      let positionMap: { start: number; end: number; docPos: number }[] = [];
      
      doc.nodesBetween(scopeFrom, scopeTo, (node, pos) => {
        if (node.type.name === 'wordNode') {
          const wordText = node.textContent;
          const startIndex = textMap.length;
          textMap += wordText;
          positionMap.push({ start: startIndex, end: startIndex + wordText.length, docPos: pos });
        } else if (node.isText && !node.marks.length) {
          // Plain text (spaces between words)
          const startIndex = textMap.length;
          textMap += node.text || '';
          positionMap.push({ start: startIndex, end: startIndex + (node.text?.length || 0), docPos: pos });
        }
      });
      
      const normalizedMap = caseSensitive ? textMap : textMap.toLowerCase();
      searchIndex = normalizedMap.indexOf(normalizedSearch);
      
      if (searchIndex !== -1) {
        // Find the document positions that correspond to this text range
        const searchEnd = searchIndex + searchText.length;
        
        // Find the first position entry that contains our start
        const startEntry = positionMap.find(entry => entry.start <= searchIndex && searchIndex < entry.end);
        // Find the last position entry that contains our end
        const endEntry = positionMap.find(entry => entry.start < searchEnd && searchEnd <= entry.end);
        
        if (startEntry && endEntry) {
          const from = startEntry.docPos + (searchIndex - startEntry.start);
          const to = endEntry.docPos + (searchEnd - endEntry.start);
          
          diffResult = createDiffAtPosition(
            editor,
            from,
            to,
            searchText,
            suggestedText,
            options
          );
          found = true;
        }
      }
    }
    
    if (!found) {
      console.warn(`Could not find text: "${searchText}" in document`);
      // Log some context to help debug
      const preview = doc.textBetween(0, Math.min(200, doc.content.size), ' ', ' ');
      console.log(`Document preview: "${preview}..."`);
    }
    
    return diffResult;
  } catch (error) {
    console.error('Error finding and creating diff:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Replace Word nodes with plain text (for applying accepted diffs)
 * This is useful when converting Word nodes back to plain text
 */
export function replaceWordNodesWithText(
  editor: Editor,
  from: number,
  to: number,
  newText: string
): boolean {
  try {
    // Delete the Word nodes and insert plain text
    editor.chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, newText)
      .run();
    
    return true;
  } catch (error) {
    console.error('Error replacing Word nodes with text:', error);
    return false;
  }
}

/**
 * Convert plain text to Word nodes
 * Useful for maintaining the Word node structure after replacements
 */
export function convertTextToWordNodes(
  editor: Editor,
  from: number,
  to: number
): boolean {
  try {
    const text = editor.state.doc.textBetween(from, to);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Create Word nodes for each word
    const wordNodes = words.map((word, index) => ({
      type: 'wordNode',
      attrs: {
        id: uuidv4().substring(36 - 12),
        lang: 'et'
      },
      content: [{ type: 'text', text: word }]
    }));
    
    // Add space text nodes between words
    const contentWithSpaces: any[] = [];
    wordNodes.forEach((node, index) => {
      contentWithSpaces.push(node);
      if (index < wordNodes.length - 1) {
        contentWithSpaces.push({ type: 'text', text: ' ' });
      }
    });
    
    // Replace the text with Word nodes
    editor.chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, contentWithSpaces)
      .run();
    
    return true;
  } catch (error) {
    console.error('Error converting text to Word nodes:', error);
    return false;
  }
}

// =====================
// Fuzzy WordNode-aware matching (ignores punctuation/whitespace)
// =====================

interface Token {
  raw: string;
  norm: string;
  from: number;
  to: number;
}

function supportsUnicodeProps(): boolean {
  try {
    // Test if the runtime supports Unicode property escapes
    new RegExp('\\p{L}', 'u');
    return true;
  } catch {
    return false;
  }
}

function splitToWordsUnicode(input: string): string[] {
  if (!input) return [];
  if (supportsUnicodeProps()) {
    const m = input.match(/[\p{L}\p{M}]+/gu);
    return m ? m : [];
  }
  const m = input.match(/[A-Za-zÀ-ÖØ-öø-ÿÕÄÖÜõäöü]+/g);
  return m ? m : [];
}

function normalizeWordToken(s: string, caseSensitive = false): string {
  let out = (s || '').normalize('NFC');
  if (!caseSensitive) out = out.toLocaleLowerCase('et');
  return out;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Use two-row DP to reduce memory
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    // swap
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const d = levenshtein(a, b);
  return 1 - d / maxLen;
}

function buildWordNodeTokenStream(
  doc: ProseMirrorNode,
  bounds?: { from: number; to: number },
  opts: { includePlainTextWords?: boolean; wordNodeType?: string; caseSensitive?: boolean } = {}
): Token[] {
  const { includePlainTextWords = false, wordNodeType = 'wordNode', caseSensitive = false } = opts;
  const start = bounds?.from ?? 0;
  const end = bounds?.to ?? doc.content.size;
  const tokens: Token[] = [];

  doc.nodesBetween(start, end, (node, pos, parent) => {
    // If the node is a WordNode container, descend to its text children
    if (node.type?.name === wordNodeType) {
      return true; // continue into children
    }

    // Collect text children of WordNode parents
    if (node.isText && parent && (parent as any).type?.name === wordNodeType) {
      const raw = node.text || '';
      if (raw.length > 0) {
        tokens.push({
          raw,
          norm: normalizeWordToken(raw, caseSensitive),
          from: pos,
          to: pos + raw.length,
        });
      }
      return false;
    }

    // Optionally, collect plain-text words outside WordNodes as tokens
    if (includePlainTextWords && node.isText && node.text) {
      const text = node.text;
      const words = splitToWordsUnicode(text);
      if (words.length > 0) {
        // Iterate matches to compute offsets
        const re = supportsUnicodeProps() ? /[\p{L}\p{M}]+/gu : /[A-Za-zÀ-ÖØ-öø-ÿÕÄÖÜõäöü]+/g;
        let match: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((match = re.exec(text)) !== null) {
          const w = match[0];
          tokens.push({
            raw: w,
            norm: normalizeWordToken(w, caseSensitive),
            from: pos + match.index,
            to: pos + match.index + w.length,
          });
        }
      }
      return false;
    }

    return true;
  });

  return tokens;
}

function tokenizeSearchText(
  searchText: string,
  caseSensitive = false
): string[] {
  return splitToWordsUnicode(searchText).map(w => normalizeWordToken(w, caseSensitive)).filter(Boolean);
}

function findFuzzyConsecutiveSequence(
  tokens: Token[],
  searchTokens: string[],
  thresholds: { tokenSimilarity: number; avgSimilarity: number; maxMismatches: number }
): { from: number; to: number; stats: { avg: number; mismatches: number } } | null {
  if (tokens.length === 0 || searchTokens.length === 0) return null;
  let best: { from: number; to: number; avg: number; mismatches: number } | null = null;

  const windowLen = searchTokens.length;
  for (let i = 0; i + windowLen <= tokens.length; i++) {
    // Fast check on first and last tokens
    const simFirst = tokenSimilarity(searchTokens[0], tokens[i].norm);
    const simLast = tokenSimilarity(searchTokens[windowLen - 1], tokens[i + windowLen - 1].norm);
    if (simFirst < thresholds.tokenSimilarity * 0.8 && simLast < thresholds.tokenSimilarity * 0.8) {
      continue;
    }

    let sum = 0;
    let mismatches = 0;
    let valid = true;

    for (let j = 0; j < windowLen; j++) {
      const sim = tokenSimilarity(searchTokens[j], tokens[i + j].norm);
      sum += sim;
      if (sim < thresholds.tokenSimilarity) mismatches++;
      // Early break if too many mismatches
      if (mismatches > thresholds.maxMismatches) {
        valid = false;
        break;
      }
    }

    if (!valid) continue;

    const avg = sum / windowLen;
    if (avg >= thresholds.avgSimilarity) {
      const cand = { from: tokens[i].from, to: tokens[i + windowLen - 1].to, avg, mismatches };
      if (!best || cand.avg > best.avg || (cand.avg === best.avg && cand.to - cand.from > best.to - best.from) || (cand.avg === best.avg && cand.to - cand.from === best.to - best.from && cand.from < best.from)) {
        best = cand;
        // Excellent match -> early return
        if (avg >= 0.9 && mismatches === 0) {
          break;
        }
      }
    }
  }

  return best ? { from: best.from, to: best.to, stats: { avg: best.avg, mismatches: best.mismatches } } : null;
}

function resolveSegmentBoundsById(editor: Editor, segmentId: string): { from: number; to: number } | null {
  try {
    const doc = editor.state.doc;
    let found: { from: number; to: number } | null = null;
    doc.nodesBetween(0, doc.content.size, (node, pos) => {
      if (node.type.name === 'speaker' && node.attrs?.id === segmentId) {
        // Content bounds are pos + 1 to pos + node.nodeSize - 1
        found = { from: pos + 1, to: pos + node.nodeSize - 1 };
        return false;
      }
      return true;
    });
    return found;
  } catch (e) {
    console.warn('resolveSegmentBoundsById failed:', e);
    return null;
  }
}

export function findAndCreateDiffFuzzy(
  editor: Editor,
  searchText: string,
  suggestedText: string,
  options: DiffCreationOptions & {
    segmentBounds?: { from: number; to: number };
    segmentId?: string;
    thresholds?: { tokenSimilarity?: number; avgSimilarity?: number; maxMismatches?: number };
    includePlainTextWords?: boolean;
  } = {}
): DiffCreationResult {
  try {
    const caseSensitive = options.caseSensitive ?? false;
    const thresholds = {
      tokenSimilarity: options.thresholds?.tokenSimilarity ?? 0.6,
      avgSimilarity: options.thresholds?.avgSimilarity ?? 0.75,
      maxMismatches: options.thresholds?.maxMismatches ?? Math.max(1, Math.floor((splitToWordsUnicode(searchText).length || 1) * 0.2)),
    };

    // Resolve scope
    let bounds = options.segmentBounds ?? null;
    if (!bounds && options.segmentId) {
      bounds = resolveSegmentBoundsById(editor, options.segmentId);
    }

    const doc = editor.state.doc;

    // Build token stream within scope first
    const tokensPrimary = buildWordNodeTokenStream(doc, bounds ?? undefined, { includePlainTextWords: false, caseSensitive });
    const searchTokens = tokenizeSearchText(searchText, caseSensitive);

    // If no tokens, try including plain text words in scope
    let match = findFuzzyConsecutiveSequence(tokensPrimary, searchTokens, thresholds);
    if (!match && bounds) {
      const tokensSecondary = buildWordNodeTokenStream(doc, bounds, { includePlainTextWords: true, caseSensitive });
      match = findFuzzyConsecutiveSequence(tokensSecondary, searchTokens, thresholds);
    }

    // As a last resort, scan the whole doc (with WordNode text only)
    if (!match && !bounds) {
      const tokensAll = buildWordNodeTokenStream(doc, undefined, { includePlainTextWords: false, caseSensitive });
      match = findFuzzyConsecutiveSequence(tokensAll, searchTokens, thresholds);
    }

    if (match) {
      // Soft validation: ensure first and last token appear in the substring
      const slice = doc.textBetween(match.from, match.to, '', '');
      const first = searchTokens[0];
      const last = searchTokens[searchTokens.length - 1];
      const ok = slice.toLocaleLowerCase('et').includes(first) && slice.toLocaleLowerCase('et').includes(last);
      if (!ok) {
        console.warn('Fuzzy match soft validation weak; proceeding due to lenient mode.');
      }

      return createDiffAtPosition(editor, match.from, match.to, searchText, suggestedText, {
        changeType: options.changeType ?? 'text_replacement',
        confidence: match.stats.avg,
        context: (options.context ? options.context + ' ' : '') + 'word-node-fuzzy',
        validateText: false,
      });
    }

    return { success: false, error: 'Text not found with fuzzy matching' };
  } catch (error) {
    console.error('Error in findAndCreateDiffFuzzy:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
