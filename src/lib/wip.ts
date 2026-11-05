import type { PricingBasis } from "@/generated/prisma/enums";
import { formatCompactINR, groupIndian, PAISE_PER_RUPEE } from "./money";

/** Monthly rent from the pricing basis. Estimated brokerage fees = one month's rent. */
export function monthlyRentPaise(basis: PricingBasis, ratePaise: number, areaSqft: number | null, seats: number | null): number {
  if (basis === "PER_SQFT") return (areaSqft ?? 0) * ratePaise;
  if (basis === "PER_SEAT") return (seats ?? 0) * ratePaise;
  return ratePaise;
}

const FEE_MONTHS = 1;

export function estimatedFeesPaise(basis: PricingBasis, ratePaise: number, areaSqft: number | null, seats: number | null): number {
  return monthlyRentPaise(basis, ratePaise, areaSqft, seats) * FEE_MONTHS;
}

/** "₹ 92 / sq ft", "₹ 9,500 / seat", "Lumpsum". */
export function rateLabel(basis: PricingBasis, ratePaise: number): string {
  if (basis === "LUMPSUM") return "Lumpsum";
  const rupees = Math.floor(ratePaise / PAISE_PER_RUPEE);
  const paise = ratePaise % PAISE_PER_RUPEE;
  const amount = paise ? `${groupIndian(String(rupees))}.${String(paise).padStart(2, "0").replace(/0$/, "")}` : groupIndian(String(rupees));
  return `₹ ${amount} / ${basis === "PER_SQFT" ? "sq ft" : "seat"}`;
}

/** "₹ 11.5 L / month" or "₹ 5 L fixed". */
export function rentLine(basis: PricingBasis, monthlyPaise: number): string {
  return basis === "LUMPSUM" ? `${formatCompactINR(monthlyPaise)} fixed` : `${formatCompactINR(monthlyPaise)} / month`;
}

export function areaLabel(basis: PricingBasis, areaSqft: number | null, seats: number | null): string {
  if (basis === "PER_SQFT" && areaSqft) return `${groupIndian(String(areaSqft))} sq ft`;
  if (basis === "PER_SEAT" && seats) return `${groupIndian(String(seats))} seats`;
  return "—";
}
