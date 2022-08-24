import Tiptap from '$lib/components/Tiptap.svelte';
import Player from '$lib/components/Player.svelte';
import { fileQuery, getFile } from '$lib/queries/file';
import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';
throw new Error("@migration task: Migrate the load function input (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292693)");
export async function load({ params, fetch, session, stuff }) {
	const file = await getFile(params.fileId);
	return { file };
}
