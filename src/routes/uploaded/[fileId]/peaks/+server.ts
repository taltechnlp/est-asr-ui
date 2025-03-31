import { prisma } from "$lib/db/client";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  promises as fs,
  stat,
} from "fs";
import { promisify } from "util";

export const GET: RequestHandler = async ({ params, locals }) => {
    /* const session = await locals.auth();
    if (!session || !session.user.id) {
        redirect(307, "/signin");
    } */
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId,
        },
        include: {
        /* User: {
            select: {
            id: true,
            email: true
            }
        } */
        }
    });
    if (!file) error(404);

    /* if ((session.user.id !== file.User.id )) {
        error(401, "unauthorized");
    } */
    let location = file.path + '.dat';

    const fileInfo = promisify(stat);
    const { size } = await fileInfo(location);
    const data = await fs.readFile(location);
    console.log("serving peaks", size);
    return new Response(new Uint8Array(data.buffer), {
        headers: {
            "Content-Length": size.toString(),
            "Content-Type": "application/octet-stream"
        },
        status: 200
    });
};