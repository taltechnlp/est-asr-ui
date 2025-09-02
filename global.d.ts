interface ImportMetaEnv {
	VITE_PUBLIC_BASE_PATH: string;
}

declare namespace svelte.JSX {
	interface HTMLAttributes<T> {
		onoutclick?: () => void;
	}
}
