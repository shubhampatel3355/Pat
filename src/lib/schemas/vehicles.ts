import { z } from "../zod";
import { hhmm, isoDate, requiredText, text } from "./common";

export const cabBookingInputSchema = z.object({
  carType: z.enum(["SEDAN", "SUV"]),
  clientName: requiredText(120, "Enter the client name"),
  pickupDate: isoDate,
  pickupTime: hhmm,
  pickupLocation: text(200).pipe(z.string().min(3, "Enter the pick-up location")),
  bookedForId: z.uuid(),
});

export const cabStatusInputSchema = z.object({
  id: z.uuid(),
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]),
});
