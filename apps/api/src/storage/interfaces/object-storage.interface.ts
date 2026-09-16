export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface IObjectStorage {
  subirObjeto(
    clave: string,
    contenido: Buffer,
    mimeType: string,
  ): Promise<void>;
  eliminarObjeto(clave: string): Promise<void>;
}
