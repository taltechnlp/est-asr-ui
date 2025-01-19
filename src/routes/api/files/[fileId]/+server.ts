import { prisma } from "$lib/db/client";
import { promises as fs } from "fs";
import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  let userId = locals.userId;
    if (!userId) {
        let session = await locals.getSession();
        if (session && session.user) userId = session.user.id;
    }
    if (!userId ) {
        throw error(401, "Not authenticated user");
    }
  if (!userId) {
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
    await (await prisma.user.findUnique({ where: { id: userId } }))
      .role === "ADMIN";
  if (!fileDetails || (fileDetails.User.id !== userId && !isAdmin)) {
    throw error(404, "fileNotFound");
  }
  let location = fileDetails.path;
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
        let userId = locals.userId;
        if (!userId) {
            let session = await locals.getSession();
            if (session && session.user) userId = session.user.id;
        }
        if (!userId ) {
            throw error(401, "Not authenticated user");
        }
      if (!userId) {
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
      await (await prisma.user.findUnique({ where: { id: userId } }))
        .role === "ADMIN";
    if (!file|| (file.User.id !== userId && !isAdmin)) {
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
