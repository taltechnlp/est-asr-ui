import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import {Decoration, DecorationSet} from 'prosemirror-view'

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
                // console.log(editorState.doc)
                let posOffset = 0
                // console.log(editorState.doc.childCount, editorState.doc.nodeSize)
                let limit = editorState.doc.nodeSize - 2
                editorState.doc.nodesBetween(0, limit, (node, pos, parent)=>{
                    // console.log(node, pos + posOffset, node.marks.find(x=>x.type.name==="word"))
                    const mark = node.marks.find(x=>x.type.name==="word")
                    if (mark) {
                        posMap.push( {...mark.attrs, startPos: pos + posOffset, node, endPos: pos + posOffset + node.nodeSize} )
                    }
                })
                // console.log(posMap)
                /* editorState.doc.content.content.map(p => p.content.content.map(w=>{
                    posMap.set(w, w.marks[0].attrs)
                })) */
                return {set: DecorationSet.create(editorState.doc, []), lastPos, posMap}
            },
            apply(tr, state, oldState, newState) { 
                if (tr.getMeta('wordColor')) {
                    const progress = Math.round(tr.getMeta('wordColor'))
                    let set: DecorationSet = DecorationSet.create(tr.doc, [Decoration.inline(0, progress, {style: "color: #70acc7"})])
                    // console.log(tr.getMeta('wordColor'), progress, state, tr.doc.nodeAt(progress), tr.doc.nodeSize)
                    let done = false;
                    let pos = progress
                    enum Direction {
                        Unknown = 0,
                        Left = 1,
                        Right = 2,
                      }
                    let direction: Direction = 0;
                    // console.log(state.posMap)
                    const node = state.posMap.find(x => x.start <= progress && x.end >= progress)
                    if (node) {
                        return {
                            set: DecorationSet.create(tr.doc, [
                                Decoration.inline(0, node.startPos-1, {style: "color: #9b9b9b"}),
                                Decoration.inline(node.startPos, node.endPos, {style: "color: #70acc7"})
                            ]),
                            lastPos: node.startPos,
                            posMap: state.posMap
                        }
                    }
                    /* while (!done || pos <= tr.doc.nodeSize - 2) {
                        let node = tr.doc.nodeAt(pos)
                        done = true
                        let mark;
                        if (node && node.marks) {
                            mark = node.marks.find(x => x.type.name === "word") 
                        }
                        if (!mark) {
                            done = true
                            if (direction == 0) pos++;
                            else if (direction == 1) pos--;
                            else pos ++; 
                        } 
                        else if (mark.attrs.start <= progress && mark.attrs.end >= progress) {
                            done = true
                            // let resolved = tr.doc.resolve(pos)
                            // pos = resolved.end()
                            set.add(tr.doc, [
                                Decoration.inline(0, pos, {style: "color: purple"})
                            ])
                        }
                        else if (mark.attrs.start <= progress) {
                            if (direction == 0) {
                                direction = 2
                                if (pos + node.nodeSize >= tr.doc.nodeSize - 2) done = true
                                else pos = pos + node.nodeSize
                            }
                            else if (direction == 1) done = true
                            else {
                                if (pos + node.nodeSize >= tr.doc.nodeSize - 2) done = true
                                else pos = pos + node.nodeSize
                            }
                        }
                        else if (mark.attrs.end >= progress) {
                            if (direction == 0) {
                                direction = 1
                                if (pos > node.nodeSize) pos = pos - node.nodeSize
                                else done = true
                            }
                            else if (direction == 2) done = true
                            else {
                                if (pos > node.nodeSize) pos = pos - node.nodeSize
                                else done = true
                            }
                        } 
                    } */
                    return state
                }
                else return {set: state.set.map(tr.mapping, tr.doc),  lastPos: state.lastPos,
                    posMap: state.posMap}
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
                // console.log("A key was pressed!", view, event)
                if (view.state.doc.nodeAt(pos).marks && view.state.doc.nodeAt(pos).marks[0]) {
                    const attrs = view.state.doc.nodeAt(pos).marks[0].attrs
                    if (attrs.start)
                        window.myPlayer.seekTo(attrs.start / window.myPlayer.getDuration())
                    // console.log(window.myPlayer.seekTo(attrs.start / window.myPlayer.getDuration()) /* window.myPlayer.seekTo(attrs.start / window.myPlayer.getDuration()) */)
                }
                // console.log(pos, view.state.doc.nodeAt(pos).marks, view.state.doc.resolve(pos).textOffset, view.state.doc.nodeAt(pos).nodeSize)

                return true // We did not handle this
              },
            decorations(state) { return wordColor.getState(state).set
         }
          }
      })
    return [wordColor]
  },
})