<script context="module">
	import { user as userStore, files as filesStore } from '$lib/stores';
	import { client } from '$lib/graphql-client';
	import { gql } from 'graphql-request';
	import { browser } from '$app/env';

	// TODO: sundida load fn uuesti laadima pärast failide mutatsiooni.
	// Selleks piisab kui parameetrid muutuvad. Teine variant on igas mutatsioonis uuesti laadida.

	// TODO: Long polling kui state on mõnel failil processing.
	export async function load({ params, fetch, session, stuff }) {
		let userId;
		userStore.subscribe((user) => {
			if (user && user.id) {
				userId = user.id;
			}
		});
		console.log('userId: ', userId);
		if (!userId) {
			const userQuery = gql`
				query {
					me {
						id
						email
						name
					}
				}
			`;
			const { me } = await client.request(userQuery);
			console.log('Files päringus me ', me);
			userStore.set(me);
		}
		if (userId) {
			const query = gql`
				query FILES_BY_USER($userId: ID!) {
					filesByUser(userId: $userId) {
						id
						state
						text
						filename
						duration
						mimetype
						uploadedAt
						textTitle
						initialTranscription
					}
				}
			`;
			const variables = {
				userId
			};
			const { filesByUser } = await client.request(query, variables);
			console.log('failid', filesByUser);

			filesStore.set(filesByUser);
			return {
				status: 200,
				props: {
					files: filesByUser
				}
			};
		} else if (browser) {
			return {
				status: 303,
				redirect: `/signin`
			};
		}
		// Server-side prerender which does not succeed
		else return {};
	}
</script>

<script>
	export let files;
</script>

<h1>{JSON.stringify(files)}</h1>

<div class="">
	<table class="table w-full">
		<thead>
			<tr>
				<th />
				<th>Failinimi</th>
				<th>Staatus</th>
				<th>Üles laetud</th>
			</tr>
		</thead>
		<tbody>
			{#each files as file, index}
				<tr class="hover">
					<th>{index + 1}</th>
					<td>{file.filename}</td>
					<td>{file.state}</td>
					<td>{file.uploadedAt}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
