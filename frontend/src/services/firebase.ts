// El init real se movio a lib/firebase.ts durante la refactor de capas.
// Dejamos este archivo como alias para no tocar los ~10 imports que ya apuntan
// a services/firebase. Codigo nuevo: importar desde lib/firebase.
export * from '../lib/firebase';
