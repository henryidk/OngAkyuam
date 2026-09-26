import { z } from "zod";

export const pingSchema = z.object({
  message: z.string().min(1),
});

export type Ping = z.infer<typeof pingSchema>;

export * from "./timezone.js";
export * from "./catalogos/registroUsuaria.js";
export * from "./catalogos/documentos.js";
export * from "./catalogos/juridico.js";
export * from "./catalogos/personal.js";
export * from "./catalogos/administracion.js";
export * from "./catalogos/psicologia.js";
export * from "./schemas/registroUsuaria.js";
export * from "./schemas/areas.js";
export * from "./schemas/documentos.js";
export * from "./schemas/juridico.js";
export * from "./schemas/personal.js";
export * from "./schemas/administracion.js";
export * from "./schemas/psicologia.js";
