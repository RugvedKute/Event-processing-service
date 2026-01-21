import { z } from "zod";

export const EventSchema = z.object({
  eventId: z.string().min(1),
  timestamp: z.number().int().positive(),
  type: z.string().min(1),
  payload: z.object(),
});
