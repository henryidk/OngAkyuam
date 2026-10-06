/** Guarda un archivo que ya está en memoria; el enlace temporal se libera enseguida. */
export function guardarArchivo(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
