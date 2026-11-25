import { db, ensureAuth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BaseGeminiVoiceId, CustomVoiceProfile, VoicePace } from '../types/voiceProfile';

export const CUSTOM_VOICES_STORAGE_KEY = 'voxart_custom_voice_profiles_v1';
export const CUSTOM_VOICE_PREFIX = 'custom:';
const FIRESTORE_DOC_ID = 'custom_voice_profiles_v1';

export interface BaseGeminiVoiceMeta {
  id: BaseGeminiVoiceId;
  label: string;
  gender: 'Homme' | 'Femme';
  summary: string;
  defaultGenderLabel: string;
}

export const BASE_GEMINI_VOICES: BaseGeminiVoiceMeta[] = [
  {
    id: 'Charon',
    label: 'Charon',
    gender: 'Homme',
    summary: 'Grave, profond, résonnant et posé',
    defaultGenderLabel: 'voix masculine grave, profonde et résonnante (homme)',
  },
  {
    id: 'Fenrir',
    label: 'Fenrir',
    gender: 'Homme',
    summary: 'Direct, net, structuré et assertif',
    defaultGenderLabel: 'voix masculine grave, profonde et résonnante (homme)',
  },
  {
    id: 'Puck',
    label: 'Puck',
    gender: 'Homme',
    summary: 'Dynamique, expressif, clair et énergique',
    defaultGenderLabel: 'voix masculine grave, profonde et résonnante (homme)',
  },
  {
    id: 'Kore',
    label: 'Kore',
    gender: 'Femme',
    summary: 'Mélodieuse, articulée, chaleureuse et équilibrée',
    defaultGenderLabel: 'voix féminine mélodieuse, claire et expressive (femme)',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    gender: 'Femme',
    summary: 'Douce, feutrée, apaisante et intime',
    defaultGenderLabel: 'voix féminine mélodieuse, claire et expressive (femme)',
  },
];

export const TIMBRE_DESCRIPTOR_CHIPS: string[] = [
  'Grave & Boisé',
  'Chaleureux',
  'Posé & Serein',
  'Oralité Griot',
  'Voix Off Cinéma',
  'Dynamique',
  'Feutré',
  'Cristallin',
  'Narratif',
  'Intime',
];

export const PACE_OPTIONS: Record<VoicePace, { label: string; directive: string }> = {
  lent: {
    label: 'Lent & Méditatif',
    directive: 'débit lent, posé, avec des pauses respirées et une grande clarté d’articulation',
  },
  pose: {
    label: 'Posé & Solennel',
    directive: 'rythme modéré et posé, ton assuré et mesuré',
  },
  naturel: {
    label: 'Naturel',
    directive: 'débit naturel et fluide, conversationnel et humain',
  },
  dynamique: {
    label: 'Dynamique',
    directive: 'rythme vivant, entraînant et expressif',
  },
  rapide: {
    label: 'Rapide & Percutant',
    directive: 'débit soutenu, vif et percutant tout en restant parfaitement intelligible',
  },
};

export function isCustomVoiceId(voiceId?: string | null): boolean {
  return typeof voiceId === 'string' && voiceId.startsWith(CUSTOM_VOICE_PREFIX);
}

export function extractCustomVoiceId(voiceId: string): string {
  return isCustomVoiceId(voiceId) ? voiceId.slice(CUSTOM_VOICE_PREFIX.length) : voiceId;
}

export function toCustomVoiceOptionId(profileId: string): string {
  return profileId.startsWith(CUSTOM_VOICE_PREFIX) ? profileId : `${CUSTOM_VOICE_PREFIX}${profileId}`;
}

export function clampPitch(val: number): number {
  if (!Number.isFinite(val)) return 1.0;
  return Math.round(Math.max(0.75, Math.min(1.25, val)) * 100) / 100;
}

export function sanitizeBaseVoice(val?: string): BaseGeminiVoiceId {
  const valid: BaseGeminiVoiceId[] = ['Charon', 'Fenrir', 'Puck', 'Kore', 'Zephyr'];
  if (val && valid.includes(val as BaseGeminiVoiceId)) {
    return val as BaseGeminiVoiceId;
  }
  return 'Kore';
}

export function loadLocalCustomVoices(): CustomVoiceProfile[] {
  try {
    const raw = localStorage.getItem(CUSTOM_VOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
      .map((item) => ({
        ...item,
        baseVoiceName: sanitizeBaseVoice(item.baseVoiceName),
        pitch: clampPitch(Number(item.pitch ?? 1.0)),
        timbreTags: Array.isArray(item.timbreTags) ? item.timbreTags : [],
        customPromptStyle: typeof item.customPromptStyle === 'string' ? item.customPromptStyle : '',
      }));
  } catch {
    return [];
  }
}

export function saveLocalCustomVoices(profiles: CustomVoiceProfile[]): void {
  try {
    localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.warn('Could not persist custom voices to localStorage:', e);
  }
}

export async function syncCustomVoicesFromCloud(): Promise<CustomVoiceProfile[] | null> {
  try {
    await ensureAuth();
    const ref = doc(db, 'vox_library', FIRESTORE_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data && Array.isArray(data.profiles)) {
      return data.profiles as CustomVoiceProfile[];
    }
    return null;
  } catch (e) {
    console.warn('Custom voices cloud read skipped:', e);
    return null;
  }
}

export async function syncCustomVoicesToCloud(profiles: CustomVoiceProfile[]): Promise<void> {
  try {
    await ensureAuth();
    const ref = doc(db, 'vox_library', FIRESTORE_DOC_ID);
    await setDoc(ref, {
      profiles,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Custom voices cloud sync skipped:', e);
  }
}

export function buildCustomVoiceDesignStyle(profile: CustomVoiceProfile): string {
  const paceDirective = PACE_OPTIONS[profile.pace]?.directive || PACE_OPTIONS.naturel.directive;
  const tagsPart = profile.timbreTags.length > 0 ? `Qualités vocales : ${profile.timbreTags.join(', ')}` : '';
  return [
    profile.customPromptStyle.trim(),
    `Cadence : ${paceDirective}`,
    tagsPart,
  ]
    .filter(Boolean)
    .join('. ');
}

export interface ResolvedTTSVoicePayload {
  voiceName: string;
  model: string;
  gender: string;
  style: string;
  customVoiceStyle?: string;
  pitchOverride?: number;
  activeCustomProfile?: CustomVoiceProfile;
}

export function resolveVoicePayloadForTTS(
  selectedVoiceName: string,
  customVoices: CustomVoiceProfile[],
  defaultModel: string,
  defaultGender: string,
  defaultStyle: string
): ResolvedTTSVoicePayload {
  if (isCustomVoiceId(selectedVoiceName)) {
    const profileId = extractCustomVoiceId(selectedVoiceName);
    const profile = customVoices.find((v) => v.id === profileId);
    if (profile) {
      const voiceDesignStyle = buildCustomVoiceDesignStyle(profile);
      return {
        voiceName: profile.baseVoiceName,
        model: 'gemini-3.8-flash-tts',
        gender: profile.genderLabel || defaultGender,
        style: defaultStyle,
        customVoiceStyle: voiceDesignStyle,
        pitchOverride: clampPitch(profile.pitch),
        activeCustomProfile: profile,
      };
    }
  }

  return {
    voiceName: isCustomVoiceId(selectedVoiceName) ? 'Kore' : selectedVoiceName || 'Kore',
    model: defaultModel || 'gemini-3.8-flash-lite-tts',
    gender: defaultGender,
    style: defaultStyle,
  };
}
