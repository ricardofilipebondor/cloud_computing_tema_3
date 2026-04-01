/**
 * Allowlist for TTS: only these voices can be requested from the API.
 * Extend with names that exist in your GCP project (Text-to-Speech voices).
 */
export const TTS_VOICE_OPTIONS = [
  {
    name: "en-US-Neural2-F",
    languageCode: "en-US",
    label: "English · Neural2 F",
  },
  {
    name: "en-US-Neural2-D",
    languageCode: "en-US",
    label: "English · Neural2 D",
  },
  {
    name: "en-US-Neural2-J",
    languageCode: "en-US",
    label: "English · Neural2 J",
  },
  {
    name: "en-US-Journey-F",
    languageCode: "en-US",
    label: "English · Journey F",
  },
  {
    name: "en-US-Journey-D",
    languageCode: "en-US",
    label: "English · Journey D",
  },
  {
    name: "ro-RO-Wavenet-A",
    languageCode: "ro-RO",
    label: "Română · Wavenet A",
  },
  {
    name: "ro-RO-Standard-A",
    languageCode: "ro-RO",
    label: "Română · Standard A",
  },
] as const;

export type TtsVoiceName = (typeof TTS_VOICE_OPTIONS)[number]["name"];

const BY_NAME = new Map<string, (typeof TTS_VOICE_OPTIONS)[number]>(
  TTS_VOICE_OPTIONS.map((v) => [v.name, v]),
);

export function resolveTtsVoiceForServer(requested?: string | null): {
  name: string;
  languageCode: string;
} {
  const envDefault = process.env.TTS_VOICE_NAME?.trim();
  if (requested) {
    const v = BY_NAME.get(requested);
    if (v) return { name: v.name, languageCode: v.languageCode };
  }
  if (envDefault) {
    const v = BY_NAME.get(envDefault);
    if (v) return { name: v.name, languageCode: v.languageCode };
  }
  const v = TTS_VOICE_OPTIONS[0];
  return { name: v.name, languageCode: v.languageCode };
}
