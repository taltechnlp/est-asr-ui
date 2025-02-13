import { prisma } from "$lib/db/client";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  createReadStream,
  promises as fs,
  readFile,
  ReadStream,
  stat,
  statSync,
} from "fs";
import { promisify } from "util";

// Return the audio or video file for playback. Authorization requried.
export const GET: RequestHandler = async ({ params, locals, request }) => {
  let userId = locals.userId;
    if (!userId) {
        let session = await locals.getSession();
        if (session && session.user) userId = session.user.id;
    }
    if (!userId) {
        redirect(307, "/signin");
    }
  const file = await prisma.file.findUnique({
    where: {
      id: params.fileId,
    },
    include: {
      User: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });
  if (!file) error(404);
  const isAdmin =
    await (await prisma.user.findUnique({ where: { id: userId } }))
      .role === "ADMIN";
  if ((userId === file.User.id || isAdmin)) {
    let location = file.path;
    const fileInfo = promisify(stat);

    /** Calculate Size of file */
    const { size } = await fileInfo(location);
    const range = request.headers.get("Range");

    /** Check for Range header */
    if (range) {
      /** Extracting Start and End value from Range Header */
      let [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      let start = parseInt(startStr, 10);
      let end = endStr ? parseInt(endStr, 10) : size - 1;

      if (!isNaN(start) && isNaN(end)) {
        start = start;
        end = size - 1;
      }
      if (isNaN(start) && !isNaN(end)) {
        start = size - end;
        end = size - 1;
      }

      // Handle unavailable range request
      if (start >= size || end >= size) {
        // Return the 416 Range Not Satisfiable.
        return new Response("", {
          headers: {
            "Content-Range": `bytes */${size}`,
          },
          status: 416,
        });
      }

      /** Sending Partial Content With HTTP Code 206 */
      let readable = createReadStream(location, { start: start, end: end });
      let readableStream = createReadableStreamFromReadStream(readable);

      return new Response(readableStream, {
        headers: {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": (end - start + 1).toString(),
          "Content-Type": "audio/mpeg",
        },
        status: 206,
      });
    } else {
      let readable = createReadStream(location);
      let readableStream = createReadableStreamFromReadStream(readable);
      /* let res: ReadStream;
          pipeline(readable, res, (err) => {
            console.log(err);
          }); */

      return new Response(readableStream, {
        headers: {
          "Content-Length": size.toString(),
          "Content-Type": "audio/mpeg",
        },
        status: 200,
      });
    }
  }
  error(401, "unauthorized");
};

function createReadableStreamFromReadStream(readStream) {
  return new ReadableStream({
    start(controller) {
      readStream.on('data', chunk => {
        controller.enqueue(chunk);
      });
      readStream.on('end', () => {
        controller.close();
      });
      readStream.on('error', err => {
        controller.error(err);
      });
    },
    cancel() {
      readStream.destroy();
    }
  });
}