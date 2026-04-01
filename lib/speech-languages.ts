/**
 * Languages offered in the UI for Speech-to-Text. Codes must be supported by
 * Google Cloud Speech-to-Text for your audio format.
 * @see https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
 */
export const SPEECH_LANGUAGE_OPTIONS = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "ro-RO", label: "Română" },
  { code: "de-DE", label: "Deutsch" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español (España)" },
  { code: "it-IT", label: "Italiano" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "nl-NL", label: "Nederlands" },
  { code: "pl-PL", label: "Polski" },
] as const;

const ALLOWED = new Set<string>(
  SPEECH_LANGUAGE_OPTIONS.map((o) => o.code),
);

/**
 * Per-request language from the client (must be in allowlist), else .env, else en-US.
 */
export function resolveSpeechLanguage(requested?: string | null): string {
  const trimmed = requested?.trim();
  if (trimmed && ALLOWED.has(trimmed)) return trimmed;
  const env = process.env.SPEECH_LANGUAGE_CODE?.trim();
  if (env) return env;
  return "en-US";
}
