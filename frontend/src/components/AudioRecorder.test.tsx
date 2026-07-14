import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AudioRecorder from './AudioRecorder';

// Fake minimo de MediaRecorder: alcanza para simular start/stop sin producir audio real.
class FakeMediaRecorder {
  static isTypeSupported = () => true;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {}
  stop() {
    this.onstop?.();
  }
}

describe('AudioRecorder - Wake Lock', () => {
  const mockGetUserMedia = vi.fn();
  const mockWakeLockRequest = vi.fn();
  const mockRelease = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream);
    mockRelease.mockResolvedValue(undefined);
    mockWakeLockRequest.mockResolvedValue({ release: mockRelease });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: mockGetUserMedia },
    });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: mockWakeLockRequest },
    });
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  });

  it('pide wake lock de pantalla al iniciar grabación (evita perder audio si el celular bloquea)', async () => {
    render(<AudioRecorder onAudioRecorded={vi.fn()} />);

    fireEvent.click(screen.getByTitle(/iniciar grabaci[oó]n/i));

    await screen.findByText(/grabando bloque/i);
    expect(mockWakeLockRequest).toHaveBeenCalledWith('screen');
  });

  it('libera el wake lock al detener la grabación', async () => {
    render(<AudioRecorder onAudioRecorded={vi.fn()} />);

    fireEvent.click(screen.getByTitle(/iniciar grabaci[oó]n/i));
    await screen.findByText(/grabando bloque/i);

    fireEvent.click(screen.getByTitle(/detener grabaci[oó]n/i));

    await screen.findByText(/bloque 1 grabado/i);
    expect(mockRelease).toHaveBeenCalled();
  });

  it('sigue grabando aunque el navegador no soporte Wake Lock', async () => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
    render(<AudioRecorder onAudioRecorded={vi.fn()} />);

    fireEvent.click(screen.getByTitle(/iniciar grabaci[oó]n/i));

    expect(await screen.findByText(/grabando bloque/i)).toBeInTheDocument();
  });
});
