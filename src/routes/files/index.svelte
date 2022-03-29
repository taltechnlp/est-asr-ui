<script context="module">
	import { user as userStore, files as filesStore } from '$lib/stores';
	import { browser } from '$app/env';
	import {GRAPHQL_ENDPOINT} from '$lib/graphql-client'

0	// TODO: sundida load fn uuesti laadima pärast failide mutatsiooni.
	// Selleks piisab kui parameetrid muutuvad. Teine variant on igas mutatsioonis uuesti laadida.

	// TODO: Long polling kui state on mõnel failil processing.
	export async function load({ params, fetch, session, stuff }) {
		let userId;
		userStore.subscribe((user) => {
			if (user && user.id) {
				userId = user.id;
			}
		});
		console.log('userId: ', userId, 'browser: ', browser);
		if (!userId) {
			const query = `
				query {
					me {
						id
						email
						name
					}
				}
			`;
			
			try {
				const response = await fetch(GRAPHQL_ENDPOINT, {
					method: 'POST',
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						query
					})
				})
				const { data } = await response.json()
				console.log("Native fetch browser", browser, "me", data)

			
				/* const { me } = await client.request(userQuery);
				console.log('Files päringus me ', me); */
				userStore.set(data.me);
			}
			catch(err) {
				console.log(err)
				return {
					status: 503,
					props: {
						error: "Süsteemi viga, teenus pole hetkel saadaval.",
						files: []
					}
				};
			}
		}
		if (userId) {
			console.log("Is browser: ", browser)
			const query = `
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
			const filesRes  = await fetch(GRAPHQL_ENDPOINT, {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					query,
					variables
				})
			})
			const  { data }  = await filesRes.json()

			if (data.filesByUser) {
				filesStore.set(data.filesByUser);
				return {
					status: 200,
					props: {
						files: data.filesByUser
					}
				};
			}
			else return {
					status: 200,
					props: {
						files: []
					}
				};
		} /* else if (browser) {
			return {
				status: 303,
				redirect: `/signin`
			};
		} */
		// Server-side prerender which does not succeed
		else return {};
	}
</script>

<script>
	export let files = [];
	export let error = ""
	const toTime = timestampt => {
		const ts = new Date(timestampt)
		const date = ts.toLocaleDateString('et-ET', {
			day:   '2-digit',
			month: '2-digit',
			year:  'numeric',
		});
		const time = ts.toLocaleTimeString('et-ET', {
			hour:   '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		return `${date} ${time}`
	}

	let loading = false;
	let upload;

	const uploadFile = async () => {
		const formData = new FormData()
		const query = `
			mutation Mutation($file: Upload!) {
				singleUpload(file: $file) {
					id
					filename
					duration
					uploadedAt
					textTitle
					state
				}
			}
		`;
		const variables = { "file": null }
		const operations = JSON.stringify({
			query,
			variables
		})
		formData.append("operations", operations)
		const map = `{"0": ["variables.file"]}`
		formData.append("map", map)
		formData.append("0", upload[0])
		console.log("formData", formData)
		try {
				const response = await fetch(GRAPHQL_ENDPOINT, {
					method: 'POST',
					credentials: 'include',
					body: formData
				})
				const data  = await response.json()
				console.log("file upload", data)
				return
		}
		catch(err) {
			console.log("Upload failed", err)
			return
		}
	}
	
</script>

<h1>{JSON.stringify(files)}</h1>

<div class="">
	<div class="flex justify-end">
		<label for="file-upload" class="btn btn-primary gap-2 mt-5 mb-2 modal-button right">
			Lae ülesse
			<svg xmlns="http://www.w3.org/2000/svg" id="Outline" width="auto" height="auto" viewBox="0 0 24 24" fill="#fff" class="h-4 w-4"><path d="M11.007,2.578,11,18.016a1,1,0,0,0,1,1h0a1,1,0,0,0,1-1l.007-15.421,2.912,2.913a1,1,0,0,0,1.414,0h0a1,1,0,0,0,0-1.414L14.122.879a3,3,0,0,0-4.244,0L6.667,4.091a1,1,0,0,0,0,1.414h0a1,1,0,0,0,1.414,0Z"/><path d="M22,17v4a1,1,0,0,1-1,1H3a1,1,0,0,1-1-1V17a1,1,0,0,0-1-1H1a1,1,0,0,0-1,1v4a3,3,0,0,0,3,3H21a3,3,0,0,0,3-3V17a1,1,0,0,0-1-1h0A1,1,0,0,0,22,17Z"/></svg>
		</label>
	</div>
	<table class="table w-full">
		<thead>
			<tr>
				<th />
				<th>Failinimi</th>
				<th>Staatus</th>
				<th>Üles laetud</th>
				<th>Tegevused</th>
			</tr>
		</thead>
		<tbody>
			{#if files}	
				{#each files as file, index}
				<tr class="hover cursor-pointer">
					<th>{index + 1}</th>
					<td>{file.filename}</td>
					<td>
						{#if file.state == "READY"}
							<div class="badge badge-success">
								VALMIS
							</div>
						{:else if file.state == "PROCESSING_ERROR"}
							<div class="badge badge-error">
								TRANSKRIBEERIMINE EBAÕNNESTUS
							</div>
						{:else if file.state == "PROCESSING"}
							<div class="badge badge-accent">
								TÖÖTLEMISEL
							</div>
						{:else if file.state == "UPLOADED"}
							<div class="badge badge-info">
								JÄRJEKORRAS
							</div>
						{/if}
					</td>
					<td>{toTime(file.uploadedAt)}</td>
					<td>
						<button class="btn btn-outline btn-xs">Lae alla</button>
						<button class="btn btn-outline btn-xs">Kustuta</button>
					</td>
				</tr>
				{/each}
			{:else if error}
			<p class="">{error}</p>
			{/if}
		</tbody>
	</table>
	<!-- Put this part before </body> tag -->
	<input type="checkbox" id="file-upload" class="modal-toggle">
	<label for="file-upload" class="modal cursor-pointer">
	<label class="modal-box relative" for="">
		<fieldset disabled={loading} aria-busy={loading}>
			<label for="file-upload" class="btn btn-sm btn-circle absolute right-2 top-2" lang="et">✕</label>
			<h3 class="text-lg font-bold mb-4">Helisalvestise ülesse laadimine</h3>
			<input class="input input-bordered pt-1" type="file" bind:files={upload} accept="audio/*,video/*,audio/wav,audio/x-wav,audio/mp3,audio/mpeg,audio/ogg,video/ogg,video/x-mpeg2,video/mpeg2,audio/x-m4a,audio/flac,audio/x-flac,audio/x-amr,audio/amr" 
			id="file" name="file" placeholder="Lae helisalvestis ülesse (kuni 100 MB)" required>
			<ul class="list-disc list-inside">
				<li class="py-4">Toetatud formaadid: wav, mp3, ogg, mp2, m4a, mp4, flac, amr, mpg.</li>
				<li class="py-4 pt-0">Faili suurus kuni 100 MB.</li>
			</ul>
			{#if upload && upload[0]}
			<button on:click={uploadFile} class="btn btn-active btn-secondary" type="submit">Lae ülesse</button>
			{:else}		
			<button class="btn btn-active btn-secondary" type="submit" disabled>Lae ülesse</button>
			{/if}
		</fieldset>
	</label>
	</label>
</div>
