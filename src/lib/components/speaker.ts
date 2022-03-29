import { Node, nodeInputRule, mergeAttributes } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import { text } from 'svelte/internal';
import SpeakerSelect from './SpeakerSelect.svelte';

export interface SpeakerOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		speaker: {
			setSpeaker: () => ReturnType;
		};
	}
}

export const Speaker = Node.create<SpeakerOptions>({
	name: 'speaker',
	group: 'block',
	priority: 1100,
	content: 'inline*',

	parseHTML() {
		return [
			{
				tag: 'speaker'
			}
		];
	},

	addOptions() {
		return {
			HTMLAttributes: {}
		};
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
	},

	/* addCommands() {
    return {
      setSpeaker: () => ({ chain }) => {
        return chain()
          // remove node before speaker if it’s an empty text block
          /* .command(({ tr, dispatch }) => {
            const { selection } = tr
            const { empty, $anchor } = selection
            const isEmptyTextBlock = $anchor.parent.isTextblock
              && !$anchor.parent.type.spec.code
              && !$anchor.parent.textContent
            console.log($anchor.parent.isTextblock, !$anchor.parent.type.spec.code, !$anchor.parent.textContent, $anchor.parent.content)
            if (!empty || !isEmptyTextBlock || !dispatch) {
              console.log("ei kustuta", !empty, !isEmptyTextBlock, !dispatch)
              return true
            }

            const posBefore = $anchor.before()

            tr.deleteRange(posBefore, posBefore + 1)

            return true
          }) 
          .insertContent({ type: this.name })
          .command(({ tr, dispatch }) => {
            if (dispatch) {
              const { parent, pos } = tr.selection.$from
              const posAfter = pos + 1
              const nodeAfter = tr.doc.nodeAt(posAfter)

              if (!nodeAfter) {
                const node = parent.type.contentMatch.defaultType?.create()

                if (node) {
                  tr.insert(posAfter, node)
                  tr.setSelection(TextSelection.create(tr.doc, posAfter))
                }
              }

              tr.scrollIntoView()
            }

            return true
          })
          .run()
      },
    }
  }, */

	addAttributes() {
		return {
			'data-name': '',
			id: {}
		};
	},

	addNodeView() {
		return SvelteNodeViewRenderer(SpeakerSelect);
	},

	/* addCommands() {
		return {
			setParagraph: () => ({ commands }) => {
				return commands.setNode(this.name);
			}
		};
	}, */

	/* addNodeView() {
    return ({ editor, node, getPos, HTMLAttributes, decorations, extension }) => {
      // Markup
      
        <div class="speaker">
          <span class="speaker-select">${node.attrs.name} </span>
          <div class="timestamp">
            <span>{node.attrs.startTime}</span>
          </div>
        </div>
      
      const { view } = editor
      console.log(node.attrs)

      


      const dom = document.createElement('div')
      dom.classList.add('node-view')

      const label = document.createElement('span')
      label.classList.add('label')
      label.innerHTML = node.attrs.name

      const content = document.createElement('div')
      content.classList.add('content')

      const button = document.createElement('button')
      button.innerHTML = `This button has been clicked ${node.attrs.count} times.`
      button.addEventListener('click', () => {
        if (typeof getPos === 'function') {
          console.log(getPos())
          view.dispatch(view.state.tr.setNodeMarkup(getPos(),undefined,{name: "Inimene"}))
        }
      })
      content.append(button)

      dom.append(label, content)


      return {
        dom,
      }
    }
  }, */

	/* addInputRules() {
		return [nodeInputRule(/^(?:---|—-|___\s|\*\*\*\s)$/, this.type)];
	} */
});
