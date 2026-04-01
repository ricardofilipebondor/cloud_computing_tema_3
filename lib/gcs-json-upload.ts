import { GoogleAuth } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/devstorage.read_write"];

/**
 * Simple media upload — avoids @google-cloud/storage streams that break under Next.js dev.
 * Same credentials as ADC (GOOGLE_APPLICATION_CREDENTIALS / GCP_PROJECT_ID).
 */
export async function uploadObjectSimpleMedia(params: {
  bucket: string;
  objectPath: string;
  buffer: Buffer;
  contentType: string;
}): Promise<void> {
  const auth = new GoogleAuth({
    projectId: process.env.GCP_PROJECT_ID,
    scopes: SCOPES,
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("No access token for Cloud Storage (check credentials).");
  }

  const qs = new URLSearchParams({
    uploadType: "media",
    name: params.objectPath,
  });
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
    params.bucket,
  )}/o?${qs.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": params.contentType,
      "Content-Length": String(params.buffer.length),
    },
    body: new Uint8Array(params.buffer),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Cloud Storage upload failed (${res.status}): ${detail.slice(0, 800)}`,
    );
  }
}
