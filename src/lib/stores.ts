import { writable } from 'svelte/store';

export const user = writable({ name: '', email: '', id: '' });
export const files = writable([]);
export const lang = writable({ language: 'ET'});
export const speakerNames = writable([""]);

const getSpeakerNames = (editor) => {
    const speakerNodes = editor.view.state.doc.content;
    let speakerNames = new Set();
    speakerNodes.forEach((node) =>
        node.attrs['data-name'] ? speakerNames.add(node.attrs['data-name']) : null
    );
    return Array.from(speakerNames);
};

export const changeName = (id, newName) => 
    speakerNames.update(names => {
        names[id] = newName
        console.log(names)
        return names
    })

export const addName = (newName) => 
    speakerNames.update(names => {
        names.push(newName)
        return names
    })