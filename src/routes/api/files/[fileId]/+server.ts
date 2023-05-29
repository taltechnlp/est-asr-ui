import { prisma } from "$lib/db/client";
import { promises as fs } from "fs";
import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import path from "path";
import { SECRET_AUDIO_UPLOAD_DIR } from "$env/static/private";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const session = await locals.getSession();
  if (!session || !session.user) {
    throw error(401, "Not authenticated user");
  }
  // Validate that the user owns the file
  const fileDetails = await prisma.file.findUnique({
    where: {
      id: params.fileId,
    },
    select: {
      path: true,
      initialTranscriptionPath: true,
      User: {
        select: {
          id: true,
          email: true
        },
      },
    },
  });
  const isAdmin =
    await (await prisma.user.findUnique({ where: { email: session.user.email } }))
      .role === "ADMIN";
  if (!fileDetails || (fileDetails.User.email !== session.user.email && !isAdmin)) {
    throw error(404, "fileNotFound");
  }
  let location = fileDetails.path;
 /*  if (location.charAt[0] !== "/") {
    location = path.join(SECRET_AUDIO_UPLOAD_DIR, location);
  } */
  await fs.rm(location).catch((e) => {
    console.log("Failed to remove file from disk!", e);
  });
  await prisma.file.delete({
    where: {
      id: params.fileId,
    },
  }).catch((e) => {
    console.log("Failed to remove file from DB!", e);
    throw error(503, "fileNotDeleted");
  });
  console.log(`file ${params.fileId} deleted`);
  return new Response("", { status: 200 });
};

// Save edited transcription to disk
export const PUT: RequestHandler = async ({ params, request, locals }) => {
    const session = await locals.getSession();
    if (!session || !session.user) {
        throw error(401, "Not authenticated user");
      }
      const editorContent = await request.json();
      const file = await prisma.file.findUnique({
          where: {
              id: params.fileId,
            },
            select: {
                initialTranscriptionPath: true,
                User: {
                    select: {
                      id: true,
                      email: true
                    },
                  },
            },
        });
    const isAdmin =
      await (await prisma.user.findUnique({ where: { email: session.user.email } }))
        .role === "ADMIN";
    if (!file|| (file.User.email !== session.user.email && !isAdmin)) {
      throw error(404, "fileNotFound");
    }
  try {
    await fs.writeFile(
      file.initialTranscriptionPath,
      JSON.stringify(editorContent),
    );
    return new Response("", { status: 201 });
  } catch (err) {
    console.log(err, file.initialTranscriptionPath);
    throw error(500, "fileWriteError");
  }
};
