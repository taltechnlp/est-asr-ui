import {GRAPHQL_ENDPOINT} from '$lib/graphql-client'

export const userQuery = `
				query {
					me {
						id
						email
						name
					}
				}
			`;

export const getUser = async () => {
    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: userQuery
            })
        })
        const { data } = await response.json()
        console.log("data: ",data)
        return data.me;
    } catch (error) {
        return {}
    }
    
}
