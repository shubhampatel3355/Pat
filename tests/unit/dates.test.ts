import { describe, expect, it } from "vitest";
import { addDaysIso, financialYear, formatDate, formatDateTime, formatTime12, fyMonths, fyOfIso, fyQuarterOfIso, isoDateIST, relativeDayLabel, sameDayLastYear } from "@/lib/dates";

describe("financial year (April–March)", () => {
  it("starts in April", () => {
    expect(fyOfIso("2026-04-01").short).toBe("26-27");
    expect(fyOfIso("2026-03-31").short).toBe("25-26");
    expect(fyOfIso("2027-01-15").label).toBe("FY 2026–27");
  });
  it("has twelve months from April", () => {
    const months = fyMonths(financialYear(2026));
    expect(months[0]).toBe("2026-04");
    expect(months[11]).toBe("2027-03");
  });
  it("maps Indian FY quarters", () => {
    expect(fyQuarterOfIso("2026-10-22")).toMatchObject({ q: 3, key: "FY2026-27-Q3", start: "2026-10-01", end: "2026-12-31" });
    expect(fyQuarterOfIso("2027-02-01")).toMatchObject({ q: 4, start: "2027-01-01" });
    expect(fyQuarterOfIso("2026-05-01").q).toBe(1);
  });
});

describe("IST helpers", () => {
  it("uses Asia/Kolkata for 'today'", () => {
    // 20:00 UTC is already the next day in India.
    expect(isoDateIST(new Date("2026-10-22T20:00:00Z"))).toBe("2026-10-23");
  });
  it("formats dates and times like the prototype", () => {
    expect(formatDate("2026-10-28")).toBe("28 Oct 2026");
    expect(formatTime12("14:30")).toBe("2:30 pm");
    expect(formatTime12("00:05")).toBe("12:05 am");
  });
  it("labels relative days", () => {
    expect(relativeDayLabel("2026-10-22", "2026-10-22")).toBe("Today");
    expect(relativeDayLabel(addDaysIso("2026-10-22", 1), "2026-10-22")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-10-30", "2026-10-22")).toBe("30 Oct");
  });
});

describe("year-on-year dates", () => {
  it("steps back one year", () => expect(sameDayLastYear("2026-10-22")).toBe("2025-10-22"));
  it("maps 29 Feb to 28 Feb", () => expect(sameDayLastYear("2028-02-29")).toBe("2027-02-28"));
  it("stamps reports in IST", () => expect(formatDateTime(new Date("2026-10-22T11:18:00Z"))).toBe("22 Oct 2026, 4:48 pm"));
});
