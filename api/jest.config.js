// Tres "projects" de Jest para separar lo que corre en cada contexto:
//  - unit:        logica de dominio pura, sin red ni emulador. Corre en cualquier lado.
//  - integration: golpea Firestore via el emulador (necesita emuladores arriba).
//  - rules:       tests de firestore.rules con @firebase/rules-unit-testing (necesita emulador firestore).
//
// Usamos transform explicito con ts-jest (en vez de preset) para evitar problemas de
// resolucion del preset en algunos entornos Windows.
const tsTransform = {
  '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
};

const base = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: tsTransform,
};

module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    { ...base, displayName: 'integration', testMatch: ['<rootDir>/test/integration/**/*.spec.ts'] },
    { ...base, displayName: 'rules', testMatch: ['<rootDir>/test/rules/**/*.spec.ts'] },
  ],
};
