import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { checkCompletion, getFiles } from "$lib/helpers/api";
import { SECRET_UPLOAD_DIR } from "$env/static/private";
import { prisma } from "$lib/db/client";

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) {
    throw error(401, "Not authenticated user");
  }
  const isAdmin =
    await (await prisma.user.findUnique({ where: { id: locals.userId } }))
      .role === "ADMIN";
  if (!isAdmin) throw error(403);
  const userId = params.userId;
  if (!userId) return error(400);
  let files = await getFiles(userId);
  const pendingFiles = files.filter((x) =>
    x.state == "PROCESSING" || x.state == "UPLOADED"
  );
  if (pendingFiles.length > 0) {
    const promises = pendingFiles.map((file) =>
      checkCompletion(
        file.id,
        file.externalId,
        file.path,
        file.language,
        SECRET_UPLOAD_DIR,
      )
    );
    const resultRetrieved = (await Promise.all(promises)).reduce(
      (acc, x) => acc || x.done,
      false,
    );
    if (resultRetrieved) {
      files = await getFiles(userId);
    }
  }
  return json({ files }, { status: 200 });
};
