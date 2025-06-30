import { Schema } from 'prosemirror-model';

export const transcriptionSchema = new Schema({
  nodes: {
    doc: {
      content: 'transcription_block+'
    },
    
    transcription_block: {
      content: 'word+',
      group: 'block',
      attrs: {
        speakerName: { default: '' },
        speakerId: { default: '' },
        topic: { default: '' }
      },
      parseDOM: [{
        tag: 'div.speaker',
        getAttrs(dom) {
          const element = dom as HTMLElement;
          return {
            speakerName: element.getAttribute('data-speaker-name') || '',
            speakerId: element.getAttribute('data-speaker-id') || '',
            topic: element.getAttribute('data-topic') || ''
          };
        }
      }],
      toDOM(node) {
        const header = ['div', { class: 'speaker-header' }, node.attrs.speakerName || 'Unknown Speaker'];
        const content = ['div', { class: 'speaker-content' }, 0];
        return ['div', {
          class: 'speaker-block',
          'data-speaker-name': node.attrs.speakerName,
          'data-speaker-id': node.attrs.speakerId,
          'data-topic': node.attrs.topic
        }, header, content];
      }
    },
    
    word: {
      group: 'inline',
      inline: true,
      content: 'text*',
      attrs: {
        timecode: { default: 0.0 },
        identifier: { default: '' }
      },
      parseDOM: [{
        tag: 'span.word',
        getAttrs(dom) {
          const element = dom as HTMLElement;
          return {
            timecode: parseFloat(element.getAttribute('data-timecode') || '0') || 0.0,
            identifier: element.getAttribute('data-identifier') || ''
          };
        }
      }],
      toDOM(node) {
        return ['span', {
          class: 'word',
          'data-timecode': node.attrs.timecode,
          'data-identifier': node.attrs.identifier,
          contenteditable: 'true'
        }, 0];
      }
    },

    // A standard text node is required by ProseMirror, even if not directly used in content
    text: {
      group: 'inline',
    },
  },
  marks: {}, // No marks (like bold, italic) are needed for this editor
});
