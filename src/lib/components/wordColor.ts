import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const WordColor = Extension.create({
    name: 'wordColor',
    addProseMirrorPlugins() {
        let wordColor =
            new Plugin({
                key: new PluginKey('wordColor'),
                state: {
                    init(plugins, editorState) {
                        let lastPos = 0;
                        let posMap = [];
                        let posOffset = 0
                        let limit = editorState.doc.nodeSize - 2
                        editorState.doc.nodesBetween(0, limit, (node, pos, parent) => {
                            const mark = node.marks.find(x => x.type.name === "word")
                            if (mark) {
                                posMap.push({ ...mark.attrs, startPos: pos + posOffset, node, endPos: pos + posOffset + node.nodeSize })
                            }
                        })
                        return { set: DecorationSet.create(editorState.doc, []), lastPos, posMap }
                    },
                    apply(tr, state, oldState, newState) {
                        if (tr.getMeta('wordColor')) {
                            const { id, start, end, event } = tr.getMeta('wordColor');
                            const node = state.posMap.find(x => x.id === id)
                            if (node && event == 'in') {
                                return {
                                    set: DecorationSet.create(tr.doc, [
                                        Decoration.inline(0, node.startPos - 1, { style: "color: #9b9b9b" }),
                                        Decoration.inline(node.startPos, node.endPos, { style: "color: #70acc7" })
                                    ]),
                                    lastPos: node.startPos,
                                    posMap: state.posMap
                                }
                            }
                            else if (node && event == 'out') {
                                return {
                                    set: DecorationSet.create(tr.doc, [
                                        Decoration.inline(0, node.endPos, { style: "color: #9b9b9b" })
                                    ]),
                                    lastPos: node.startPos,
                                    posMap: state.posMap
                                }
                            }
                            return state
                        }
                        else return {
                            set: state.set.map(tr.mapping, tr.doc), lastPos: state.lastPos,
                            posMap: state.posMap
                        }
                    }
                },
                props: {
                    handleDOMEvents: {
                        "progress": (view, event) => {
                            // console.log("plugin", event)
                            return true
                        }
                    },
                    handleClick(view, pos, event) {
                        // console.log(event, pos, view)
                        // console.log("A key was pressed!", view, event)
                        if (view.state.doc.nodeAt(pos) && view.state.doc.nodeAt(pos).marks && view.state.doc.nodeAt(pos).marks[0]) {
                            const attrs = view.state.doc.nodeAt(pos).marks[0].attrs
                            if (attrs.start)
                                window.myPlayer.seekTo(attrs.start / window.myPlayer.getDuration())
                            // console.log(window.myPlayer.seekTo(attrs.start / window.myPlayer.getDuration()) /* window.myPlayer.seekTo(attrs.start / window.myPlayer.getDuration()) */)
                        }
                        // console.log(pos, view.state.doc.nodeAt(pos).marks, view.state.doc.resolve(pos).textOffset, view.state.doc.nodeAt(pos).nodeSize)

                        return true // We did not handle this
                    },
                    decorations(state) {
                        return wordColor.getState(state).set
                    }
                }
            })
        return [wordColor]
    },
})