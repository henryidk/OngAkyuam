import { z } from "zod";

export const pingSchema = z.object({
  message: z.string().min(1),
});

export type Ping = z.infer<typeof pingSchema>;

export * from "./timezone.js";
export * from "./catalogos/registroUsuaria.js";
export * from "./catalogos/documentos.js";
export * from "./schemas/registroUsuaria.js";
export * from "./schemas/areas.js";
export * from "./schemas/documentos.js";
