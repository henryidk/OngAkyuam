export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface IObjectStorage {
  subirObjeto(
    clave: string,
    contenido: Buffer,
    mimeType: string,
  ): Promise<void>;
  eliminarObjeto(clave: string): Promise<void>;
  /**
   * URL firmada de corta duración para descargar un objeto — nunca se sirve un archivo por
   * URL pública directa. Siempre fuerza descarga (`Content-Disposition: attachment`) en vez
   * de renderizado inline, para que un archivo subido con mimeType falseado (ej. SVG/HTML)
   * nunca se ejecute en el navegador de quien lo descarga.
   */
  generarUrlDescarga(clave: string, nombreDescarga?: string): Promise<string>;
}
