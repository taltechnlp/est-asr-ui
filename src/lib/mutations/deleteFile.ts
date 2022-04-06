import { GRAPHQL_ENDPOINT } from '$lib/graphql-client'

export const deleteFileMutation = `
    mutation DELETE_FILE_MUTATION($id: ID!) {
        deleteFile(id: $id) {
            id
        }
    }
`;


export const deleteFile = async (id: string) => {
	try {
		const variables = {
			id
		};
		const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: deleteFileMutation,
				variables
            })
        })
        const { data } = await response.json()
        console.log("data: ", data)
		return {
			status: 200,
			body: { }
		};
	} catch (error) {
		return {
			status: 500,
			body: { error }
		};
	}
};

