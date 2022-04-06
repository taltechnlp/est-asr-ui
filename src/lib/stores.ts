import { writable } from 'svelte/store';

export const user = writable({ name: '', email: '', id: '' });
export const files = writable([]);
export const lang = writable({ language: 'ET'});
