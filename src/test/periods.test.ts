import { describe, expect, it } from "vitest";
import { COMPARISON_PERIODS, previousRange, trailingRange } from "@/lib/periods";
import { DEMO_ACCOUNTS, socialDemo } from "@/lib/social-demo";

describe("Rolling comparison periods", () => {
  for (const [id, days, from, prevFrom, prevTo] of [
    ["daily", 1, "2026-11-05", "2026-11-04", "2026-11-04"],
    ["weekly", 7, "2026-10-30", "2026-10-23", "2026-10-29"],
    ["monthly", 30, "2026-10-07", "2026-09-07", "2026-10-06"],
    ["quarterly", 90, "2026-08-08", "2026-05-10", "2026-08-07"],
    ["yearly", 365, "2025-11-06", "2024-11-06", "2025-11-05"],
  ] as const) {
    it(`${id} uses adjacent equal-length windows`, () => {
      const period = COMPARISON_PERIODS.find((p) => p.id === id);
      expect(period?.days).toBe(days);
      const range = trailingRange(days, new Date("2026-11-05T03:19:00Z"));
      expect(range).toEqual({ from, to: "2026-11-05" });
      expect(previousRange(range.from, range.to)).toEqual({ days, prevFrom, prevTo });
    });
  }
});
describe("Demo account aggregates", () => {
  it("All Accounts aggregates selected pages without double counting", () => {
    const all = socialDemo("2026-11-01", "2026-11-05");
    const individual = DEMO_ACCOUNTS.map((a) => socialDemo("2026-11-01", "2026-11-05", [a.id]));
    // Daily rounding is performed per aggregate; allow its bounded rounding difference.
    expect(Math.abs(all.impressions - individual.reduce((n, a) => n + a.impressions, 0))).toBeLessThan(12 * 5);
    expect(all.selected).toHaveLength(12);
    expect(socialDemo("2026-11-01", "2026-11-05", ["facebook-0"]).selected.map((a) => a.name)).toEqual(["Prakash Pumps Main"]);
  });
  it("country and channel filters constrain page analytics", () => {
    expect(socialDemo("2026-11-05", "2026-11-05", [], ["IN"], ["snapchat"]).selected.map((a) => a.id)).toEqual(["snapchat-2"]);
  });
  it("WhatsApp counts honor dates and use conversation-weighted response times", () => {
    const day = socialDemo("2026-11-05", "2026-11-05");
    expect(day.conversations).toBeGreaterThan(0);
    expect(day.inquiries).toBeLessThanOrEqual(day.conversations);
    expect(day.response).toBe(day.rows[0] ? day.rows[0].responseTotal / day.rows[0].conversations : -1);
    expect(socialDemo("2026-11-05", "2026-11-05", [], ["ZZ"]).conversations).toBe(0);
  });
});