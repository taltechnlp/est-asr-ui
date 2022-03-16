let sessions = [];

export const createSession = (id: string, token: string, name: string, email: string) => {
	const session = {
		token,
		id,
		name,
		email
	};
	sessions.push(session);
	return Promise.resolve(session);
};

export const getSession = (token) => {
	const session = sessions.find((session) => session.token === token);
	if (!session) return Promise.resolve(null);
	return Promise.resolve(session);
};

export const removeSession = (token) => {
	const session = sessions.find((session) => session.token === token);
	if (!session) return Promise.reject(new Error('Session not found'));
	sessions = sessions.filter((session) => session.token !== token);
	return Promise.resolve(session);
};
