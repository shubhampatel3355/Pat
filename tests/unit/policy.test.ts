import { describe, expect, it } from "vitest";
import { PERMISSION_DEFS, type PermissionKey } from "@/lib/permissions";
import { can, type SessionUser } from "@/server/policy";

function user(role: SessionUser["role"], id = `${role.toLowerCase()}-1`): SessionUser {
  const perms = new Set<PermissionKey>(role === "EMPLOYEE" ? [] : PERMISSION_DEFS.filter((p) => p.defaults.ADMIN).map((p) => p.key));
  return { id, email: `${id}@x.in`, name: id, firstName: id, initials: "XX", role, title: null, partnerId: null, mustChangePassword: false, perms };
}

const owner = user("OWNER");
const admin = user("ADMIN");
const employee = user("EMPLOYEE", "emp-1");

describe("owners", () => {
  it("can do everything", () => {
    expect(can(owner, "delete", { type: "wip", brokerUserIds: [] })).toBe(true);
    expect(can(owner, "update", { type: "team", targetRole: "OWNER" })).toBe(true);
    expect(can(owner, "manage", { type: "roles" })).toBe(true);
  });
});

describe("admins", () => {
  it("cannot change owners or role definitions", () => {
    expect(can(admin, "update", { type: "team", targetRole: "OWNER" })).toBe(false);
    expect(can(admin, "manage", { type: "roles" })).toBe(false);
    expect(can(admin, "update", { type: "team", targetRole: "EMPLOYEE" })).toBe(true);
  });
  it("see client contact info and finance", () => {
    expect(can(admin, "view_contacts", { type: "bd" })).toBe(true);
    expect(can(admin, "view", { type: "finance" })).toBe(true);
  });
});

describe("employees", () => {
  it("see only WIP rows where they are a broker", () => {
    expect(can(employee, "view", { type: "wip", brokerUserIds: ["emp-1", "x"] })).toBe(true);
    expect(can(employee, "view", { type: "wip", brokerUserIds: ["someone-else"] })).toBe(false);
    expect(can(employee, "update", { type: "wip", brokerUserIds: ["someone-else"] })).toBe(false);
    expect(can(employee, "delete", { type: "wip", brokerUserIds: ["emp-1"] })).toBe(false);
  });
  it("never see client contact info", () => expect(can(employee, "view_contacts", { type: "bd", primaryBrokerId: "emp-1" })).toBe(false));
  it("have full Vehicle Management except confirming others' bookings", () => {
    expect(can(employee, "create", { type: "cab" })).toBe(true);
    expect(can(employee, "view", { type: "cab" })).toBe(true);
    expect(can(employee, "delete", { type: "cab", bookedForId: "emp-1" })).toBe(true);
    expect(can(employee, "delete", { type: "cab", bookedForId: "other" })).toBe(false);
    expect(can(employee, "update", { type: "cab" })).toBe(false);
  });
  it("see only their own payroll", () => {
    expect(can(employee, "view", { type: "payroll", userId: "emp-1" })).toBe(true);
    expect(can(employee, "view", { type: "payroll", userId: "other" })).toBe(false);
    expect(can(employee, "manage", { type: "payroll" })).toBe(false);
  });
  it("only reach their own Employee Documents", () => {
    expect(can(employee, "view", { type: "vault", folder: "EMPLOYEE_DOCUMENTS", ownerUserId: "emp-1" })).toBe(true);
    expect(can(employee, "view", { type: "vault", folder: "EMPLOYEE_DOCUMENTS", ownerUserId: "other" })).toBe(false);
    expect(can(employee, "view", { type: "vault", folder: "PM_DOCUMENTS" })).toBe(false);
    expect(can(employee, "view", { type: "vault", folder: "CLIENT_DOCUMENTS" })).toBe(false);
  });
  it("have no finance, invoices, teams or settings", () => {
    expect(can(employee, "view", { type: "finance" })).toBe(false);
    expect(can(employee, "view", { type: "invoice" })).toBe(false);
    expect(can(employee, "view", { type: "team" })).toBe(false);
    expect(can(employee, "view", { type: "settings" })).toBe(false);
    expect(can(employee, "view", { type: "audit" })).toBe(false);
  });
  it("gain abilities when a permission is toggled on", () => {
    const promoted = { ...employee, perms: new Set<PermissionKey>(["finance.view", "bd.view_contacts"]) };
    expect(can(promoted, "view", { type: "finance" })).toBe(true);
    expect(can(promoted, "view_contacts", { type: "bd" })).toBe(true);
  });
});
