// Paleta fija de marca Vethos para graficos (recharts). A diferencia de var(--accent),
// estos colores no cambian entre tema claro/oscuro: una serie de datos debe verse igual
// sin importar el tema, o el usuario pierde la referencia visual entre sesiones.
export const NAVY = '#072040';
export const CYAN = '#07c7f2';
export const LIME = '#9ccf3f';
export const AMBER = '#ffb703';
export const ORANGE = '#ea580c';
export const RED = '#ef4444';
export const PURPLE = '#7c3aed';
export const TEAL = '#0d9488';

// 8 colores distintos: distribucionEspecies puede traer hasta 12 especies (backend),
// pero en la practica una clinica rara vez maneja mas de 6-8 especies distintas a la vez.
export const ESPECIES_COLORS = [NAVY, CYAN, LIME, AMBER, PURPLE, ORANGE, TEAL, RED];
export const VACUNAS_COLORS = [LIME, CYAN, RED];
export const AGENDA_COLORS = [CYAN, LIME, AMBER, ORANGE];
export const BRIGADAS_COLORS = [NAVY, LIME, CYAN];
