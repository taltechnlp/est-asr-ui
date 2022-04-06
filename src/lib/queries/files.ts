import { GRAPHQL_ENDPOINT } from '$lib/graphql-client'

export const filesQuery = `
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
			
			
export const UPDATE_FILE_MUTATION = `
            mutation UPDATE_FILE_MUTATION($id: ID!, $title: String) {
              updateFile(id: $id, title: $title) {
                id
                title
              }
            }
          `;

export const getFiles = async (userId) => {
    const variables = {
        userId
    };
    try {
        const filesRes  = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: filesQuery,
                variables
            })
        })
        const  { data }  = await filesRes.json()
        return data.filesByUser;
    } catch (error) {
        return {}
    }

}
