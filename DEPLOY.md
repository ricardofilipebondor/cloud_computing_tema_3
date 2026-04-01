# Deploy YourVoiceYourNotes pe Google App Engine (Standard)

## Înainte de deploy

1. **Proiect GCP** cu facturare activă.
2. **API-uri activate**: Cloud Storage, Firestore, Speech-to-Text, Text-to-Speech.
3. **Bucket** pentru audio (același proiect ca Speech-to-Text pentru `gs://`).
4. **Firestore** creat (mod Native).
5. Editează `app.yaml`: înlocuiește `YOUR_GCP_PROJECT_ID` și `YOUR_BUCKET_NAME` cu valorile tale.

## Cont de serviciu App Engine

Pe App Engine **nu** folosești fișier JSON local. Aplicația rulează ca **App Engine default service account**:

`PROJECT_ID@appspot.gserviceaccount.com`

În **IAM**, acordă acestui cont (sau contului din **App Engine → Settings → Service account**) roluri, de exemplu:

- `Storage Object Admin` pe bucket (sau rol mai restrâns pe obiecte)
- `Cloud Datastore User` (Firestore)
- utilizator cu API-urile Speech și Text-to-Speech activate (de obicei merge cu roluri de tip Editor pe proiect pentru laborator; în producție folosește roluri minime)

## Build pe App Engine

- `gcp-build` din `package.json` rulează `next build`.
- `build_env_variables.GOOGLE_NODE_RUN_SCRIPTS: ""` evită să ruleze automat `npm run build` de două ori.
- După build, App Engine reinstalează doar `dependencies` pentru runtime.

## Comenzi

Din folderul proiectului (`tema_3`), cu [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) instalat:

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud app deploy
```

La final primești un URL de forma `https://YOUR_PROJECT_ID.uc.r.appspot.com` (sau domeniu personalizat dacă îl configurezi).

## Verificări după deploy

- Deschide URL-ul în HTTPS (microfonul necesită context sigur).
- Dacă apare 502/timeout: verifică logurile: `gcloud app logs tail -s default`.
- Dacă Speech/Firestore dau erori: verifică API activate și rolurile service account-ului App Engine.

## Alternativă: Cloud Run

Pentru aplicații Next.js, Google recomandă adesea **Cloud Run** (containere). App Engine Standard rămâne valid pentru tema de curs dacă este cerut explicit `app.yaml`.
