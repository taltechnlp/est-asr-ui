import { Mark, mergeAttributes } from '@tiptap/core';

export interface SuggestionOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestion: {
      setSuggestion: (attributes?: { suggestionType: 'insertion' | 'deletion' | 'substitution', originalText?: string }) => ReturnType;
      unsetSuggestion: () => ReturnType;
    };
  }
}

export const Suggestion = Mark.create<SuggestionOptions>({
  name: 'suggestion',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      suggestionType: {
        default: 'substitution',
      },
      originalText: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-suggestion-type]',
        getAttrs: (element) => {
          if (element instanceof HTMLElement) {
            return {
              suggestionType: element.getAttribute('data-suggestion-type'),
              originalText: element.getAttribute('data-original-text'),
            };
          }
          return {};
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setSuggestion: (attributes) => ({ commands }) => {
        return commands.setMark(this.type, attributes);
      },
      unsetSuggestion: () => ({ commands }) => {
        return commands.unsetMark(this.type);
      },
    };
  },
});
