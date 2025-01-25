import { handler } from './build/handler.js';
import express from 'express';
/* import { PrismaClient } from '@prisma/client'
export const prisma = new PrismaClient() */

const app = express();

// add a route that lives separately from the SvelteKit app
app.get('/healthcheck', (req, res) => {
	res.end('ok');
});

function start() {
	setTimeout(async function () {
		console.log('Backup polling.');

      // Again
      start();
/*       const files = await prisma.file.findMany({
        where: {
          state: {
            equals: "READY"
          }
        }
      })
      console.log(files); */
      // Every 30 sec
    }, 30000);
}

// Start infinite backup polling
start();

// let SvelteKit handle everything else, including serving prerendered pages and static assets
app.use(handler);

app.listen(5173, () => {
	console.log('listening on port 5173');
});
