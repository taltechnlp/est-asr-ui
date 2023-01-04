import {
  Mark,
  markInputRule,
  markPasteRule,
  mergeAttributes,
} from '@tiptap/core'

export interface LabelHighlightOptions {
  multicolor: boolean,
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    labelHighlight: {
      /**
       * Set a highlight mark
       */
      setHighlight: (attributes?: { color: string, annolabel: string, annovalue: string, }) => ReturnType,
      /**
       * Toggle a highlight mark
       */
      toggleHighlight: (attributes?: { color: string, annolabel: string, annovalue: string, }) => ReturnType,
      /**
       * Unset a highlight mark
       */
      unsetHighlight: () => ReturnType,
    }
  }
}

export const inputRegex = /(?:^|\s)((?:==)((?:[^~=]+))(?:==))$/
export const pasteRegex = /(?:^|\s)((?:==)((?:[^~=]+))(?:==))/g

export const LabelHighlight = Mark.create<LabelHighlightOptions>({
  name: 'labelHighlight',

  marks: '_',

  priority: 100,

  addOptions() {
    return {
      multicolor: true,
      HTMLAttributes: {
      },
    }
  },

  addAttributes() {
    if (!this.options.multicolor) {
      return {}
    }

    return {
      color: {
        default: null,
        parseHTML: element => element.getAttribute('data-color') || element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.color) {
            return {}
          }

          return {
            'data-color': attributes.color,
            style: `background-color: ${attributes.color}; color: inherit`,
          }
        },
      },
      annolabel: {
        default: null,
        parseHTML: element => element.getAttribute('annolabel'),
        renderHTML: attributes => {
          return {annolabel: attributes.annolabel}
        }
      },
      annovalue: {}
    }
  },

  parseHTML() {
    return [
      {
        tag: 'mark',
      },
    ]
  },

  renderHTML({ HTMLAttributes, mark }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setHighlight: attributes => ({ commands }) => {
        return commands.setMark(this.name, attributes)
      },
      toggleHighlight: attributes => ({ commands }) => {
        return commands.toggleMark(this.name, attributes)
      },
      unsetHighlight: () => ({ commands }) => {
        return commands.unsetMark(this.name)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () => this.editor.commands.toggleHighlight(),
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: inputRegex,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: pasteRegex,
        type: this.type,
      }),
    ]
  },
  
})