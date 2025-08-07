import { writable } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store'
import {v4 as uuidv4} from "uuid";
import type { Speaker, Word } from '$lib/helpers/converters/types'
import type { PeaksInstance } from 'peaks.js';

// User session state
export const userState = $state({ name: '', email: '', id: '' });
export const files = writable([]);
export const lang = writable({ language: 'ET' });

// Editor-related state
export const speakerNames: Writable<Array<Speaker>> = writable([]);
export const words: Writable<Array<Word>> = writable([])
export const editor = writable(null);
export const editorMounted = writable(false)
export const languageAnnotationOptions = writable([{
	label: "en",
	description: "English",
	active: true
},{
	label: "fi",
	description: "Finnish",
	active: false
},{
	label: "ru",
	description: "Russian",
	active: true
},{
	label: "de",
	description: "German",
	active: true
}
])
// Editor player
export const waveform: Writable<PeaksInstance> = writable()
export const player = writable({
	playing: false,
	muted: false,
	ready: false,
});
export const playingTime = writable(0);
export const duration = writable(0);
export const fontSize = writable("16");


// User inserts a new name
export const addSpeakerName = (newName, start, end) => {
	let nameId;
	speakerNames.update((names) => {
		const exists = names.find(n=>n.name===newName)
		if (!exists) {
			nameId = uuidv4().substring(32 - 12);
			names.push({name: newName, id: nameId, start, end });
		}
		return names;
	})
	return nameId;
}

// Used adds a new speaker block
export const addSpeakerBlock = (name, start, end) => {
	let nameId;
	speakerNames.update((names) => {
		const exists = names.find(n=>n.name===name)
		if (!exists) {
			nameId = uuidv4().substring(32 - 12);
		} else nameId = exists.id;
		names.push({name, id: nameId, start, end });
		return names;
	})
	return nameId;
}


