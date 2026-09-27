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
  /**
   * URL firmada para mostrar el archivo dentro de la app (vista previa del drawer). Fuerza
   * `Content-Type` al MIME registrado al subir — el caller solo debe pedirla para MIME de la
   * lista blanca (PDF/imágenes), nunca para algo que el navegador pueda ejecutar.
   */
  generarUrlVistaPrevia(clave: string, mimeType: string): Promise<string>;
}
