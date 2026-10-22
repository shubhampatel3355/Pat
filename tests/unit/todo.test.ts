import { describe, expect, it } from "vitest";
import { bucketToDate, dateToBucket, whenLabel } from "@/lib/todo";

// 2026-10-22 is a Thursday.
const THU = "2026-10-22";

describe("to-do due buckets (weeks run Monday–Sunday)", () => {
  it("maps buckets to dates", () => {
    expect(bucketToDate("TODAY", THU)).toBe("2026-10-22");
    expect(bucketToDate("TOMORROW", THU)).toBe("2026-10-23");
    expect(bucketToDate("THIS_WEEK", THU)).toBe("2026-10-24"); // Saturday
    expect(bucketToDate("NEXT_WEEK", THU)).toBe("2026-10-26"); // next Monday
    expect(bucketToDate("NONE", THU)).toBeNull();
  });
  it("this week on a weekend is today", () => expect(bucketToDate("THIS_WEEK", "2026-10-25")).toBe("2026-10-25"));
  it("maps dates back to buckets", () => {
    expect(dateToBucket("2026-10-22", THU)).toBe("TODAY");
    expect(dateToBucket("2026-10-23", THU)).toBe("TOMORROW");
    expect(dateToBucket("2026-10-25", THU)).toBe("THIS_WEEK");
    expect(dateToBucket("2026-10-26", THU)).toBe("NEXT_WEEK");
    expect(dateToBucket("2026-11-01", THU)).toBe("NEXT_WEEK");
    expect(dateToBucket("2026-11-02", THU)).toBeNull();
    expect(dateToBucket("2026-10-20", THU)).toBeNull();
    expect(dateToBucket(null, THU)).toBe("NONE");
  });
  it("labels like Microsoft To Do", () => {
    expect(whenLabel("2026-10-22", "09:30", THU)).toBe("Today · 9:30 am");
    expect(whenLabel("2026-10-20", null, THU)).toBe("Overdue · 20 Oct");
    expect(whenLabel(null, null, THU)).toBe("No due date");
  });
});
