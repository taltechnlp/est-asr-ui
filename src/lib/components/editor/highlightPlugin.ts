import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// A unique key to identify this plugin's state
export const highlightPluginKey = new PluginKey('highlightPlugin');

// The plugin for managing and displaying the highlight decoration
export function createHighlightPlugin() {
  return new Plugin({
    key: highlightPluginKey,
    state: {
      init() {
        return { activeWordId: null };
      },
      apply(tr, oldState) {
        // Check for metadata on the transaction to update the state
        const meta = tr.getMeta(highlightPluginKey);
        if (meta && meta.activeWordId !== undefined) {
          return { activeWordId: meta.activeWordId };
        }
        // If the document changed, we might need to clear the highlight
        // For simplicity, we just persist state unless told otherwise
        if (tr.docChanged && oldState.activeWordId !== null) {
           // More complex logic could map the position, but for now, we just return the old state
           return oldState;
        }
        return oldState;
      },
    },
    props: {
      decorations(state) {
        const { activeWordId } = this.getState(state);
        if (activeWordId === null) {
          return DecorationSet.empty;
        }

        const decorations: Decoration[] = [];
        // Find the node with the matching ID and create a decoration for it
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'word' && node.attrs.identifier === activeWordId) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-playing',
              })
            );
            return false; // Stop searching once found
          }
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

// Utility function to read a segment of the document
export function readSegment(view: any, from?: number, to?: number) {
  const words: any[] = [];
  if (from === undefined || to === undefined) return words;

  view.state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node.type.name === 'word') {
      words.push({
        pos,
        ...node.attrs,
      });
    }
  });
  return words;
}

// Helper function to highlight a word by identifier
export function highlightWord(view: any, wordId: string | null) {
  const tr = view.state.tr.setMeta(highlightPluginKey, { activeWordId: wordId });
  view.dispatch(tr);
} 