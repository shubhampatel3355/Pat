// argon2id with OWASP's recommended minimum (19 MiB, 2 iterations, 1 lane).
// Shared by the app and the seed script (which runs outside Next.js).
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;
