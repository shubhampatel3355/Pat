/**
 * DEV / DEMO ONLY — the prototype's vault documents (VAULT0) as small real files, written through the
 * configured storage driver (local folder or S3/MinIO) so downloads work. Skipped when files exist.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import ExcelJS from "exceljs";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { FolderKey } from "../src/generated/prisma/enums";
import { istToInstant } from "../src/lib/dates";
import type { DemoIds } from "./seed-demo-ops";

type Key = keyof DemoIds;

// [folder, name, date, uploaded by, owner (Employee Documents)] — VAULT0
const FILES: [FolderKey, string, string, Key, Key | null][] = [
  ["PM_DOCUMENTS", "Partnership deed — Pat Michaels Developers LLP.pdf", "2021-03-12", "PM", null],
  ["PM_DOCUMENTS", "GST registration certificate.pdf", "2021-04-02", "AM", null],
  ["PM_DOCUMENTS", "RERA agent registration.pdf", "2022-04-15", "AR", null],
  ["PM_DOCUMENTS", "Office lease — 14 Lavelle Road.pdf", "2025-11-01", "PM", null],
  ["PM_DOCUMENTS", "Professional indemnity insurance 2026.pdf", "2026-01-04", "AM", null],
  ["PM_DOCUMENTS", "Audited financials FY 2025-26.xlsx", "2026-09-30", "AM", null],
  ["CLIENT_DOCUMENTS", "Fee letter — Kirana Labs.pdf", "2026-10-03", "SK", null],
  ["CLIENT_DOCUMENTS", "Fee letter — Orbit Logistics.pdf", "2026-09-28", "DN", null],
  ["CLIENT_DOCUMENTS", "LOI — Zeta Fintech, Prestige Tech Park.pdf", "2026-10-06", "NS", null],
  ["CLIENT_DOCUMENTS", "Term sheet — Vertex Semiconductors.pdf", "2026-10-02", "NS", null],
  ["CLIENT_DOCUMENTS", "KYC — Tidal Payments.zip", "2026-09-29", "RV", null],
  ["EMPLOYEE_DOCUMENTS", "Offer letter — Imran Pasha.pdf", "2023-09-01", "AM", "IP"],
  ["EMPLOYEE_DOCUMENTS", "Offer letter — Divya Nair.pdf", "2023-02-02", "AM", "DN"],
  ["EMPLOYEE_DOCUMENTS", "PAN & Aadhaar — Sana Khan.pdf", "2022-01-19", "AM", "SK"],
  ["EMPLOYEE_DOCUMENTS", "Offer letter — Neha Sharma.pdf", "2021-03-12", "AM", "NS"],
  ["EMPLOYEE_DOCUMENTS", "Employee handbook 2026.pdf", "2026-01-05", "PM", null],
];

/** One-page PDF with a title and a few lines of Helvetica text (ASCII only). */
function simplePdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/—/g, "-").replace(/[^\x20-\x7e]/g, "").replace(/[\\()]/g, (m) => `\\${m}`);
  const content = ["BT", "/F1 18 Tf", "72 770 Td", `(${esc(title)}) Tj`, "/F1 11 Tf", ...lines.flatMap((l) => ["0 -22 Td", `(${esc(l)}) Tj`]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP holding one stored (uncompressed) file. */
function zipOne(name: string, data: Buffer): Buffer {
  const n = Buffer.from(name, "utf8");
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(n.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + n.length, 12);
  end.writeUInt32LE(30 + n.length + data.length, 16);
  return Buffer.concat([local, n, data, central, n, end]);
}

async function contentFor(name: string): Promise<{ body: Buffer; mime: string; ext: string }> {
  const title = name.replace(/\.[a-z]+$/i, "");
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Summary");
    ws.addRows([["Pat Michaels Developers LLP"], [title], [], ["Figure", "Amount (Rs)"], ["Revenue", 28508000], ["Expenses", 12030000], ["Profit before tax", 16478000]]);
    return { body: Buffer.from(await wb.xlsx.writeBuffer()), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
  }
  if (name.endsWith(".zip")) {
    const inner = simplePdf(`${title} - certificate of incorporation`, ["Demo document generated by the development seed."]);
    return { body: zipOne("certificate-of-incorporation.pdf", inner), mime: "application/zip", ext: "zip" };
  }
  return { body: simplePdf(title, ["Pat Michaels Developers LLP", "14, Lavelle Road, Bengaluru 560001", "", "Demo document generated by the development seed."]), mime: "application/pdf", ext: "pdf" };
}

/** Writes with the same layout as src/server/storage (which is server-only and can't be imported here). */
async function put(key: string, body: Buffer, mime: string) {
  if ((process.env.STORAGE_DRIVER ?? "s3") === "local") {
    const file = path.resolve(".local/storage", key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  const bucket = process.env.S3_BUCKET!;
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  await client.send(new HeadBucketCommand({ Bucket: bucket })).catch(() => client.send(new CreateBucketCommand({ Bucket: bucket })));
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mime }));
}

export async function seedDemoVault(prisma: PrismaClient, ids: DemoIds, shift: (iso: string) => string, log: (m: string) => void) {
  if (await prisma.file.count({ where: { folderId: { not: null }, invoiceId: null } })) return;
  const folders = new Map((await prisma.folder.findMany()).map((f) => [f.key, f.id]));
  for (const [folder, name, date, by, owner] of FILES) {
    const { body, mime, ext } = await contentFor(name);
    const when = date >= "2026-09-01" ? shift(date) : date;
    const key = `${folder.toLowerCase().replace(/_/g, "-")}/${when.slice(0, 7)}/${randomUUID()}.${ext}`;
    await put(key, body, mime);
    await prisma.file.create({
      data: {
        folderId: folders.get(folder)!,
        name,
        storageKey: key,
        sizeBytes: body.length,
        mime,
        sha256: createHash("sha256").update(body).digest("hex"),
        ownerUserId: owner ? ids[owner] : null,
        uploadedById: ids[by],
        createdAt: istToInstant(when, "11:00"),
      },
    });
  }
  log(`Inserted ${FILES.length} vault files`);
}
