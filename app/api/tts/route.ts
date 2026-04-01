import { NextRequest, NextResponse } from "next/server";
import type { TTSRequestDTO, TTSResponseDTO } from "@/types";
import { textToSpeechClient } from "@/lib/gcp";
import { resolveTtsVoiceForServer } from "@/lib/tts-voices";

export async function POST(request: NextRequest) {
  try {
    let body: TTSRequestDTO;
    try {
      body = (await request.json()) as TTSRequestDTO;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "Field 'text' is required" },
        { status: 400 },
      );
    }

    const requestedVoice =
      typeof body.voiceName === "string" ? body.voiceName.trim() : undefined;
    const { languageCode, name: voiceName } =
      resolveTtsVoiceForServer(requestedVoice);

    const [ttsResponse] = await textToSpeechClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    });

    const content = ttsResponse.audioContent;
    if (content == null) {
      return NextResponse.json(
        { error: "No audio generated" },
        { status: 500 },
      );
    }

    const buf = Buffer.isBuffer(content)
      ? content
      : Buffer.from(content as Uint8Array);

    const payload: TTSResponseDTO = {
      audioContentBase64: buf.toString("base64"),
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS failed";
    console.error("POST /api/tts", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
