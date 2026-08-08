import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, RefreshCw, FileText, CheckCircle, Trash2 } from 'lucide-react';
import { pickSupportedAudioMime } from '../lib/audioMime';
import { getErrorMessage } from '../lib/errors';

interface AudioRecorderProps {
  onAudioRecorded: (blobs: Blob[]) => void;
  isProcessing?: boolean;
  onManualFallback?: () => void;
}

const BLOQUE_MAX_MS = 20 * 60 * 1000;
const BLOQUE_AVISO_MS = 17 * 60 * 1000;

// Editable sin tocar el resto del componente: texto que el vet debe leerle al
// propietario al iniciar la grabacion (consentimiento de tratamiento de datos).
const TEXTO_CONSENTIMIENTO =
  'Antes de continuar, informa al propietario: "Esta consulta se graba y la información se ' +
  'procesa con inteligencia artificial para generar la historia clínica; al continuar aceptas ' +
  'el tratamiento de tus datos según nuestra política de privacidad."';

/** Beep corto generado por el navegador (sin archivos de audio ni internet). */
const reproducirAvisoSonoro = (): void => {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Si el navegador no soporta audio, el aviso visual ya esta en pantalla.
  }
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioRecorded,
  isProcessing = false,
  onManualFallback,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [segments, setSegments] = useState<Blob[]>([]);
  const [segmentDurations, setSegmentDurations] = useState<number[]>([]);
  const [isBlockClosed, setIsBlockClosed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  // Visualizador de ondas en vivo: analiza el nivel de audio del microfono con
  // Web Audio API (no toca el audio grabado, solo lo escucha para dibujar).
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ondaRafRef = useRef<number | null>(null);
  // Si el celular bloquea pantalla a mitad de una grabacion, el navegador puede suspender o
  // matar la pestana y se pierde todo el audio en memoria (no se persiste hasta "Finalizar").
  // El Wake Lock evita que la pantalla se bloquee sola por inactividad mientras se graba.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Espejo de `seconds` en un ref: onstop es un closure y `seconds` quedaria viejo;
  // leemos secondsRef.current para registrar la duracion REAL del bloque al cerrarlo.
  const secondsRef = useRef(0);

  const maxSeconds = BLOQUE_MAX_MS / 1000;
  const avisoSeconds = BLOQUE_AVISO_MS / 1000;

  const startTimer = () => {
    setSeconds(0);
    secondsRef.current = 0;
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        secondsRef.current = next;
        return next;
      });
    }, 1000);
  };

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const detenerVisualizador = useCallback(() => {
    if (ondaRafRef.current !== null) {
      cancelAnimationFrame(ondaRafRef.current);
      ondaRafRef.current = null;
    }
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx) void ctx.close().catch(() => {});
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext('2d');
    if (canvas && ctx2d) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const iniciarVisualizador = useCallback((stream: MediaStream) => {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const styles = getComputedStyle(document.documentElement);
      const colorAccent = styles.getPropertyValue('--accent').trim() || '#3358f4';
      const colorCyan = styles.getPropertyValue('--clinical-cyan').trim() || '#07c7f2';

      const dibujar = () => {
        const canvas = canvasRef.current;
        const ctx2d = canvas?.getContext('2d');
        if (!canvas || !ctx2d) {
          ondaRafRef.current = requestAnimationFrame(dibujar);
          return;
        }
        analyser.getByteFrequencyData(data);
        const { width, height } = canvas;
        ctx2d.clearRect(0, 0, width, height);
        const barCount = data.length;
        const gap = 3;
        const barWidth = (width - gap * (barCount - 1)) / barCount;
        for (let i = 0; i < barCount; i += 1) {
          const nivel = data[i] / 255;
          const barHeight = Math.max(3, nivel * height);
          const x = i * (barWidth + gap);
          const y = (height - barHeight) / 2;
          ctx2d.fillStyle = i < barCount / 2 ? colorAccent : colorCyan;
          ctx2d.beginPath();
          ctx2d.roundRect(x, y, barWidth, barHeight, barWidth / 2);
          ctx2d.fill();
        }
        ondaRafRef.current = requestAnimationFrame(dibujar);
      };
      ondaRafRef.current = requestAnimationFrame(dibujar);
    } catch {
      // Sin visualizador el navegador sigue grabando igual; es solo decorativo.
    }
  }, []);

  const solicitarWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Best-effort: si el navegador lo rechaza (pestana no visible, sin soporte, etc.)
      // seguimos grabando igual; el aviso en pantalla ya pide no bloquear el celular.
    }
  }, []);

  const liberarWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // no-op
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  // Si el SO libera el wake lock solo (p. ej. al pasar la app a segundo plano y volver),
  // lo volvemos a pedir mientras siga grabando activa.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (isRecording && document.visibilityState === 'visible' && !wakeLockRef.current) {
        void solicitarWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isRecording, solicitarWakeLock]);

  useEffect(() => {
    return () => {
      stopTimer();
      void liberarWakeLock();
      detenerVisualizador();
    };
  }, [stopTimer, liberarWakeLock, detenerVisualizador]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setError(null);
    setIsBlockClosed(false);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta la grabación de audio.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });

      const mimeType = pickSupportedAudioMime();
      const VOICE_BITRATE = 32_000;
      const options: MediaRecorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: VOICE_BITRATE }
        : { audioBitsPerSecond: VOICE_BITRATE };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        setSegments((prev) => [...prev, audioBlob]);
        setSegmentDurations((prev) => [...prev, secondsRef.current]);
        setIsBlockClosed(true);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      startTimer();
      void solicitarWakeLock();
      iniciarVisualizador(stream);
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      onManualFallback?.();
      setError(getErrorMessage(err, 'No se pudo acceder al micrófono. Por favor otorga los permisos necesarios.'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
      void liberarWakeLock();
      detenerVisualizador();
    }
  };

  // Auto cut off block when max seconds is reached
  useEffect(() => {
    if (isRecording && seconds >= maxSeconds) {
      stopRecording();
    }
  }, [seconds, isRecording, maxSeconds]);

  // Beep cuando entra el aviso de "faltan 3 min" (dispara una sola vez al cruzar el umbral).
  useEffect(() => {
    if (isRecording && seconds === avisoSeconds) {
      reproducirAvisoSonoro();
    }
  }, [seconds, isRecording, avisoSeconds]);

  const handleFinish = () => {
    if (segments.length > 0) {
      onAudioRecorded(segments);
    }
  };

  // Borra un bloque ya grabado (por si quedó mal). Si no quedan bloques, vuelve al
  // estado inicial para poder empezar de nuevo.
  const eliminarBloque = (index: number) => {
    setSegments((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setIsBlockClosed(false);
      return next;
    });
    setSegmentDurations((prev) => prev.filter((_, i) => i !== index));
  };

  const currentBlockNum = segments.length + (isRecording ? 1 : 0);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 rounded-2xl shadow-sm max-w-md mx-auto w-full">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Grabar Consulta</h3>
      <p className="text-sm text-slate-500 text-center mb-6">
        Graba el audio de la consulta en bloques de hasta 20 minutos. Al finalizar, la IA unirá y estructurará la nota SOAP.
      </p>

      {error && (
        <div className="mb-4 flex w-full flex-col gap-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
            >
              <FileText className="h-4 w-4" />
              Usar consulta manual
            </button>
          )}
        </div>
      )}

      {isRecording ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="relative flex items-center justify-center h-20 w-20">
            <span className="absolute animate-ping inline-flex h-16 w-16 rounded-full bg-red-400 opacity-30"></span>
            <button
              onClick={stopRecording}
              className="relative flex items-center justify-center h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 transition-transform active:scale-95"
              title="Detener grabación"
            >
              <Square className="h-6 w-6 fill-white" />
            </button>
          </div>
          
          <div className="text-2xl font-bold text-slate-800 tracking-wider">
            {formatTime(seconds)}
          </div>

          <canvas
            ref={canvasRef}
            width={280}
            height={56}
            className="h-14 w-full max-w-[280px]"
            aria-hidden="true"
          />

          <span className="text-xs font-semibold text-red-500 uppercase tracking-widest animate-pulse">
            Grabando Bloque {currentBlockNum}...
          </span>

          <p className="text-center text-[11px] font-semibold text-slate-400">
            No bloquees la pantalla ni cierres la app mientras grabas: podrías perder el audio.
          </p>

          {currentBlockNum === 1 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] p-3 text-xs text-[var(--text)]">
              {TEXTO_CONSENTIMIENTO}
            </div>
          )}

          {seconds >= avisoSeconds && (
            <div className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 text-xs font-semibold text-center w-full animate-pulse">
              Faltan 3 min para cerrar el bloque (máx 20 min)
            </div>
          )}
        </div>
      ) : isProcessing ? (
        <div className="flex flex-col items-center gap-4 py-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800">Procesando audio con IA...</div>
            <div className="text-xs text-slate-500 mt-1">Transcribiendo y estructurando SOAP. Puede demorar unos segundos.</div>
          </div>
        </div>
      ) : isBlockClosed ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800">
              Bloque {segments.length} grabado ({formatTime(segmentDurations[segments.length - 1] ?? 0)})
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Puedes grabar otro bloque si la consulta continúa, o finalizar y procesar todo.
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              onClick={startRecording}
              className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition"
            >
              Grabar siguiente bloque
            </button>
            <button
              onClick={handleFinish}
              className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-accent hover:bg-accent-strong px-4 py-2.5 text-sm font-bold text-white transition shadow-lg shadow-accent/10"
            >
              Finalizar y procesar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startRecording}
          disabled={isProcessing}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent hover:bg-accent-strong text-white shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          title="Iniciar grabación"
        >
          <Mic className="h-7 w-7" />
        </button>
      )}

      {/* List of recorded blocks */}
      {segments.length > 0 && !isProcessing && (
        <div className="w-full mt-6 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bloques grabados:</h4>
          <ul className="space-y-1.5 w-full max-h-36 overflow-y-auto">
            {segments.map((_, index) => (
              <li key={index} className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <span className="font-semibold text-slate-700">Bloque {index + 1}</span>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-slate-500">{formatTime(segmentDurations[index] ?? 0)}</span>
                  <button
                    type="button"
                    onClick={() => eliminarBloque(index)}
                    title="Borrar este bloque"
                    aria-label={`Borrar bloque ${index + 1}`}
                    className="text-slate-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isRecording && !isProcessing && !isBlockClosed && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Hacer clic para iniciar
          </span>
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-accent hover:text-accent"
            >
              <FileText className="h-4 w-4" />
              Consulta manual
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
export { AudioRecorder };
