import {GraphQLClient} from 'graphql-request'
console.log('siin')
const GRAPHQL_ENDPOINT = "http://localhost:4444" // process.env['GRAPHQL_ENDPOINT']
console.log(GRAPHQL_ENDPOINT)

export const client = new GraphQLClient(GRAPHQL_ENDPOINT, {credentials: 'include'})

