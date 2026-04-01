import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "@google-cloud/firestore";
import { firestore } from "@/lib/gcp";
import type { Note, UpdateNoteDTO } from "@/types";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const noteId = params.id;
    if (!noteId) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 });
    }

    let body: UpdateNoteDTO;
    try {
      body = (await request.json()) as UpdateNoteDTO;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updatePayload: Record<string, string> = {};

    if (body.username !== undefined) {
      if (!body.username.trim()) {
        return NextResponse.json(
          { error: "Username cannot be empty" },
          { status: 400 },
        );
      }
      updatePayload.username = body.username.trim();
    }

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 },
        );
      }
      updatePayload.title = body.title.trim();
    }

    if (body.transcript !== undefined) {
      updatePayload.transcript = body.transcript.trim();
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No fields provided for update" },
        { status: 400 },
      );
    }

    const ref = firestore.collection("notes").doc(noteId);
    const existing = await ref.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await ref.update(updatePayload);

    const updated = await ref.get();
    const data = updated.data();
    if (!data) {
      return NextResponse.json(
        { error: "Failed to read updated note" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      firestoreDocToNote(updated.id, data as Record<string, unknown>),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update note";
    console.error("PATCH /api/notes/[id]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const noteId = params.id;
    if (!noteId) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 });
    }

    const ref = firestore.collection("notes").doc(noteId);
    const existing = await ref.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await ref.delete();

    return NextResponse.json({ success: true, id: noteId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete note";
    console.error("DELETE /api/notes/[id]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
