import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { hoyGT, registroUsuariaSchema, type RegistroUsuariaFormValues } from '@akyuam/shared'

// '' representa "sin seleccionar todavía" en los campos de catálogo (select/radio):
// no es un valor válido del enum, pero es el estado inicial correcto de un <select>/<input type="radio">
// sin marcar. El resolver de Zod se encarga de exigir un valor real al validar cada paso.
export const valoresIniciales = {
  datosCaso: {
    fecha: hoyGT(),
    fueraDeAltaVerapaz: false,
    municipio: '',
    departamentoOtro: '',
    municipioOtro: '',
    ubicacionGeografica: '',
  },
  datosUsuaria: {
    nombres: '',
    apellidos: '',
    dpi: '',
    telefono: '',
    direccion: '',
    fechaNacimiento: '',
    grupoEtnico: '',
    tipologiaDelito: [],
  },
  datosAgresor: {
    nombres: '',
    apellidos: '',
    telefono: '',
    direccion: '',
  },
  tipoRegistro: '',
  ninos: [],
  areasReferidas: [],
} as unknown as RegistroUsuariaFormValues

export function useRegistroUsuariaForm() {
  const form = useForm<RegistroUsuariaFormValues>({
    resolver: zodResolver(registroUsuariaSchema),
    defaultValues: valoresIniciales,
    mode: 'onBlur',
  })

  const ninosFieldArray = useFieldArray({ control: form.control, name: 'ninos' })
  const tipoRegistro = useWatch({ control: form.control, name: 'tipoRegistro' })

  // Si la usuaria pasa de "Interna" a "Externa" no se conservan niñas/niños ya
  // capturados: solo entran como población beneficiada cuando hay solicitud de albergue.
  useEffect(() => {
    if (tipoRegistro !== 'INTERNA' && ninosFieldArray.fields.length > 0) {
      ninosFieldArray.replace([])
    }
  }, [tipoRegistro, ninosFieldArray.fields.length, ninosFieldArray.replace])

  return { form, ninosFieldArray }
}
