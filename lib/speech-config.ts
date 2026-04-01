type SpeechEncoding =
  | "LINEAR16"
  | "FLAC"
  | "MULAW"
  | "AMR"
  | "AMR_WB"
  | "OGG_OPUS"
  | "SPEEX_WITH_HEADER_BYTE"
  | "MP3"
  | "WEBM_OPUS";

export function buildRecognitionConfig(
  extension: string,
  languageCode?: string,
): {
  encoding: SpeechEncoding;
  languageCode: string;
  enableAutomaticPunctuation: boolean;
  sampleRateHertz?: number;
} {
  const ext = extension.toLowerCase().replace(/^\./, "");
  const resolvedLanguage =
    languageCode?.trim() ||
    process.env.SPEECH_LANGUAGE_CODE?.trim() ||
    "en-US";

  const base = {
    languageCode: resolvedLanguage,
    enableAutomaticPunctuation: true,
  };

  switch (ext) {
    case "wav":
      return {
        ...base,
        encoding: "LINEAR16" as const,
        sampleRateHertz: 44100,
      };
    case "webm":
      return { ...base, encoding: "WEBM_OPUS" as const };
    case "ogg":
      return { ...base, encoding: "OGG_OPUS" as const };
    case "flac":
      return { ...base, encoding: "FLAC" as const };
    case "mp3":
    case "mpeg":
    default:
      return { ...base, encoding: "MP3" as const };
  }
}
