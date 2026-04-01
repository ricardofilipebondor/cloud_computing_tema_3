import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";
import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

const projectId = process.env.GCP_PROJECT_ID;

export const firestore = new Firestore({
  projectId,
});

export const storage = new Storage({
  projectId,
});

export const speechClient = new SpeechClient({
  projectId,
});

export const textToSpeechClient = new TextToSpeechClient({
  projectId,
});
