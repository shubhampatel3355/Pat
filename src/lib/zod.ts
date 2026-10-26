import { z } from "zod";

// Schemas in src/lib also run in the browser, where the CSP forbids eval. Without this, Zod probes
// `Function("")` the first time it builds an object schema and the browser reports a CSP violation.
z.config({ jitless: true });

export { z };
