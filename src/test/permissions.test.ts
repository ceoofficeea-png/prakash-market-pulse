import { describe, expect, it } from "vitest";

import { can, primaryRole } from "@/lib/permissions";

describe("role permissions", () => {
  it("only admins can open Administration and change roles", () => {
    expect(can(["admin"], "admin.access")).toBe(true);
    expect(can(["manager"], "admin.access")).toBe(false);
    expect(can(["analyst"], "roles.edit")).toBe(false);
    expect(can(["viewer"], "connections.edit")).toBe(false);
  });

  it("managers plan campaigns; analysts cannot", () => {
    expect(can(["manager"], "campaigns.edit")).toBe(true);
    expect(can(["analyst"], "campaigns.edit")).toBe(false);
  });

  it("analysts can work leads and content", () => {
    expect(can(["analyst"], "leads.edit")).toBe(true);
    expect(can(["analyst"], "content.edit")).toBe(true);
  });

  it("viewers are read-only", () => {
    expect(can(["viewer"], "leads.edit")).toBe(false);
    expect(can(["viewer"], "content.edit")).toBe(false);
    expect(can([], "leads.edit")).toBe(false);
  });

  it("primary role is the highest one held, defaulting to viewer", () => {
    expect(primaryRole(["viewer", "manager"])).toBe("manager");
    expect(primaryRole([])).toBe("viewer");
  });
});
