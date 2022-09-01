import { GraphQLClient } from 'graphql-request';
export const GRAPHQL_ENDPOINT = process.env.VITE_API_ENDPOINT;

export const client = new GraphQLClient(GRAPHQL_ENDPOINT, { credentials: 'include' });
