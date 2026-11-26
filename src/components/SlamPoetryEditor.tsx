/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Wind,
  Zap,
  Sparkles,
  Eraser,
  BookOpen,
  Gauge,
} from 'lucide-react';
import {
  SLAM_CADENCE_PRESETS,
  SLAM_QUICK_MARKERS,
  SlamQuickMarker,
  applyQuickMarkerToText,
  computeAutoTempoForDuration,
  computeSlamMetrics,
  formatMinutesSeconds,
  getCadenceZoneInfo,
} from '../utils/slamMetrics';
import { stripProsodyMarkersForSubtitles } from '../utils/textCleaner';

interface SlamPoetryEditorProps {
  value: string;
  onChange: (next: string) => void;
  cadenceWpm: number;
  onChangeCadenceWpm: (wpm: number) => void;
  targetDurationSec?: number;
  onChangeTargetDurationSec?: (sec: number) => void;
  placeholder?: string;
  rows?: number;
  onOpenLiteraryAssistant?: () => void;
  accentColor?: 'amber' | 'blue';
  label?: string;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SlamPoetryEditor: React.FC<SlamPoetryEditorProps> = ({
  value,
  onChange,
  cadenceWpm,
  onChangeCadenceWpm,
  targetDurationSec,
  onChangeTargetDurationSec,
  placeholder = "Écrivez votre slam ou poème vers par vers...\nUtilisez les boutons ci-dessus pour placer vos respirations et emphases.",
  rows = 7,
  onOpenLiteraryAssistant,
  accentColor = 'amber',
  label = 'Éditeur Slam & Poésie',
  onNotify,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [localTargetDuration, setLocalTargetDuration] = useState<number>(30);

  const effectiveTargetDuration =
    typeof targetDurationSec === 'number' && targetDurationSec > 0
      ? targetDurationSec
      : localTargetDuration;

  const [durationDraft, setDurationDraft] = useState<string>(String(effectiveTargetDuration));

  useEffect(() => {
    setDurationDraft(String(effectiveTargetDuration));
  }, [effectiveTargetDuration]);

  const updateTargetDuration = (nextSec: number) => {
    const safe = Math.max(5, Math.min(600, Math.round(nextSec || 30)));
    setLocalTargetDuration(safe);
    setDurationDraft(String(safe));
    onChangeTargetDurationSec?.(safe);
  };

  const metrics = useMemo(() => computeSlamMetrics(value, cadenceWpm), [value, cadenceWpm]);
  const cadenceZone = useMemo(() => getCadenceZoneInfo(cadenceWpm), [cadenceWpm]);
  const isPresetCadence = useMemo(
    () => SLAM_CADENCE_PRESETS.some((p) => p.wpm === cadenceWpm),
    [cadenceWpm]
  );

  const breathMarkers = useMemo(
    () => SLAM_QUICK_MARKERS.filter((m) => m.category === 'breath'),
    []
  );
  const emphasisMarkers = useMemo(
    () => SLAM_QUICK_MARKERS.filter((m) => m.category === 'emphasis'),
    []
  );

  const hasMarkers = metrics.breathCount > 0 || metrics.emphasisCount > 0 || /\[[^\]]+\]/.test(value);

  const handleInsertMarker = (marker: SlamQuickMarker) => {
    const el = textareaRef.current;
    const selStart = el ? el.selectionStart : value.length;
    const selEnd = el ? el.selectionEnd : value.length;

    const { nextText, nextCursorStart, nextCursorEnd } = applyQuickMarkerToText(
      value,
      selStart,
      selEnd,
      marker
    );

    onChange(nextText);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursorStart, nextCursorEnd);
      }
    });
  };

  const handleStripMarkers = () => {
    if (!value.trim()) return;
    const clean = stripProsodyMarkersForSubtitles(value);
    onChange(clean);
    onNotify?.('Marqueurs scéniques retirés du texte.', 'info');
  };

  const accentBorder = accentColor === 'amber' ? 'focus:border-[#f59e0b]' : 'focus:border-[#89b4fa]';
  const accentText = accentColor === 'amber' ? 'text-[#f59e0b]' : 'text-[#89b4fa]';
  const badgeBg =
    accentColor === 'amber'
      ? 'bg-[#f59e0b]/15 border-[#f59e0b]/40 text-[#fbbf24]'
      : 'bg-[#89b4fa]/15 border-[#89b4fa]/40 text-[#89b4fa]';

  const handleAutoTempo = () => {
    if (!value.trim() || metrics.wordCount === 0) {
      onNotify?.("Saisissez d'abord un texte pour calculer le tempo automatique.", 'info');
      return;
    }
    const desired = effectiveTargetDuration > 0 ? effectiveTargetDuration : 30;
    const { idealWpm, clamped, rawWpm } = computeAutoTempoForDuration(value, desired);
    onChangeCadenceWpm(idealWpm);
    if (clamped) {
      onNotify?.(
        `Tempo ajusté au maximum/minimum (${idealWpm} mpm, calcul théorique ${rawWpm} mpm). Adaptez la longueur du texte pour atteindre exactement ${desired}s.`,
        'info'
      );
    } else {
      onNotify?.(
        `Tempo ajusté automatiquement à ${idealWpm} mots/min pour ~${desired}s !`,
        'success'
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* En-tête + Compteur de temps de parole estimé */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold flex items-center gap-1.5 ${accentText}`}>
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </span>

          {onOpenLiteraryAssistant && (
            <button
              type="button"
              onClick={onOpenLiteraryAssistant}
              className="px-2.5 py-1 rounded-lg bg-[#cba6f7]/15 hover:bg-[#cba6f7]/25 border border-[#cba6f7]/45 text-[#cba6f7] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Assistant Poète Expert</span>
            </button>
          )}
        </div>

        {/* Compteur de temps de parole estimé + sélecteur de débit slam */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 tabular-nums ${badgeBg}`}
            title={`Temps de parole estimé sur un débit de ${metrics.wpm} mots/min incluant pauses et respirations`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>~{metrics.formattedTime}</span>
            {(targetDurationSec ?? 0) > 0 && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                  Math.abs(metrics.estimatedSeconds - (targetDurationSec || 0)) <=
                  Math.max(4, (targetDurationSec || 0) * 0.15)
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-black/30 text-[#cdd6f4]'
                }`}
              >
                / {formatMinutesSeconds(targetDurationSec || 0)}
              </span>
            )}
          </div>

          <select
            value={cadenceWpm}
            onChange={(e) => onChangeCadenceWpm(Number(e.target.value))}
            aria-label="Débit de slam pour l'estimation"
            title="Choisir le débit de slam moyen pour le calcul du temps de parole"
            className="px-2 py-1 rounded-lg bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4] focus:outline-none focus:border-[#f59e0b] cursor-pointer"
          >
            {SLAM_CADENCE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.wpm}>
                {preset.label}
              </option>
            ))}
            {!isPresetCadence && (
              <option value={cadenceWpm}>{cadenceWpm} mpm (Auto / Perso)</option>
            )}
          </select>
        </div>
      </div>

      {/* Indicateur Visuel de Cadence (mots/min) & Ajustement Tempo Automatique */}
      <div className="p-3 rounded-xl bg-[#11111b] border border-[#313244] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className={`w-4 h-4 shrink-0 ${cadenceZone.textClass}`} />
            <span className="text-[11px] font-bold text-[#cdd6f4]">
              Cadence :{' '}
              <span className={`font-mono ${cadenceZone.textClass}`}>{cadenceWpm} mots/min</span>
            </span>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 ${cadenceZone.textClass}`}
          >
            {cadenceZone.label}
          </span>
        </div>

        {/* Jauge visuelle + Curseur interactif */}
        <div className="space-y-1">
          <div className="relative h-2 w-full rounded-full bg-[#1e1e2e] overflow-hidden border border-[#313244]">
            <div
              className={`h-full transition-all duration-200 ${cadenceZone.barClass}`}
              style={{ width: `${cadenceZone.percent}%` }}
            />
          </div>
          <input
            type="range"
            min={60}
            max={240}
            step={5}
            value={cadenceWpm}
            onChange={(e) => onChangeCadenceWpm(Number(e.target.value))}
            aria-label="Curseur de cadence en mots par minute"
            className="w-full h-1.5 accent-[#f59e0b] cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-[#6c7086]">
            <span>60 (Très lent)</span>
            <span>105</span>
            <span>130 (Slam)</span>
            <span>155</span>
            <span>180</span>
            <span>240</span>
          </div>
        </div>

        {/* Option d'ajustement automatique du tempo selon la durée souhaitée */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#313244]/70">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-[#a6adc8]">Durée souhaitée :</span>
            {[15, 30, 45, 60].map((secPreset) => (
              <button
                key={secPreset}
                type="button"
                onClick={() => updateTargetDuration(secPreset)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                  effectiveTargetDuration === secPreset
                    ? 'bg-[#f59e0b]/25 border-[#f59e0b]/60 text-[#fbbf24] font-bold'
                    : 'bg-[#181825] border-[#313244] text-[#a6adc8] hover:text-[#cdd6f4]'
                }`}
              >
                {secPreset}s
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={600}
                step={5}
                value={durationDraft}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDurationDraft(raw);
                  const parsed = parseInt(raw, 10);
                  if (Number.isFinite(parsed) && parsed >= 5 && parsed <= 600) {
                    setLocalTargetDuration(parsed);
                    onChangeTargetDurationSec?.(parsed);
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(durationDraft, 10);
                  if (!Number.isFinite(parsed) || parsed < 5) {
                    updateTargetDuration(5);
                  } else if (parsed > 600) {
                    updateTargetDuration(600);
                  } else {
                    updateTargetDuration(parsed);
                  }
                }}
                aria-label="Durée souhaitée en secondes"
                className="w-14 px-1.5 py-0.5 rounded bg-[#181825] border border-[#313244] text-[10px] font-mono text-[#cdd6f4] text-center"
              />
              <span className="text-[10px] text-[#6c7086]">s</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoTempo}
            disabled={!value.trim()}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/45 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 transition-colors"
            title="Calcule automatiquement les mots/min pour que ce texte dure la durée souhaitée"
          >
            <Zap className="w-3 h-3" />
            <span>Ajuster tempo auto ({effectiveTargetDuration}s)</span>
          </button>
        </div>
      </div>

      {/* Barre d'insertion rapide : Respiration & Emphase */}
      <div className="p-2.5 rounded-xl bg-[#11111b] border border-[#313244] space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94e2d5] flex items-center gap-1 mr-1">
            <Wind className="w-3 h-3" />
            <span>Respiration :</span>
          </span>
          {breathMarkers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              onClick={() => handleInsertMarker(marker)}
              title={marker.hint}
              className="px-2 py-1 rounded-lg bg-[#181825] hover:bg-[#94e2d5]/15 border border-[#313244] hover:border-[#94e2d5]/50 text-[11px] font-medium text-[#cdd6f4] hover:text-[#94e2d5] cursor-pointer transition-colors"
            >
              + {marker.shortLabel}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[#313244]/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] flex items-center gap-1 mr-1">
              <Zap className="w-3 h-3" />
              <span>Emphase :</span>
            </span>
            {emphasisMarkers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                onClick={() => handleInsertMarker(marker)}
                title={`${marker.hint} (sélectionnez un mot puis cliquez, ou cliquez pour insérer)`}
                className="px-2 py-1 rounded-lg bg-[#181825] hover:bg-[#fbbf24]/15 border border-[#313244] hover:border-[#fbbf24]/50 text-[11px] font-medium text-[#cdd6f4] hover:text-[#fbbf24] cursor-pointer transition-colors"
              >
                {marker.shortLabel}
              </button>
            ))}
          </div>

          {hasMarkers && (
            <button
              type="button"
              onClick={handleStripMarkers}
              title="Supprimer les marqueurs [respiration], [pause], [emphase] du texte"
              className="px-2 py-1 rounded-lg bg-[#181825] hover:bg-[#f38ba8]/15 border border-[#313244] hover:border-[#f38ba8]/40 text-[10px] font-semibold text-[#a6adc8] hover:text-[#f38ba8] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Eraser className="w-3 h-3" />
              <span>Retirer marqueurs</span>
            </button>
          )}
        </div>
      </div>

      {/* Zone de saisie poétique */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`w-full p-3.5 rounded-xl bg-[#11111b] border border-[#45475a] text-sm leading-relaxed text-[#cdd6f4] placeholder:text-[#6c7086] focus:outline-none ${accentBorder} resize-y font-sans`}
      />

      {/* Barre de métriques détaillées en direct */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#a6adc8] tabular-nums">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            <strong className="text-[#cdd6f4]">{metrics.wordCount}</strong> mot{metrics.wordCount > 1 ? 's' : ''}
          </span>
          <span>
            <strong className="text-[#cdd6f4]">{metrics.verseCount}</strong> ver{metrics.verseCount > 1 ? 's' : ''}
          </span>
          <span>
            <strong className="text-[#cdd6f4]">{metrics.stanzaCount}</strong> strophe{metrics.stanzaCount > 1 ? 's' : ''}
          </span>
          {metrics.breathCount > 0 && (
            <span className="text-[#94e2d5]">
              <strong>{metrics.breathCount}</strong> souffle{metrics.breathCount > 1 ? 's' : ''}
            </span>
          )}
          {metrics.emphasisCount > 0 && (
            <span className="text-[#fbbf24]">
              <strong>{metrics.emphasisCount}</strong> emphase{metrics.emphasisCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#6c7086]">
          Les marqueurs guident le rythme sans être lus à voix haute.
        </span>
      </div>
    </div>
  );
};
