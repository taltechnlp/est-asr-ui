import type { PageServerLoad } from "./$types";
import { prisma } from "$lib/db/client";

export const load: PageServerLoad = async (event) => {
  let session = await event.locals.getSession();
  if (!session && event.locals.userId) {
    const user = await prisma.user.findUnique({
      where: {
        id: event.locals.userId
      }
    })
    if (user) {
      session = {
        user: {
          id: user.id,
          email: user.email,
          image: user.image,
          name: user.name 
        }, 
        expires: new Date("2099").toISOString()    }
    } 
  }
  return {session}; 
};