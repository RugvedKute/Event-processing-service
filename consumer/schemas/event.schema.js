import { z } from "zod";

export const EventSchema = z.object({
  eventId: z.string().min(1),
  timestamp: z.number(),
  type: z.string(),
  payload: z.unknown(),
});

