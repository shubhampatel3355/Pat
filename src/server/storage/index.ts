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
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Short-lived download URL that forces "Save as" with the given filename. */
  signedDownloadUrl(key: string, filename: string, ttlSeconds?: number): Promise<string>;
}

const contentDisposition = (filename: string) => `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

class S3Storage implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  private ready: Promise<void> | undefined;

  constructor() {
    const e = env();
    this.bucket = e.S3_BUCKET!;
    this.client = new S3Client({
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
    });
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
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
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
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: contentDisposition(filename) }), {
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

export { contentDisposition };
