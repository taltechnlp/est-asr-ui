import type { RequestHandler} from "./$types";
import { prisma } from '$lib/db/client';
import { error } from "@sveltejs/kit";
import { promisify } from "util";
import { randomBytes } from "crypto";
import { sendMail, createEmail } from "$lib/email";

export const POST: RequestHandler= async ({ params, url }) => {
  // Check whether user exists  
  const user = await prisma.user.findUnique({
      where: {
        email: params.email
      }
    })  
    if (!user) {
      throw error(403, 'No user with this email')
    }
  const randomBytesPromiseified = promisify(randomBytes);
  const resetToken = (await randomBytesPromiseified(20)).toString("hex");
  const resetTokenExpiry = Date.now() + 3600000 * 24; // 1 hour from now
  // 2. Set a reset token and expiry on that user
  const res = await prisma.user.update({
    where: { email: params.email },
    data: { resetToken, resetTokenExpiry }
  });
  // 3. Email them that reset token
  const mailRes = await sendMail({
    to: user.email,
    subject: "Parooli lähtestamise link",
    html: createEmail(`Siin on tellitud parooli lähtestamise link! See aegub 24 tunni jooksul.
    \n\n
    <a href="https://tekstiks.ee/reset?resetToken=${resetToken}">Klõpsa siia, et lähtestada oma tekstiks.ee parool.</a>`)
  });
  return new Response("", {status: 201, statusText: "resetTokenCreated"})

  
}
