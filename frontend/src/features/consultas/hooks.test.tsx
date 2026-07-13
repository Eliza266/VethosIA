import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../lib/firebase', () => ({ storage: {} }));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn().mockResolvedValue({ ref: {} }),
  getDownloadURL: vi.fn().mockResolvedValue('http://audio/url.webm'),
}));
vi.mock('../auth/hooks', () => ({ useAuth: () => ({ user: { uid: 'u1', nombre: 'Vet' } }) }));

vi.mock('./data', () => ({
  actualizarConsultaDoc: vi.fn().mockResolvedValue(undefined),
  aprobarConsultaDoc: vi.fn().mockResolvedValue({ estado: 'aprobada' }),
  listarConsultasPorPaciente: vi.fn().mockResolvedValue([]),
  listarTodasConsultas: vi.fn().mockResolvedValue([]),
  obtenerConsulta: vi.fn(),
  crearConsultaDoc: vi.fn(),
  eliminarConsultaDoc: vi.fn(),
}));

let mockUseApiIa = false;
vi.mock('../../lib/featureFlags', () => ({
  getFeatureFlags: () => ({
    useApiIA: mockUseApiIa,
    useApiDocs: false,
    useApiCRUD: false,
    emailRealEnabled: false,
  }),
}));

vi.mock('./api', () => ({
  generarNumeroHC: vi.fn().mockResolvedValue('HC1'),
  transcribirAudio: vi.fn().mockResolvedValue('el perro tiene fiebre'),
  generarSOAP: vi.fn().mockResolvedValue({
    motivo: 'fiebre',
    prioridad: 'rutina',
    signosVitales: { peso: 10, talla: 30 },
    subjetivo: 's',
    objetivo: 'o',
    analisis: 'a',
    plan: 'p',
    diagnosticoEstructurado: [
      {
        id: 'd1',
        nombre: 'Fiebre',
        tipo: 'principal',
        estado: 'presuntivo',
        origen: 'ia',
        creadoEn: '2026-06-18T00:00:00.000Z',
      },
    ],
    medicamentosSugeridos: [],
    generadoPorIA: true,
  }),
  procesarConsultaConIA: vi.fn().mockResolvedValue({ estado: 'procesando' }),
}));

import { useConsultas } from './hooks';
import { actualizarConsultaDoc, aprobarConsultaDoc } from './data';
import { transcribirAudio, generarSOAP, procesarConsultaConIA } from './api';

const estadosEnviados = () =>
  (actualizarConsultaDoc as unknown as ReturnType<typeof vi.fn>).mock.calls
    .map((c: unknown[]) => (c[1] as { estado?: string }).estado)
    .filter(Boolean);

describe('useConsultas.procesarAudioConsulta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sigue la secuencia procesando -> borrador y llama transcribir + SOAP', async () => {
    const { result } = renderHook(() => useConsultas());
    const blobs = [new Blob(['x'], { type: 'audio/webm' })];
    const onProgress = vi.fn();

    let ok = false;
    await act(async () => {
      ok = await result.current.procesarAudioConsulta('c1', blobs, onProgress);
    });

    expect(ok).toBe(true);
    expect(transcribirAudio).toHaveBeenCalledTimes(1);
    expect(generarSOAP).toHaveBeenCalledWith('el perro tiene fiebre');

    const estados = estadosEnviados();
    expect(estados[0]).toBe('procesando');
    expect(estados[estados.length - 1]).toBe('borrador');
    // progreso reportado de principio a fin
    expect(onProgress).toHaveBeenCalledWith(expect.any(String), 100);
  });

  it('persiste audioUrls con todos los bloques grabados (reproductor multi-bloque)', async () => {
    const { result } = renderHook(() => useConsultas());
    const blobs = [
      new Blob(['a'], { type: 'audio/webm' }),
      new Blob(['b'], { type: 'audio/webm' }),
      new Blob(['c'], { type: 'audio/webm' }),
    ];
    await act(async () => {
      await result.current.procesarAudioConsulta('c1', blobs);
    });
    const llamadaAudio = (actualizarConsultaDoc as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[1] as { audioUrl?: string; audioUrls?: string[] })
      .find((campos) => campos.audioUrls);
    expect(llamadaAudio?.audioUrls).toHaveLength(3);
    expect(llamadaAudio?.audioUrl).toBe(llamadaAudio?.audioUrls?.[0]);
  });

  it('persiste el flag generadoPorIA en el SOAP guardado', async () => {
    const { result } = renderHook(() => useConsultas());
    const blobs = [new Blob(['x'], { type: 'audio/webm' })];
    await act(async () => {
      await result.current.procesarAudioConsulta('c1', blobs);
    });
    const llamadaConSoap = (actualizarConsultaDoc as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[1] as { soap?: { generadoPorIA?: boolean } })
      .find((campos) => campos.soap);
    expect(llamadaConSoap?.soap?.generadoPorIA).toBe(true);
  });

  it('persiste diagnostico estructurado IA a nivel de consulta', async () => {
    const { result } = renderHook(() => useConsultas());
    const blobs = [new Blob(['x'], { type: 'audio/webm' })];
    await act(async () => {
      await result.current.procesarAudioConsulta('c1', blobs);
    });
    const llamada = (actualizarConsultaDoc as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[1] as { diagnosticoEstructurado?: unknown[] })
      .find((campos) => campos.diagnosticoEstructurado);
    expect(llamada?.diagnosticoEstructurado).toEqual([
      expect.objectContaining({ nombre: 'Fiebre', origen: 'ia' }),
    ]);
  });

  it('con useApiIA activo encola procesamiento asincrono y retorna true', async () => {
    mockUseApiIa = true;
    const { result } = renderHook(() => useConsultas());
    const blobs = [new Blob(['x'], { type: 'audio/webm' })];
    const onProgress = vi.fn();

    let ok = false;
    await act(async () => {
      ok = await result.current.procesarAudioConsulta('c1', blobs, onProgress);
    });

    expect(ok).toBe(true);
    expect(procesarConsultaConIA).toHaveBeenCalledWith('c1', ['audios/u1/c1-0.webm'], 'audio/webm');
    expect(transcribirAudio).not.toHaveBeenCalled();
    expect(generarSOAP).not.toHaveBeenCalled();
    
    // cleanup
    mockUseApiIa = false;
  });

  it('si la transcripcion falla -> estado error y retorna false', async () => {
    (transcribirAudio as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('gemini caido')
    );
    const { result } = renderHook(() => useConsultas());
    const blobs = [new Blob(['x'], { type: 'audio/webm' })];

    let ok = true;
    await act(async () => {
      ok = await result.current.procesarAudioConsulta('c1', blobs);
    });

    expect(ok).toBe(false);
    expect(estadosEnviados()).toContain('error');
    expect(generarSOAP).not.toHaveBeenCalled();
  });
});

describe('useConsultas.aprobarConsulta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delega en aprobarConsultaDoc y no usa actualizarConsultaDoc', async () => {
    const { result } = renderHook(() => useConsultas());
    let ok = false;
    await act(async () => {
      ok = await result.current.aprobarConsulta('c1');
    });
    expect(ok).toBe(true);
    expect(aprobarConsultaDoc).toHaveBeenCalledWith('c1');
    expect(actualizarConsultaDoc).not.toHaveBeenCalled();
  });
});
