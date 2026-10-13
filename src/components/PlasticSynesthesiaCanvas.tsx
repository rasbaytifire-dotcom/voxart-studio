/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Download, Sparkles, Eye, Maximize2, Minimize2 } from 'lucide-react';

interface PlasticSynesthesiaCanvasProps {
  audioElement: HTMLAudioElement | null;
  audioUrl: string | null;
  isPlaying: boolean;
  themeMode: 'standard' | 'ridialart';
  title?: string;
}

export const PlasticSynesthesiaCanvas: React.FC<PlasticSynesthesiaCanvasProps> = ({
  audioElement,
  audioUrl,
  isPlaying,
  themeMode,
  title = 'Toile Synesthésique'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePalette, setActivePalette] = useState<'latérite-or' | 'indigo-mystique' | 'baobab-émeraude'>('latérite-or');

  // Palette definitions inspired by Studio RidiaLArt & endogenous Afrofuturism
  const palettes = {
    'latérite-or': {
      label: 'Latérite & Or Impérial',
      bg: '#140c06',
      bass: 'rgba(194, 65, 12, ',     // Terre cuite / Ocre rouge
      mid: 'rgba(217, 119, 6, ',      // Ambre chaud
      treble: 'rgba(250, 204, 21, ',   // Or impérial
      accent: 'rgba(249, 115, 22, '
    },
    'indigo-mystique': {
      label: 'Indigo Sacré & Dub Roots',
      bg: '#0a0d1a',
      bass: 'rgba(30, 27, 75, ',      // Indigo profond
      mid: 'rgba(79, 70, 229, ',      // Bleu nuit électrique
      treble: 'rgba(147, 197, 253, ',  // Éther cyan / éclat blanc
      accent: 'rgba(168, 85, 247, '
    },
    'baobab-émeraude': {
      label: 'Baobab & Sève Végétale',
      bg: '#06130b',
      bass: 'rgba(20, 83, 45, ',      // Forêt profonde
      mid: 'rgba(16, 185, 129, ',     // Émeraude vivante
      treble: 'rgba(234, 179, 8, ',    // Rayon solaire doré
      accent: 'rgba(52, 211, 153, '
    }
  };

  // Setup Web Audio Analyser
  useEffect(() => {
    if (!audioElement || !audioUrl) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        analyserRef.current = analyser;
      }

      // Connect element to analyser safely
      if (!sourceNodeRef.current) {
        try {
          const src = ctx.createMediaElementSource(audioElement);
          src.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
          sourceNodeRef.current = src;
        } catch {
          // Element might already be attached, ignore error
        }
      }
    } catch {
      // AudioContext fallback
    }

    return () => {
      // Cleanup happens when element changes
    };
  }, [audioElement, audioUrl]);

  // Main canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const currentTheme = palettes[activePalette];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      phase += 0.02;

      // Extract frequency bins or synthesize organic motion if idle
      let bassAvg = 0;
      let midAvg = 0;
      let trebleAvg = 0;
      let freqArray: Uint8Array | null = null;

      if (analyserRef.current && isPlaying) {
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        const bufferLength = analyserRef.current.frequencyBinCount;
        freqArray = new Uint8Array(new ArrayBuffer(bufferLength));
        analyserRef.current.getByteFrequencyData(freqArray as any);

        // Compute band averages
        const bassEnd = Math.floor(bufferLength * 0.15);
        const midEnd = Math.floor(bufferLength * 0.55);

        let sumB = 0;
        for (let i = 0; i < bassEnd; i++) sumB += freqArray[i];
        bassAvg = sumB / (bassEnd || 1) / 255;

        let sumM = 0;
        for (let i = bassEnd; i < midEnd; i++) sumM += freqArray[i];
        midAvg = sumM / (midEnd - bassEnd || 1) / 255;

        let sumT = 0;
        for (let i = midEnd; i < bufferLength; i++) sumT += freqArray[i];
        trebleAvg = sumT / (bufferLength - midEnd || 1) / 255;
      } else {
        // Subtle ambient organic pulse when idle
        bassAvg = 0.15 + Math.sin(phase * 0.8) * 0.08;
        midAvg = 0.12 + Math.cos(phase * 1.2) * 0.06;
        trebleAvg = 0.08 + Math.sin(phase * 2) * 0.04;
      }

      // Background with subtle trail for painterly synesthesia
      ctx.fillStyle = isPlaying ? `${currentTheme.bg}22` : currentTheme.bg;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Telluric / Bass Layer: Concentric organic shields & African fractal rings (Ron Eglash recursion)
      const baseRadius = Math.min(width, height) * 0.22;
      const dynamicRadius = baseRadius + bassAvg * 70;

      ctx.save();
      ctx.lineWidth = 3 + bassAvg * 6;
      ctx.strokeStyle = `${currentTheme.bass}${0.4 + bassAvg * 0.6})`;
      ctx.fillStyle = `${currentTheme.bass}${0.1 + bassAvg * 0.25})`;

      ctx.beginPath();
      const points = 12;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2 + phase * 0.3;
        const offset = Math.sin(angle * 4 + phase * 2) * (15 + bassAvg * 35);
        const r = dynamicRadius + offset;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 2. Midrange / Formants: Geometric diamond & sacred African patterns (Djembé skin harmonic structure)
      ctx.save();
      const midSize = (baseRadius * 0.8) + midAvg * 60;
      ctx.strokeStyle = `${currentTheme.mid}${0.5 + midAvg * 0.5})`;
      ctx.lineWidth = 2 + midAvg * 3;

      for (let ring = 1; ring <= 3; ring++) {
        const rSize = midSize * (ring / 3);
        ctx.beginPath();
        for (let side = 0; side < 6; side++) {
          const a = (side / 6) * Math.PI * 2 - phase * (0.4 / ring);
          const px = centerX + Math.cos(a) * rSize;
          const py = centerY + Math.sin(a) * rSize;
          if (side === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();

      // 3. Treble / Harmonics Layer: Imperial Golden Radial Rays & Waveform
      ctx.save();
      const rayCount = 36;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2 + phase * 0.5;
        const intensity = freqArray ? (freqArray[i % freqArray.length] / 255) : (0.1 + Math.sin(i + phase) * 0.1);
        const innerR = dynamicRadius * 0.85;
        const outerR = innerR + 25 + intensity * (60 + trebleAvg * 80);

        const x1 = centerX + Math.cos(angle) * innerR;
        const y1 = centerY + Math.sin(angle) * innerR;
        const x2 = centerX + Math.cos(angle) * outerR;
        const y2 = centerY + Math.sin(angle) * outerR;

        ctx.strokeStyle = `${currentTheme.treble}${0.3 + intensity * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Small fractal star or diamond on the tips of accented rays
        if (i % 3 === 0 && intensity > 0.25) {
          ctx.fillStyle = `${currentTheme.treble}0.9)`;
          ctx.beginPath();
          ctx.arc(x2, y2, 2.5 + intensity * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 4. Center Core: Golden Sun of Orality (Le Souffle du Verbe)
      ctx.save();
      const coreR = 14 + (bassAvg + midAvg) * 22;
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, coreR);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, `${currentTheme.treble}1)`);
      coreGrad.addColorStop(0.8, `${currentTheme.accent}0.8)`);
      coreGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 5. Stylized RidiaLArt Signature Watermark in bottom corner
      ctx.save();
      ctx.font = '10px monospace';
      ctx.fillStyle = `${currentTheme.treble}0.55)`;
      ctx.textAlign = 'right';
      ctx.fillText('RIDIALART • SYNTHÈSE PLASTIQUE ENDOGÈNE', width - 14, height - 12);
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, activePalette]);

  const handleExportCanvasImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Toile_Synesthesique_RidiaLArt_${cleanTitle}_${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.warn('Canvas export error:', e);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#d97706]/40 shadow-2xl bg-[#0d0703] transition-all">
      {/* Canvas Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1f1307]/80 backdrop-blur-md border-b border-[#d97706]/30">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] animate-pulse" />
          <span className="text-xs font-bold tracking-wide text-[#fbbf24] flex items-center gap-1.5 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
            Synesthésie Plastique RidiaLArt
          </span>
          <span className="text-[10px] bg-[#d97706]/20 text-[#fde68a] px-2 py-0.5 rounded-full border border-[#d97706]/40 hidden sm:inline">
            Ondes & Formes de la Voix
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Palette Selector */}
          <select
            value={activePalette}
            onChange={(e) => setActivePalette(e.target.value as any)}
            className="text-[11px] bg-[#2d1807] border border-[#d97706]/50 text-[#fde68a] rounded-lg px-2 py-1 font-medium focus:outline-none"
            title="Changer la palette chromatique synesthétique"
          >
            <option value="latérite-or">Ocre & Or</option>
            <option value="indigo-mystique">Indigo Sacré</option>
            <option value="baobab-émeraude">Baobab Sève</option>
          </select>

          {/* Export PNG */}
          <button
            type="button"
            onClick={handleExportCanvasImage}
            className="px-2.5 py-1 text-[11px] font-semibold bg-[#d97706] hover:bg-[#b45309] text-[#1c0f04] rounded-lg flex items-center gap-1 shadow-md transition-all"
            title="Télécharger l'œuvre plastique générée par votre voix (PNG HD)"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Exporter la Toile</span>
          </button>
        </div>
      </div>

      {/* The Visual Canvas */}
      <div className="relative flex items-center justify-center p-2 bg-[#090502]">
        <canvas
          ref={canvasRef}
          width={640}
          height={320}
          className="w-full max-h-[340px] rounded-xl object-contain shadow-inner"
        />

        {/* Live Audio Indicator Tag */}
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#d97706]/30 text-[10px] font-mono text-[#fde68a] flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span>{isPlaying ? 'Traduction Synesthétique Active' : 'En veille vibratoire'}</span>
        </div>
      </div>
    </div>
  );
};
