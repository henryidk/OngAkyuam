import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch, type FieldErrors, type Resolver, type ResolverOptions } from 'react-hook-form'
import {
  datosCasoSchema,
  hoyGT,
  registroUsuariaNuevaSchema,
  type DatosCaso,
  type NuevoCasoFormValues,
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
    fechaIngresoAlbergue: '',
    datosAgresor: {
      nombres: '',
      apellidos: '',
      telefono: '',
      direccion: '',
    },
    observaciones: '',
    ninos: [],
  },
} as unknown as RegistroUsuariaNuevaFormValues

// `datosCasoSchema` solo conoce la forma de `datosCaso`, no la del formulario completo
// (`datosUsuaria` + `datosCaso`) — el cast de `opciones` es necesario porque RHF tipa
// `ResolverOptions` por el formulario que lo invoca, no por el que valida internamente.
const resolverCasoNuevo: Resolver<RegistroUsuariaNuevaFormValues> = async (
  valores,
  contexto,
  opciones,
) => {
  const resultado = await zodResolver(datosCasoSchema)(
    valores.datosCaso,
    contexto,
    opciones as unknown as ResolverOptions<NuevoCasoFormValues>,
  )
  if (Object.keys(resultado.errors).length > 0) {
    return {
      values: {},
      errors: { datosCaso: resultado.errors } as FieldErrors<RegistroUsuariaNuevaFormValues>,
    }
  }
  return {
    values: { ...valores, datosCaso: resultado.values as DatosCaso },
    errors: {},
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

  // La fecha de ingreso solo existe en casos Interna; por defecto coincide con la fecha del
  // registro (lo habitual), pero se puede corregir si ingresó otro día.
  const { getValues, setValue } = form
  useEffect(() => {
    const fechaIngreso = getValues('datosCaso.fechaIngresoAlbergue')
    if (tipoRegistro === 'INTERNA' && fechaIngreso === '') {
      setValue('datosCaso.fechaIngresoAlbergue', getValues('datosCaso.fecha'))
    } else if (tipoRegistro !== 'INTERNA' && fechaIngreso !== '') {
      setValue('datosCaso.fechaIngresoAlbergue', '')
    }
  }, [tipoRegistro, getValues, setValue])

  return { form, ninosFieldArray }
}
