import { mobileRoute } from "@/server/mobile/http";
import { vaultFolderView } from "@/server/mobile/views";

/** Files in one vault folder: pm, client or employee (same as /vault/[folder]). */
export const GET = mobileRoute<{ folder: string }>(({ user, params }) => vaultFolderView(user, params.folder));
