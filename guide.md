prosemirror-utils has helpers for this, but there isn't a single "magic" function for your exact use case. Instead, you'll use a combination of its utilities to find the nodes and then use core ProseMirror methods to perform the replacement.

The most helpful utility in prosemirror-utils for your task is findChildren().

Why findChildren() is Your Key Utility
Your core problem is to:

Isolate a list of sibling nodes (the words inside a paragraph, for instance).

Iterate through that list to find a consecutive sub-sequence whose combined text matches your target phrase.

Get the document positions for the start of the first node and the end of the last node in that sub-sequence.

findChildren(parentNode, predicate) is perfect for step 1. It gives you an array of {node, pos} objects, which is exactly what you need to perform the iteration and position calculation.

Step-by-Step Guide with a Concrete Example
Let's assume:

Your schema has a paragraph node that contains inline word nodes.

Each word node has a text attribute (e.g., <word text="Hello"></word>).

You want to find the sequence of nodes for "quick brown fox" and replace it with nodes for "fast brown dog".

Here is how you would build a command to do this, using prosemirror-utils and core ProseMirror APIs.

1. The Command Structure
   First, you'll set up a custom Tiptap command. The logic will live inside.

JavaScript

import { findChildren, findParentNode } from 'prosemirror-utils';
import { Fragment } from 'prosemirror-model';

// The command to be added to your Tiptap extension
const replacePhraseCommand = (searchText, replacementWords) => () => ({ editor }) => {
const { state, view } = editor;
const { tr, schema } = state;
const { selection } = state;

    // ... a lot of logic will go here ...

    view.dispatch(tr);
    return true;

}; 2. Find the Context and Get Candidate Nodes
You need to decide where to search. A good starting point is the parent block node of the current selection. findParentNode is great for this, and findChildren then gets all the word nodes within it.

JavaScript

// Find the paragraph we are currently inside
const parent = findParentNode((node) => node.isBlock)(selection);
if (!parent) {
return false; // Not in a block node, can't search
}

// Use findChildren to get all 'word' nodes in this paragraph
const wordNodes = findChildren(
parent.node,
(node) => node.type.name === 'word'
);

// We now have an array like:
// [ {node: Node, pos: 12}, {node: Node, pos: 18}, ... ] 3. The Core Logic: Find the Consecutive Node Sequence
This is the part you have to write yourself, but prosemirror-utils has given you the clean data structure to work with.

JavaScript

const wordsToFind = searchText.split(' ');
let match = null;

// Iterate through all word nodes to find the start of a potential match
for (let i = 0; i <= wordNodes.length - wordsToFind.length; i++) {
const potentialMatch = wordNodes.slice(i, i + wordsToFind.length);
const potentialPhrase = potentialMatch.map(wn => wn.node.attrs.text).join(' ');

    if (potentialPhrase === searchText) {
        // We found it!
        match = potentialMatch;
        break;
    }

}

if (!match) {
return false; // Phrase not found
} 4. Calculate the Replacement Range and Create New Nodes
Now that you have the matching nodes, you can determine the exact document range to replace.

JavaScript

// Get the start position from the first matched node
const from = match[0].pos;

// Get the end position from the last matched node
const lastNode = match[match.length - 1];
// The end position is the start of the node + its size
const to = lastNode.pos + lastNode.node.nodeSize;

// Create the new nodes to insert
const newNodes = replacementWords.map(wordText => {
// Assuming your word node might have other attributes, otherwise they are null
return schema.nodes.word.create({ text: wordText });
});

// We also need to add a space node/mark between words if your schema requires it.
// For simplicity, let's assume words are just placed next to each other.
// A more robust solution would handle spaces. 5. Perform the Replacement and Dispatch
Finally, use the core tr.replaceWith() method.

JavaScript

tr.replaceWith(from, to, newNodes);

// You might also want to set the selection after the replacement
const newPos = from + newNodes.reduce((size, node) => size + node.nodeSize, 0);
tr.setSelection(TextSelection.create(tr.doc, newPos));

view.dispatch(tr);
return true;
Complete Example Command
JavaScript

import { findChildren, findParentNode } from 'prosemirror-utils';
import { TextSelection } from 'prosemirror-state';

/\*\*

- Creates a Tiptap command to find a sequence of word nodes and replace them.
- @param {string} searchText - The phrase to find, e.g., "quick brown fox".
- @param {string[]} replacementWords - An array of words to replace with, e.g., ["fast", "brown", "dog"].
  \*/
  const replacePhraseCommand = (searchText, replacementWords) => () => ({ editor }) => {
  const { state, view } = editor;
  const { tr, schema, selection } = state;

// 1. Find the parent block to search within
const parent = findParentNode((node) => node.isBlock)(selection);
if (!parent) return false;

// 2. Get all 'word' nodes from the parent using the key utility
const wordNodes = findChildren(parent.node, (node) => node.type.name === 'word');

const wordsToFind = searchText.split(' ');
let match = null;

// 3. Loop through the nodes to find a consecutive match
if (wordNodes.length >= wordsToFind.length) {
for (let i = 0; i <= wordNodes.length - wordsToFind.length; i++) {
const potentialMatch = wordNodes.slice(i, i + wordsToFind.length);
const potentialPhrase = potentialMatch.map(wn => wn.node.attrs.text).join(' ');

      if (potentialPhrase === searchText) {
        match = potentialMatch;
        break;
      }
    }

}

if (!match) return false; // Phrase not found

// 4. Calculate replacement range
const from = match[0].pos;
const lastNode = match[match.length - 1];
const to = lastNode.pos + lastNode.node.nodeSize;

// 5. Create new nodes
const newNodes = replacementWords.map(wordText =>
schema.nodes.word.create({ text: wordText })
);

// 6. Perform the replacement and dispatch the transaction
tr.replaceWith(from, to, newNodes);
view.dispatch(tr);

return true;
};

// How to use it in your Tiptap extension's addCommands() method:
// addCommands() {
// return {
// ...this.parent(),
// replacePhrase: (searchText, replacementWords) =>
// replacePhraseCommand(searchText, replacementWords)(this),
// }
// }

// And in your editor:
// editor.commands.replacePhrase('quick brown fox', ['fast', 'brown', 'dog']);
Summary
Your Go-To Utility: findChildren(parentNode, predicate) from prosemirror-utils is the ideal tool to get the array of nodes you need to analyze.

Your Logic: You will still need to write the JavaScript loop that iterates over the results from findChildren to identify the consecutive sequence.

Your Action: The final replacement is done with the standard ProseMirror tr.replace() or tr.replaceWith() method, not a prosemirror-utils function.
