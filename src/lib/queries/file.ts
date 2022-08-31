import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';

export const fileQuery = `
            query File($fileId: ID!) {
              file(fileId: $fileId) {
                id
                state
                text
                path
                initialTranscription
                textTitle
                uploadedAt
                duration
                mimetype
                encoding
              }
            }
          `;
export const UPDATE_FILE_MUTATION = `
            mutation UPDATE_FILE_MUTATION($id: ID!, $title: String) {
              updateFile(id: $id, title: $title) {
                id
                title
              }
            }
          `;

export const getFile = async (fileId: string) => {
	const variables = { fileId };
	try {
		const response = await fetch(GRAPHQL_ENDPOINT, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query: fileQuery,
				variables
			})
		});
    console.log(response)
		const { data } = await response.json();
    console.log("file data", data)
		return data.file;
	} catch (error) {
    console.log("file error")
		return {};
	}
};
