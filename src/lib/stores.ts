import { writable } from 'svelte/store';

export const user = writable({ name: '', email: '', id: '' });
export const files = writable([]);
export const lang = writable({ language: 'ET' });
export const speakerNames = writable(['']);
export const editor = writable(null);
export const player = writable({
	playing: false,
	muted: false
});

export const changeName = (id, newName) =>
	speakerNames.update((names) => {
		names[id] = newName;
		return names;
	});

export const addName = (newName) =>
	speakerNames.update((names) => {
		names.push(newName);
		return names;
	});
