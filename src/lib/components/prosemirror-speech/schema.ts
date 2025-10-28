import { Schema } from 'prosemirror-model';

/**
 * ProseMirror schema for real-time speech editing
 *
 * Nodes:
 * - doc: Root document node
 * - paragraph: Represents a subtitle segment
 * - text: Text content with marks
 *
 * Marks:
 * - word: Mark each word with timing and approval state
 * - pending: Visual styling for unapproved words
 * - active: Highlight currently focused word for approval
 */

export const speechSchema = new Schema({
	nodes: {
		doc: {
			content: 'paragraph+'
		},
		paragraph: {
			content: 'text*',
			attrs: {
				// Segment metadata
				segmentIndex: { default: null },
				segmentStartTime: { default: null },
				segmentEndTime: { default: null }
			},
			toDOM(node) {
				return [
					'p',
					{
						class: 'subtitle-segment',
						'data-segment-index': node.attrs.segmentIndex,
						'data-start': node.attrs.segmentStartTime,
						'data-end': node.attrs.segmentEndTime
					},
					0
				];
			},
			parseDOM: [
				{
					tag: 'p',
					getAttrs(dom) {
						const el = dom as HTMLElement;
						return {
							segmentIndex: el.getAttribute('data-segment-index')
								? parseInt(el.getAttribute('data-segment-index')!)
								: null,
							segmentStartTime: el.getAttribute('data-start')
								? parseFloat(el.getAttribute('data-start')!)
								: null,
							segmentEndTime: el.getAttribute('data-end')
								? parseFloat(el.getAttribute('data-end')!)
								: null
						};
					}
				}
			]
		},
		text: {
			group: 'inline'
		}
	},
	marks: {
		word: {
			attrs: {
				id: {},
				start: { default: 0 },
				end: { default: 0 },
				approved: { default: false }
			},
			toDOM(mark) {
				return [
					'span',
					{
						class: mark.attrs.approved ? 'word-approved' : 'word-pending',
						'data-word-id': mark.attrs.id,
						'data-start': mark.attrs.start,
						'data-end': mark.attrs.end,
						'data-approved': mark.attrs.approved
					},
					0
				];
			},
			parseDOM: [
				{
					tag: 'span[data-word-id]',
					getAttrs(dom) {
						const el = dom as HTMLElement;
						return {
							id: el.getAttribute('data-word-id'),
							start: parseFloat(el.getAttribute('data-start') || '0'),
							end: parseFloat(el.getAttribute('data-end') || '0'),
							approved: el.getAttribute('data-approved') === 'true'
						};
					}
				}
			]
		},
		pending: {
			toDOM() {
				return ['span', { class: 'word-state-pending' }, 0];
			},
			parseDOM: [{ tag: 'span.word-state-pending' }]
		},
		active: {
			toDOM() {
				return ['span', { class: 'word-state-active' }, 0];
			},
			parseDOM: [{ tag: 'span.word-state-active' }]
		}
	}
});
