import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "@google-cloud/firestore";
import type { Note } from "@/types";
import { firestore, speechClient } from "@/lib/gcp";
import { buildRecognitionConfig } from "@/lib/speech-config";
import { resolveSpeechLanguage } from "@/lib/speech-languages";
import { uploadObjectSimpleMedia } from "@/lib/gcs-json-upload";

function firestoreDocToNote(id: string, data: Record<string, unknown>): Note {
  const createdAt = data.createdAt;
  let createdIso: string;
  if (createdAt instanceof Timestamp) {
    createdIso = createdAt.toDate().toISOString();
  } else if (typeof createdAt === "string") {
    createdIso = createdAt;
  } else {
    createdIso = new Date().toISOString();
  }

  return {
    id,
    username: String(data.username ?? ""),
    title: String(data.title ?? ""),
    audioStorageUri: String(data.audioStorageUri ?? ""),
    transcript: String(data.transcript ?? ""),
    createdAt: createdIso,
  };
}

export async function POST(request: NextRequest) {
  const bucketName = process.env.GCP_BUCKET_NAME;
  if (!process.env.GCP_PROJECT_ID || !bucketName) {
    return NextResponse.json(
      {
        error:
          "Missing GCP_PROJECT_ID or GCP_BUCKET_NAME. Configure .env.local.",
      },
      { status: 500 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const title = form.get("title");
    const username = form.get("username");
    const speechLanguageRaw = form.get("speechLanguage");
    const speechLanguage =
      typeof speechLanguageRaw === "string"
        ? speechLanguageRaw
        : undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid audio file" },
        { status: 400 },
      );
    }
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid title" },
        { status: 400 },
      );
    }
    if (typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid username" },
        { status: 400 },
      );
    }

    const noteId = crypto.randomUUID();
    const originalName = file.name || "recording";
    const dot = originalName.lastIndexOf(".");
    const ext =
      dot >= 0 ? originalName.slice(dot).toLowerCase() || ".webm" : ".webm";
    const objectPath = `notes-audio/${noteId}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadObjectSimpleMedia({
      bucket: bucketName,
      objectPath,
      buffer,
      contentType: file.type || "application/octet-stream",
    });

    const gsUri = `gs://${bucketName}/${objectPath}`;
    const lang = resolveSpeechLanguage(speechLanguage);
    const speechConfig = buildRecognitionConfig(ext, lang);

    const [operation] = await speechClient.longRunningRecognize({
      config: speechConfig,
      audio: { uri: gsUri },
    });
    const [response] = await operation.promise();

    const transcript =
      response.results
        ?.map((r) => r.alternatives?.[0]?.transcript ?? "")
        .join(" ")
        .trim() ?? "";

    await firestore.collection("notes").doc(noteId).set({
      username: username.trim(),
      title: title.trim(),
      audioStorageUri: gsUri,
      transcript,
      createdAt: FieldValue.serverTimestamp(),
    });

    const snap = await firestore.collection("notes").doc(noteId).get();
    const saved = snap.data();
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to read saved note" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      firestoreDocToNote(noteId, saved as Record<string, unknown>),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("POST /api/upload", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
