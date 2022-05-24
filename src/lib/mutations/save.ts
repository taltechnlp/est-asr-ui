import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';

export const saveChanges = async (text, fileId) => {
	console.log(text);
	const res = await fetch(
		(process.env.NODE_ENV === 'development' ? GRAPHQL_ENDPOINT : GRAPHQL_ENDPOINT) +
			`/transcript?id=${fileId}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(text)
		}
	)
		.then((res) => {
			console.log('Salvestatud!');
		})
		.catch((e) => {
			console.log('Viga automaatsel salvestamisel! Kontrolli internetiühendust.');
		});
};
