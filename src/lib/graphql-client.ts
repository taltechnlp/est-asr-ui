import { GraphQLClient } from 'graphql-request';
import { env } from '$env/dynamic/private';

export const client = new GraphQLClient(env.SECRET_API_ENDPOINT ?? '', { credentials: 'include' });
