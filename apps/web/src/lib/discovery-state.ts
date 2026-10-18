import { z } from 'zod';

// History owns presentation state; it never changes the shareable filter contract.
export const disclosureSchema = z.object({
  panel: z.boolean(),
  details: z.array(z.enum(['advanced', 'languages', 'countries', 'exclude'])).max(4),
}).strict();
