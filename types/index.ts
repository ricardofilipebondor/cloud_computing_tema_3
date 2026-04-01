export interface Note {
  id: string;
  username: string;
  title: string;
  audioStorageUri: string;
  transcript: string;
  createdAt: string;
}

export interface UpdateNoteDTO {
  username?: string;
  title?: string;
  transcript?: string;
}

export interface TTSRequestDTO {
  text: string;
  /** Must match a name from lib/tts-voices allowlist */
  voiceName?: string;
}

export interface TTSResponseDTO {
  audioContentBase64: string;
}
