/// <reference types="@sveltejs/kit" />

// See https://kit.svelte.dev/docs/types#the-app-namespace
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			userId: string | undefined;
		}
		// interface Platform {}
		// interface Session {}
		// interface Stuff {}
	}
	namespace svelteHTML {
		interface HTMLAttributes<T> {
			'on:outclick'?: (event: CustomEvent) => void
		}
	}
	
} 

declare module "@auth/sveltekit" {
	interface User {
	  /** comment **/
	  id?: string
	}
}

export {}

