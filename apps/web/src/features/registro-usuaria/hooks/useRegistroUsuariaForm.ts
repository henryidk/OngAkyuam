import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form'
import {
  datosCasoSchema,
  hoyGT,
  registroUsuariaNuevaSchema,
  type RegistroUsuariaNuevaFormValues,
} from '@akyuam/shared'

// '' representa "sin seleccionar todavía" en los campos de catálogo (select/radio):
// no es un valor válido del enum, pero es el estado inicial correcto de un <select>/<input type="radio">
// sin marcar. El resolver de Zod se encarga de exigir un valor real al validar cada paso.
export const valoresIniciales = {
  datosUsuaria: {
    nombres: '',
    apellidos: '',
    dpi: '',
    telefono: '',
    direccion: '',
    fechaNacimiento: '',
    grupoEtnico: '',
    fueraDeAltaVerapaz: false,
    municipio: '',
    departamentoOtro: '',
    municipioOtro: '',
    ubicacionGeografica: '',
  },
  datosCaso: {
    fecha: hoyGT(),
    tipologiaDelito: [],
    tipoRegistro: '',
    datosAgresor: {
      nombres: '',
      apellidos: '',
      telefono: '',
      direccion: '',
    },
    ninos: [],
    areasReferidas: [],
  },
} as unknown as RegistroUsuariaNuevaFormValues

const resolverCasoNuevo: Resolver<RegistroUsuariaNuevaFormValues> = async (
  valores,
  contexto,
  opciones,
) => {
  const resultado = await zodResolver(datosCasoSchema)(valores.datosCaso, contexto, opciones)
  return {
    values: { ...valores, datosCaso: resultado.values },
    errors: Object.keys(resultado.errors).length > 0 ? { datosCaso: resultado.errors } : {},
  }
}

/**
 * `usuariaExistente` determina qué validar en el submit final: cuando la usuaria ya existe el
 * paso de identidad nunca se muestra, así que tampoco debe exigirse su validación (el resolver
 * completo bloquearía el submit con campos que el wizard jamás pidió).
 */
export function useRegistroUsuariaForm(usuariaExistente: boolean) {
  const form = useForm<RegistroUsuariaNuevaFormValues>({
    resolver: usuariaExistente ? resolverCasoNuevo : zodResolver(registroUsuariaNuevaSchema),
    defaultValues: valoresIniciales,
    mode: 'onBlur',
  })

  const ninosFieldArray = useFieldArray({ control: form.control, name: 'datosCaso.ninos' })
  const tipoRegistro = useWatch({ control: form.control, name: 'datosCaso.tipoRegistro' })

  // Si la usuaria pasa de "Interna" a "Externa" no se conservan niñas/niños ya
  // capturados: solo entran como población beneficiada cuando hay solicitud de albergue.
  useEffect(() => {
    if (tipoRegistro !== 'INTERNA' && ninosFieldArray.fields.length > 0) {
      ninosFieldArray.replace([])
    }
  }, [tipoRegistro, ninosFieldArray.fields.length, ninosFieldArray.replace])

  return { form, ninosFieldArray }
}
