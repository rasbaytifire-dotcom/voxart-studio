export type BaseGeminiVoiceId = 'Charon' | 'Fenrir' | 'Puck' | 'Kore' | 'Zephyr';

export type VoicePace = 'lent' | 'pose' | 'naturel' | 'dynamique' | 'rapide';

export interface CustomVoiceProfile {
  id: string;
  name: string;
  baseVoiceName: BaseGeminiVoiceId;
  genderLabel: string;
  pitch: number;
  pace: VoicePace;
  timbreTags: string[];
  customPromptStyle: string;
  analysisSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceAnalysisResult {
  recommendedBaseVoice: BaseGeminiVoiceId;
  estimatedPitchFactor: number;
  detectedGenderLabel: string;
  detectedPace: VoicePace;
  detectedTimbreTags: string[];
  voiceDesignPrompt: string;
  analysisSummary: string;
}
