const checkPath = (event) => {
	return !event.url.pathname.startsWith('/demo') && !event.url.pathname.startsWith('/files/')
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event, {
	  ssr: (()=>checkPath(event))(),
	  transformPage: ({ html }) => html.replace('old', 'new')
	});
   
	return response;
  }
