import type { Consulta, Paciente } from '../../types';

// Armado de links/mensajes para compartir la HC. Extraido del god component.
// Lo importante aca: el codigo de pais de WhatsApp ya NO esta hardcodeado a '57'.

const DEFAULT_COUNTRY_CODE = '57'; // Colombia, valor por defecto historico

/**
 * Resuelve el codigo de pais con esta prioridad:
 *   1) el del propietario (si lo cargaron)
 *   2) VITE_WHATSAPP_COUNTRY_CODE (config global de la instancia)
 *   3) '57' (Colombia) como ultimo recurso
 */
export const resolverCodigoPais = (codigoPropietario?: string): string => {
  if (codigoPropietario && codigoPropietario.trim()) return codigoPropietario.replace(/\D/g, '');
  const envCode = import.meta.env.VITE_WHATSAPP_COUNTRY_CODE;
  if (envCode && envCode.trim()) return envCode.replace(/\D/g, '');
  return DEFAULT_COUNTRY_CODE;
};

/**
 * Normaliza el telefono y le antepone el codigo de pais. Si el numero ya parece
 * traer el codigo (empieza por '+'), respetamos eso y solo dejamos digitos.
 */
export const construirNumeroWhatsApp = (telefono: string, codigoPropietario?: string): string => {
  const trimmed = telefono.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\D/g, '');
  const soloDigitos = trimmed.replace(/\D/g, '');
  const codigo = resolverCodigoPais(codigoPropietario);
  // si el numero ya arranca con el codigo, no lo duplicamos
  if (soloDigitos.startsWith(codigo)) return soloDigitos;
  return `${codigo}${soloDigitos}`;
};

/** Mensaje que acompaña el link de la HC. */
export const construirMensajeHistoria = (
  nombrePropietario: string,
  nombrePaciente: string,
  fecha: Date,
  urlPdf: string
): string =>
  `Hola ${nombrePropietario}, adjunto encontrará la historia clínica de ${nombrePaciente} ` +
  `generada el ${new Date(fecha).toLocaleDateString('es-CO')}. Puede descargarla aquí: ${urlPdf}`;

/** URL wa.me lista para abrir. Pura -> facil de testear. */
export const construirUrlWhatsApp = (params: {
  paciente: Paciente;
  consulta: Consulta;
  urlPdf: string;
}): string => {
  const { paciente, consulta, urlPdf } = params;
  const telefono = paciente.propietario.whatsapp || paciente.propietario.telefono;
  const numero = construirNumeroWhatsApp(telefono, paciente.propietario.codigoPais);
  const mensaje = construirMensajeHistoria(
    paciente.propietario.nombre,
    paciente.nombre,
    consulta.fechaHora,
    urlPdf
  );
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
};
