import { GraphQLClient } from 'graphql-request';
import { API_ENDPOINT } from '../../env';
export const GRAPHQL_ENDPOINT = API_ENDPOINT;

export const client = new GraphQLClient(GRAPHQL_ENDPOINT, { credentials: 'include' });
