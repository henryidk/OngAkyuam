/** Estilos que comparten las piezas de la agenda, para que filas y colas se lean como un mismo sistema. */

/** Columna de la hora: mismo ancho en citas y en tramos libres, para que queden alineadas. */
export const CLASE_COLUMNA_HORA = 'w-[52px] flex-none font-mono'

const BASE_BOTON = 'whitespace-nowrap rounded-md font-semibold'
const BOTON_FILA = `${BASE_BOTON} px-3 py-[7px] text-[13px]`
const BOTON_COLA = `${BASE_BOTON} px-2.5 py-1.5 text-[12.5px]`

const RELLENO = 'bg-brand-600 text-white hover:bg-brand-700'
const BORDE = 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
const BORDE_MARCA = 'border border-gray-300 bg-white text-brand-700 hover:bg-brand-50'
const BORDE_AMBAR = 'border border-amber-500 bg-white text-amber-800 hover:bg-amber-50'

/** Botones de una cita en la lista del día. Relleno solo hay uno: el de la cita que toca. */
export const BOTON_FILA_RELLENO = `${BOTON_FILA} ${RELLENO}`
export const BOTON_FILA_BORDE = `${BOTON_FILA} ${BORDE}`
export const BOTON_FILA_AMBAR = `${BOTON_FILA} ${BORDE_AMBAR}`

/** Botones de las colas de la derecha: un punto más chicos que los de la lista. */
export const BOTON_COLA_RELLENO = `${BOTON_COLA} ${RELLENO}`
export const BOTON_COLA_BORDE = `${BOTON_COLA} ${BORDE}`
export const BOTON_COLA_MARCA = `${BOTON_COLA} ${BORDE_MARCA}`
export const BOTON_COLA_AMBAR = `${BOTON_COLA} ${BORDE_AMBAR}`

/** Acción de segundo orden: texto subrayado, sin caja. */
export const ENLACE_FILA = 'whitespace-nowrap px-1 py-[7px] text-[13px] underline underline-offset-2'
