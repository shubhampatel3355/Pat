import { mobileRoute, NotFoundError } from "@/server/mobile/http";
import { fileDownloadUrl } from "@/server/services/files";

/** A 60-second signed download link for a file (the web redirects to the same link from /api/files/[id]). */
export const GET = mobileRoute<{ id: string }>(async ({ user, params, meta }) => {
  const link = await fileDownloadUrl(user, params.id, meta);
  if (!link) throw new NotFoundError("File not found.");
  return link;
});
