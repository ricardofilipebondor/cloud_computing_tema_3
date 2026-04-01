import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "@google-cloud/firestore";
import type { Note } from "@/types";
import { firestore } from "@/lib/gcp";

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

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  if (!username || !username.trim()) {
    return NextResponse.json(
      { error: "Query parameter 'username' is required" },
      { status: 400 },
    );
  }

  try {
    const snapshot = await firestore
      .collection("notes")
      .where("username", "==", username.trim())
      .get();

    const notes: Note[] = snapshot.docs.map((doc) =>
      firestoreDocToNote(doc.id, doc.data() as Record<string, unknown>),
    );

    notes.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json(notes);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch notes";
    console.error("GET /api/notes", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
