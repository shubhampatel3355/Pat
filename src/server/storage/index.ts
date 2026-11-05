import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { signPayload } from "../crypto";
import { env } from "../env";
import { logger } from "../logger";

/**
 * Object storage. Production uses S3-compatible storage (MinIO / Hostinger Object Storage) and hands
 * out short-lived presigned URLs. STORAGE_DRIVER=local keeps files under .local/storage for
 * development only (rejected in production) and serves them through an HMAC-signed, expiring route.
 */
interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Short-lived download URL that forces "Save as" with the given filename. */
  signedDownloadUrl(key: string, filename: string, ttlSeconds?: number): Promise<string>;
}

const contentDisposition = (filename: string) => `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

class S3Storage implements StorageDriver {
  private client: S3Client;
  /** Signs download links for the address browsers use (S3_PUBLIC_ENDPOINT), which may differ from the internal one. */
  private signer: S3Client;
  private bucket: string;
  private ready: Promise<void> | undefined;

  constructor() {
    const e = env();
    this.bucket = e.S3_BUCKET!;
    const options = {
      region: e.S3_REGION,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
    };
    this.client = new S3Client({ ...options, endpoint: e.S3_ENDPOINT });
    this.signer = e.S3_PUBLIC_ENDPOINT ? new S3Client({ ...options, endpoint: e.S3_PUBLIC_ENDPOINT }) : this.client;
  }

  /** Creates the bucket (with versioning) on first use if it does not exist yet. */
  private ensureBucket(): Promise<void> {
    this.ready ??= (async () => {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        logger.info({ bucket: this.bucket }, "created storage bucket");
        try {
          await this.client.send(new PutBucketVersioningCommand({ Bucket: this.bucket, VersioningConfiguration: { Status: "Enabled" } }));
        } catch (err) {
          logger.warn({ err: (err as Error).message }, "could not enable bucket versioning; enable it in the storage console");
        }
      }
    })().catch((err) => {
      this.ready = undefined;
      throw err;
    });
    return this.ready;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.ensureBucket();
    const sse = env().S3_SSE;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ...(sse ? { ServerSideEncryption: sse } : {}) }));
  }

  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object ${key}`);
    return Buffer.from(bytes);
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedDownloadUrl(key: string, filename: string, ttlSeconds = 60) {
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: contentDisposition(filename) }), {
      expiresIn: ttlSeconds,
    });
  }
}

class LocalStorage implements StorageDriver {
  private root = path.resolve(".local/storage");

  private pathOf(key: string) {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return resolved;
  }

  async put(key: string, body: Buffer) {
    const file = this.pathOf(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  get(key: string) {
    return readFile(this.pathOf(key));
  }

  async remove(key: string) {
    await rm(this.pathOf(key), { force: true });
  }

  async signedDownloadUrl(key: string, filename: string, ttlSeconds = 60) {
    const token = signPayload("local-storage", { key, filename }, ttlSeconds);
    return `/api/storage/local?token=${encodeURIComponent(token)}`;
  }
}

let driver: StorageDriver | undefined;

export function storage(): StorageDriver {
  driver ??= env().STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  return driver;
}

/** True only when uploads are written with server-side encryption (shown as "encrypted at rest"). */
export function storageEncrypted(): boolean {
  const e = env();
  return e.STORAGE_DRIVER === "s3" && e.S3_SSE !== "";
}

export { contentDisposition };
