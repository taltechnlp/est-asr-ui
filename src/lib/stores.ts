import { writable } from 'svelte/store';

export const me = writable({name: "", email: "", id: ""});