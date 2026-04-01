"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/types";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speech-languages";
import { TTS_VOICE_OPTIONS } from "@/lib/tts-voices";

const LAST_USERNAME_KEY = "yourvoiceyournotes:last-username";
const LAST_TTS_VOICE_KEY = "yourvoiceyournotes:tts-voice";
const LAST_SPEECH_LANG_KEY = "yourvoiceyournotes:speech-lang";

type NoteDraft = {
  username: string;
  title: string;
  transcript: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function pickRecorderMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

function blobToFile(blob: Blob): File {
  const type = blob.type || "audio/webm";
  const ext = type.includes("ogg") ? ".ogg" : ".webm";
  return new File([blob], `recording${ext}`, { type });
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
      <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
    </svg>
  );
}

function statusText(params: {
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordError: string | null;
}) {
  if (params.recordError) return params.recordError;
  if (params.isRecording) return "Recording live. Keep the tab active.";
  if (params.recordedBlob) return "Clip ready. Save it to generate the transcript.";
  return "Tap the mic to capture a lecture snippet and turn it into notes.";
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [feedUsername, setFeedUsername] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [clipSeconds, setClipSeconds] = useState(0);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(
    TTS_VOICE_OPTIONS[0].name,
  );
  const [selectedSpeechLang, setSelectedSpeechLang] = useState<string>(
    SPEECH_LANGUAGE_OPTIONS[0].code,
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = window.setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopMicTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setRecordError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordError("Microphone is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      setRecordingSeconds(0);
      setClipSeconds(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecordedBlob(blob);
        stopMicTracks();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
    } catch (e) {
      stopMicTracks();
      setRecordError(
        e instanceof Error
          ? e.message
          : "Could not access microphone. Check permissions.",
      );
    }
  }, [stopMicTracks]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setClipSeconds(recordingSeconds);
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      stopMicTracks();
    }
  }, [recordingSeconds, stopMicTracks]);

  const discardRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordError(null);
    setClipSeconds(0);
    setRecordingSeconds(0);
  }, []);

  const fetchNotes = useCallback(async (user: string) => {
    const normalizedUser = user.trim();
    if (!normalizedUser) {
      setNotesError("Enter a username to search.");
      setNotes([]);
      return;
    }

    setLoadingNotes(true);
    setNotesError(null);
    setFeedUsername(normalizedUser);
    try {
      window.localStorage.setItem(LAST_USERNAME_KEY, normalizedUser);
      const res = await fetch(
        `/api/notes?username=${encodeURIComponent(normalizedUser)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not load notes.");
      }
      setNotes(data as Note[]);
    } catch (e) {
      setNotes([]);
      setNotesError(e instanceof Error ? e.message : "Failed to load notes.");
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    const savedUsername = window.localStorage.getItem(LAST_USERNAME_KEY);
    if (savedUsername?.trim()) {
      setFeedUsername(savedUsername);
      void fetchNotes(savedUsername);
    }
  }, [fetchNotes]);

  useEffect(() => {
    const saved = window.localStorage.getItem(LAST_TTS_VOICE_KEY);
    if (
      saved &&
      TTS_VOICE_OPTIONS.some((v) => v.name === saved)
    ) {
      setSelectedVoiceName(saved);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(LAST_SPEECH_LANG_KEY);
    if (
      saved &&
      SPEECH_LANGUAGE_OPTIONS.some((o) => o.code === saved)
    ) {
      setSelectedSpeechLang(saved);
    }
  }, []);

  async function onSubmitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!recordedBlob || !username.trim() || !lectureTitle.trim()) return;

    setUploading(true);
    try {
      const currentUsername = username.trim();
      const form = new FormData();
      form.append("file", blobToFile(recordedBlob));
      form.append("title", lectureTitle.trim());
      form.append("username", currentUsername);
      form.append("speechLanguage", selectedSpeechLang);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setLectureTitle("");
      setRecordedBlob(null);
      setClipSeconds(0);
      await fetchNotes(currentUsername);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function playTranscript(noteId: string, text: string) {
    setPlayingNoteId(noteId);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: selectedVoiceName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "TTS failed.");
      }
      const b64 = data.audioContentBase64 as string;
      const src = `data:audio/mp3;base64,${b64}`;
      const audio = new Audio(src);
      audio.onended = () => setPlayingNoteId(null);
      audio.onerror = () => {
        setPlayingNoteId(null);
        alert("Could not play audio.");
      };
      await audio.play();
    } catch (e) {
      setPlayingNoteId(null);
      alert(e instanceof Error ? e.message : "Playback failed.");
    }
  }

  function startEditing(note: Note) {
    setEditingNoteId(note.id);
    setNoteDraft({
      username: note.username,
      title: note.title,
      transcript: note.transcript,
    });
  }

  function cancelEditing() {
    setEditingNoteId(null);
    setNoteDraft(null);
  }

  async function saveNote(noteId: string) {
    if (!noteDraft) return;

    setSavingNoteId(noteId);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update note.");
      }

      cancelEditing();
      await fetchNotes(noteDraft.username || feedUsername);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update note.");
    } finally {
      setSavingNoteId(null);
    }
  }

  async function deleteNote(note: Note) {
    const confirmed = window.confirm(
      `Delete note "${note.title}" for ${note.username}?`,
    );
    if (!confirmed) return;

    setDeletingNoteId(note.id);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete note.");
      }

      if (editingNoteId === note.id) {
        cancelEditing();
      }

      await fetchNotes(feedUsername || note.username);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete note.");
    } finally {
      setDeletingNoteId(null);
    }
  }

  const canSubmit =
    !!recordedBlob &&
    !!username.trim() &&
    !!lectureTitle.trim() &&
    !uploading &&
    !isRecording;

  const currentStatus = statusText({ isRecording, recordedBlob, recordError });

  const inputClass =
    "w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black";
  const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500";

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        <header className="border-b border-neutral-200 pb-10">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            YourVoiceYourNotes
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 sm:text-base">
            Record, transcribe, and listen back. Minimal workflow, stored in the
            cloud.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-neutral-500">
            <span>
              Notes shown:{" "}
              <span className="font-medium text-black">{notes.length}</span>
            </span>
            <span>
              Recorder:{" "}
              <span className="font-medium text-black">
                {isRecording
                  ? "recording"
                  : recordedBlob
                    ? "clip ready"
                    : "idle"}
              </span>
            </span>
            <span>
              Timer:{" "}
              <span className="font-medium tabular-nums text-black">
                {formatDuration(isRecording ? recordingSeconds : clipSeconds)}
              </span>
            </span>
          </div>
        </header>

        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Record
            </h2>
            <p className="mt-1 text-base font-medium">New note</p>
            <p className="mt-1 text-sm text-neutral-600">
              The microphone records the same in any language. Choose which
              language Google Speech-to-Text should use for the transcript.
            </p>

            <form onSubmit={onSubmitUpload} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Username</span>
                  <input
                    id="upload-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. student1"
                    required
                    disabled={uploading || isRecording}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Title</span>
                  <input
                    id="lecture-title"
                    type="text"
                    value={lectureTitle}
                    onChange={(e) => setLectureTitle(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Lecture 3"
                    required
                    disabled={uploading || isRecording}
                  />
                </label>
              </div>

              <label className="block max-w-md">
                <span className={labelClass}>Spoken language (transcription)</span>
                <select
                  value={selectedSpeechLang}
                  onChange={(e) => {
                    const c = e.target.value;
                    setSelectedSpeechLang(c);
                    window.localStorage.setItem(LAST_SPEECH_LANG_KEY, c);
                  }}
                  disabled={uploading || isRecording}
                  className={`${inputClass} cursor-pointer bg-white disabled:opacity-50`}
                >
                  {SPEECH_LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-900">
                  Microphone
                </p>
                <p className="mt-1 text-sm text-neutral-600">{currentStatus}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {!isRecording ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void startRecording()}
                        disabled={uploading}
                        className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-black bg-black text-white shadow-sm transition hover:bg-neutral-900 disabled:opacity-40"
                        aria-label="Start recording"
                      >
                        <span
                          className="pointer-events-none absolute inset-[-5px] rounded-full border border-neutral-300 opacity-60 animate-pulse motion-reduce:animate-none"
                          aria-hidden
                        />
                        <MicIcon className="relative h-8 w-8 animate-mic-idle motion-reduce:animate-none" />
                      </button>
                      <span className="text-sm text-neutral-500">
                        Tap the mic to record
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black"
                        aria-label="Stop recording"
                      >
                        <span className="absolute inset-0 rounded-full bg-neutral-900/10 animate-ping motion-reduce:animate-none" />
                        <MicIcon className="relative z-10 h-8 w-8 animate-mic-recording motion-reduce:animate-none" />
                      </button>
                      <span className="text-sm font-medium text-neutral-900">
                        Recording — tap to stop
                      </span>
                    </>
                  )}
                  {recordedBlob && !isRecording && (
                    <button
                      type="button"
                      onClick={discardRecording}
                      disabled={uploading}
                      className="border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 disabled:opacity-40"
                    >
                      Discard
                    </button>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="border border-neutral-200 bg-white py-2">
                    <div className="text-neutral-500">Status</div>
                    <div className="mt-0.5 font-medium text-neutral-900">
                      {isRecording
                        ? "rec"
                        : recordedBlob
                          ? "ready"
                          : "idle"}
                    </div>
                  </div>
                  <div className="border border-neutral-200 bg-white py-2">
                    <div className="text-neutral-500">Time</div>
                    <div className="mt-0.5 font-medium tabular-nums text-neutral-900">
                      {formatDuration(isRecording ? recordingSeconds : clipSeconds)}
                    </div>
                  </div>
                  <div className="border border-neutral-200 bg-white py-2">
                    <div className="text-neutral-500">Save</div>
                    <div className="mt-0.5 font-medium text-neutral-900">
                      {uploading ? "…" : canSubmit ? "ok" : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {recordError && (
                <p className="border border-neutral-900 bg-white px-3 py-2 text-sm text-neutral-900">
                  {recordError}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full border border-black bg-black py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500 sm:w-auto sm:px-8"
              >
                {uploading
                  ? "Saving and transcribing…"
                  : "Save and transcribe"}
              </button>
            </form>
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  Library
                </h2>
                <p className="mt-1 text-base font-medium">Notes</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Search by username.
                </p>
              </div>
              <div className="text-right text-xs text-neutral-500">
                Active
                <div className="mt-0.5 font-medium text-neutral-900">
                  {feedUsername.trim() || "—"}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <label className="block flex-1">
                <span className={labelClass}>Username</span>
                <input
                  id="feed-username"
                  type="text"
                  value={feedUsername}
                  onChange={(e) => setFeedUsername(e.target.value)}
                  className={inputClass}
                  placeholder="Username"
                />
              </label>
              <button
                type="button"
                onClick={() => fetchNotes(feedUsername)}
                disabled={loadingNotes}
                className="border border-black bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-neutral-50 disabled:opacity-40 sm:self-end"
              >
                {loadingNotes ? "Loading…" : "Search"}
              </button>
            </div>

            <label className="mt-4 block max-w-md">
              <span className={labelClass}>Playback voice</span>
              <select
                value={selectedVoiceName}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedVoiceName(v);
                  window.localStorage.setItem(LAST_TTS_VOICE_KEY, v);
                }}
                className={`${inputClass} cursor-pointer bg-white`}
              >
                {TTS_VOICE_OPTIONS.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>

            {notesError && (
              <p className="mt-4 border border-neutral-900 bg-white px-3 py-2 text-sm">
                {notesError}
              </p>
            )}

            <div className="mt-6 space-y-4">
              {notes.map((note) => (
                <article
                  key={note.id}
                  className="border border-neutral-200 bg-white p-4"
                >
                  {editingNoteId === note.id && noteDraft ? (
                    <>
                      <div className="space-y-3">
                        <label className="block">
                          <span className={labelClass}>Username</span>
                          <input
                            type="text"
                            value={noteDraft.username}
                            onChange={(e) =>
                              setNoteDraft((current) =>
                                current
                                  ? { ...current, username: e.target.value }
                                  : current,
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Title</span>
                          <input
                            type="text"
                            value={noteDraft.title}
                            onChange={(e) =>
                              setNoteDraft((current) =>
                                current
                                  ? { ...current, title: e.target.value }
                                  : current,
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Transcript</span>
                          <textarea
                            value={noteDraft.transcript}
                            onChange={(e) =>
                              setNoteDraft((current) =>
                                current
                                  ? { ...current, transcript: e.target.value }
                                  : current,
                              )
                            }
                            rows={5}
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-neutral-100 pt-4">
                        <p className="max-w-[min(100%,20rem)] truncate text-xs text-neutral-400">
                          {note.audioStorageUri}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={savingNoteId === note.id}
                            className="border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveNote(note.id)}
                            disabled={savingNoteId === note.id}
                            className="border border-black bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                          >
                            {savingNoteId === note.id ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-neutral-900">
                            {note.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {note.username}
                          </p>
                        </div>
                        <time className="text-xs text-neutral-500">
                          {formatDate(note.createdAt)}
                        </time>
                      </div>
                      <div className="mt-3 border border-neutral-100 bg-neutral-50 p-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                          Transcript
                        </p>
                        <div className="max-h-36 overflow-y-auto text-sm leading-relaxed text-neutral-700">
                          {note.transcript || (
                            <span className="text-neutral-400">(empty)</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                        <p className="max-w-[min(100%,18rem)] truncate text-xs text-neutral-400">
                          {note.audioStorageUri}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(note)}
                            className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNote(note)}
                            disabled={deletingNoteId === note.id}
                            className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-40"
                          >
                            {deletingNoteId === note.id ? "…" : "Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => playTranscript(note.id, note.transcript)}
                            disabled={!note.transcript?.trim() || playingNoteId !== null}
                            className="border border-black bg-black px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
                          >
                            {playingNoteId === note.id ? "Playing…" : "Listen"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>

            {!loadingNotes && notes.length === 0 && !notesError && (
              <p className="mt-8 border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
                No notes. Search or save a recording first.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
