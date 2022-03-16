import { GraphQLClient } from 'graphql-request';
const GRAPHQL_ENDPOINT = 'http://localhost:4444'; // process.env['GRAPHQL_ENDPOINT']

export const client = new GraphQLClient(GRAPHQL_ENDPOINT, { credentials: 'include' });
