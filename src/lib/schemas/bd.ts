import { z } from "../zod";
import { isoDate, optionalEmail, optionalPhone, requiredText, text } from "./common";

const meetingFields = {
  primaryBrokerId: z.uuid(),
  secondaryBrokerId: z.uuid().nullable(),
  meetingDate: isoDate,
  tenantName: requiredText(160, "Enter the tenant name"),
  contactName: requiredText(120, "Enter the contact name"),
  designation: text(120),
  meetingType: z.enum(["INTRODUCTION", "REQUIREMENT", "SITE_TOUR", "PROPOSAL", "FOLLOW_UP"]),
  mode: z.enum(["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"]),
  temperature: z.enum(["COLD", "LUKEWARM", "WARM", "HOT"]),
  comments: text(2000),
};

/**
 * Client contact info is write-only for people who can't see it: `undefined` keeps what is stored,
 * a value replaces it (and "" clears it, for people who can see it).
 */
const contactFields = {
  phone: optionalPhone.optional(),
  email: optionalEmail.optional(),
};

const distinctBrokers = (v: { primaryBrokerId: string; secondaryBrokerId: string | null }) => v.primaryBrokerId !== v.secondaryBrokerId;
const distinctMessage = { message: "Pick a different secondary broker", path: ["secondaryBrokerId"] };

export const bdMeetingInputSchema = z.object({ ...meetingFields, ...contactFields }).refine(distinctBrokers, distinctMessage);

export const bdMeetingUpdateSchema = z.object({ id: z.uuid(), ...meetingFields, ...contactFields }).refine(distinctBrokers, distinctMessage);

export const bdTemperatureSchema = z.object({ id: z.uuid(), temperature: meetingFields.temperature });

export const bdCommentSchema = z.object({ id: z.uuid(), comments: text(2000) });

export type BdMeetingInput = z.input<typeof bdMeetingInputSchema>;
