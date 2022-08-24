import { prisma } from "$lib/db/client";

export const get = async ({ locals }) => {
	// locals.userid comes from src/hooks.js
	const allUsers = await prisma.user.findMany({
        include: {files: true}
    })

	if (!allUsers) {
        // console.log("No response.")
	}

	if (allUsers) {
        // console.dir(allUsers, { depth: null })
		return {
			data: {
				users: await allUsers
			}
		};
	}

	return {
		status: 404
	}
};