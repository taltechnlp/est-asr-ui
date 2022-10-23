import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store'
import {v4 as uuidv4} from "uuid";
import type { Speaker, Word } from '$lib/helpers/converters/types'

export const user = writable({ name: '', email: '', id: '' });
export const files = writable([]);
export const lang = writable({ language: 'ET' });

export const speakerNames: Writable<Array<Speaker>> = writable([]);
export const words: Writable<Array<Word>> = writable([])
export const editor = writable(null);
export const editorMounted = writable(false)
export const player = writable({
	playing: false,
	muted: false
});
export const playingTime = writable(0)

export const addSpeakerName = (newName, start) => {
	let nameId;
	speakerNames.update((names) => {
		const exists = names.find(n=>n.name===newName)
		if (!exists) {
			nameId = uuidv4().substring(32 - 12);
			names.push({name: newName, id: nameId, start });
		}
		return names;
	})
	return nameId;
}

