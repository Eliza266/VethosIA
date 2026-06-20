import { describe, it, expect } from 'vitest';
import { filtrarComandos, COMANDOS_BASE, type Comando } from './commands';

const cmds: Comando[] = [
  { id: '1', titulo: 'Nuevo paciente', keywords: ['crear', 'mascota'] },
  { id: '2', titulo: 'Ver agenda', keywords: ['citas'] },
];

describe('filtrarComandos', () => {
  it('sin consulta devuelve todos', () => {
    expect(filtrarComandos(cmds, '')).toHaveLength(2);
  });
  it('matchea por titulo (case/acentos-insensible)', () => {
    expect(filtrarComandos(cmds, 'PACIENTE').map((c) => c.id)).toEqual(['1']);
  });
  it('matchea por keyword', () => {
    expect(filtrarComandos(cmds, 'citas').map((c) => c.id)).toEqual(['2']);
  });
  it('AND de palabras', () => {
    expect(filtrarComandos(cmds, 'nuevo mascota').map((c) => c.id)).toEqual(['1']);
    expect(filtrarComandos(cmds, 'nuevo zzz')).toHaveLength(0);
  });
  it('COMANDOS_BASE incluye acciones clave', () => {
    expect(COMANDOS_BASE.find((c) => c.id === 'nuevo-paciente')).toBeTruthy();
  });
});
