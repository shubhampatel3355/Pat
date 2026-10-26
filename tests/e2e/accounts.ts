/** Accounts created by the demo seed. Passwords are test-only values (overridable from the environment). */
const demoPassword = process.env.SEED_DEMO_PASSWORD || "Demo-Password-2026";

export const E2E = {
  owner: {
    email: "pat@patmichaels.in",
    tempPassword: process.env.SEED_OWNER_PASSWORD || "E2e-Owner-Password-2026",
    // Must pass the app's password rules (no "password", no email name).
    newPassword: "Brigade-Road-Sunset-81",
  },
  admin: { email: "anita@patmichaels.in", password: demoPassword },
  employee: { email: "neha@patmichaels.in", password: demoPassword },
};
