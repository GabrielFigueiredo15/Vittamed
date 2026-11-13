# Vittamed

Mobile app that helps older adults organize their daily medication routine.
Built for the *T197 – Mobile Platform Development* course at Universidade de Fortaleza (Unifor).

> Vittamed supports medication routine organization. It does **not** replace
> guidance from doctors, pharmacists or nurses.

## Overview

Each account represents a single patient and can be shared with relatives and
caregivers through the same e-mail and password. The first version does not include
access for health professionals, medical appointments or other health signals.

### Features

- **Account**: sign up, log in / log out, password recovery (e-mail and password).
- **Medications**: create, list, edit and delete medications with name, dosage,
  form of use, schedule, weekdays, treatment period, notes and package photo.
- **Schedules**: fixed times, intervals and specific weekdays.
- **Reminders**: notifications for scheduled doses; each dose can be marked as
  *taken*, *not taken* or *postponed* (with a new time).
- **History**: daily list and monthly calendar of taken, missed and postponed doses.
- **Instructions**: usage instructions linked to a medication, with validity
  period and a "completed" option.
- **AI assistant**: text assistant for questions about registered medications.
  It never gives clinical advice (dosage, interactions, side effects, stopping or
  changing a treatment) and redirects the user to a doctor or pharmacist.
- **Accessibility**: large buttons, readable fonts, good contrast and adjustable
  text size, with short navigation paths.

## Tech stack

| Layer | Technology |
|---|---|
| Mobile app | React Native (Expo), TypeScript |
| Notifications | `expo-notifications` |
| Tests | Jest, Testing Library |
| Backend API | Python, FastAPI (`Gate_Mobile_Vitamed/`) |
| Authentication | Firebase Authentication |
| Database | Firebase (Firestore) |
| AI | NVIDIA chat completions API |

## Repository structure

```
.
├── src/                      # Mobile app (React Native / Expo)
│   ├── App.tsx               # Navigation and routes
│   ├── interface/            # Screens, app state, UI components, AI assistant
│   └── notificacoes/         # Reminder scheduling and notifications
├── scripts/                  # Helper scripts
├── Gate_Mobile_Vitamed/      # Backend API (FastAPI)
│   ├── main.py               # App entry point, AI chat endpoint
│   ├── routers/              # auth, profile, medications, doses, instructions
│   ├── models.py             # Request/response schemas
│   └── CONTRATO.md           # API contract (in Portuguese)
└── package.json
```

## Getting started

### Requirements

- Node.js 20+ and npm
- A physical Android device or an Android emulator
- [`uv`](https://docs.astral.sh/uv/) and Python 3.13+ (only to run the backend locally)

### Run the mobile app

```bash
npm install
npm run android      # build and run on a connected device / emulator
```

Other scripts:

```bash
npm start            # start the Expo dev server
npm run dev          # run the web version with Vite
npm test             # run the test suite
npm run typecheck    # TypeScript type checking
```

### Run the backend

```bash
cd Gate_Mobile_Vitamed
uv sync
uv run fastapi dev
```

The API is served at http://localhost:8000 and the interactive docs at
`/docs`. The backend needs these environment variables:

| Variable | Description |
|---|---|
| `FIREBASE_CREDENTIALS` | Firebase service account JSON (or a path to it) |
| `FIREBASE_API_KEY` | Firebase web API key, used for sign-up and login |
| `NVIDIA_API_KEY` | API key for the AI assistant |
| `PAUSE` | Optional. Set to `1` to make the API answer `503` ("paused") |

Never commit credentials. Secrets must stay in environment variables or in
files that are listed in `.gitignore`.

## API overview

All routes except `/auth/*` require `Authorization: Bearer <id_token>`.
Data is isolated per user.

| Area | Routes |
|---|---|
| Auth | `POST /auth/registrar`, `/auth/login`, `/auth/recuperar-senha`, `/auth/refresh` |
| Profile | `GET`, `PUT`, `PATCH /perfil` |
| Medications | `/medicamentos` (create, list, get, update, delete) |
| Doses | `/doses` (create, list, get, update, delete) |
| Instructions | `/orientacoes` (create, list, get, update, delete) |
| AI assistant | `POST /chat` |

The full contract is in [`Gate_Mobile_Vitamed/CONTRATO.md`](Gate_Mobile_Vitamed/CONTRATO.md).

## Team

- Gabriel Figueiredo
- Gabriella Martins
- Fernando Bezerra
- Breno Bezerra
- Bruno Gonçalves

## License

Academic project. Add a license here if the team decides to publish one.
