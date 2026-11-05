import "server-only";
import { connect } from "node:net";
import { env } from "../env";

type ScanVerdict = { status: "CLEAN" } | { status: "SKIPPED" } | { status: "INFECTED"; signature: string };

/**
 * Optional virus scan through a clamd daemon (CLAMAV_HOST), using the INSTREAM protocol.
 * Without CLAMAV_HOST the upload is marked SKIPPED. Scanner errors fail closed.
 */
export async function scanBuffer(buf: Buffer): Promise<ScanVerdict> {
  const { CLAMAV_HOST: host, CLAMAV_PORT: port } = env();
  if (!host) return { status: "SKIPPED" };

  const reply = await new Promise<string>((resolve, reject) => {
    const socket = connect({ host, port });
    const chunks: Buffer[] = [];
    socket.setTimeout(30_000, () => socket.destroy(new Error("ClamAV timeout")));
    socket.on("error", reject);
    socket.on("data", (d) => chunks.push(d));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim()));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const CHUNK = 64 * 1024;
      for (let i = 0; i < buf.length; i += CHUNK) {
        const part = buf.subarray(i, i + CHUNK);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length, 0);
        socket.write(len);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4)); // zero-length chunk ends the stream
    });
  });

  if (/:\s*OK$/.test(reply)) return { status: "CLEAN" };
  const found = reply.match(/:\s*(.+)\s+FOUND$/);
  if (found) return { status: "INFECTED", signature: found[1]! };
  throw new Error(`Unexpected ClamAV reply: ${reply}`);
}
