import { user as userStore, files as filesStore } from '$lib/stores';
import { browser } from '$app/env';
import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';
import { getUser } from '$lib/queries/user';
import { deleteFile } from '$lib/mutations/deleteFile';
import { getFiles } from '$lib/queries/files';
import { _ } from 'svelte-i18n';

export async function load({ data }) {
	let userId;
	userStore.subscribe((user) => {
		if (user && user.id) {
			userId = user.id;
		}
	});
	if (!userId) {
		const user = await getUser();
		if (user) userStore.set(user);
	}
	if (userId) {
		const files = await getFiles(userId);
		if (files) {
			filesStore.set(files);
			return {
				status: 200,
				props: {
					userId
				}
			};
		} else
			return {
				status: 200,
				props: {
					userId
				}
			};
	} else return {};
}
