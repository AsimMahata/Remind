# ⏰ Remind — Offline-First Smart Reminder System

A high-performance, offline-first reminder application built for Android with a **React Native (Expo)** mobile client, local **SQLite** storage, and a **Node.js + Express + TypeScript** cloud sync backend backed by **MongoDB Atlas**.

---

## 🌟 Highlights & Architecture

- **100% Offline-First**: Instant UI responses. All reminders are written directly to local SQLite database first. Works completely without internet or server connectivity.
- **Bi-Directional Cloud Sync**: Automatically pushes local changes and pulls updates using timestamped delta sync and revision conflict resolution.
- **Non-Intrusive Offline UX**: Zero annoying alert modals or warning banners on network loss. Sync retries quietly in the background with exponential backoff.
- **Account & Guest Mode**: Use the app completely anonymously without an account. When signing in, local reminders can be seamlessly migrated to your cloud profile.
- **Smart Time Suggestions**: Learns your habits over time to suggest intelligent reminder times based on your historical task scheduling patterns.
- **Voice TTS Announcements**: Speaks reminders aloud when triggered using system Text-to-Speech (`"Reminder: <Task Name>"`).
- **Interactive Actionable Notifications**:
  - `[✓ FINISH]`: Complete reminder directly from Android notification shade.
  - `[⏳ +15 MIN]`: Snooze by 15 minutes.
  - `[⏰ +1 HOUR]`: Snooze by 1 hour.
- **Built-in Trash & Recovery**: Soft deletion protects against accidental data loss. Recover or permanently purge items anytime.
- **Admin Dashboard**: Web dashboard for viewing system health, active users, sync metrics, and audit event logs.

```
                    ┌───────────────────────────────┐
                    │    Android Device (Mobile)    │
                    │  React Native / Expo + SQLite │
                    └───────────────┬───────────────┘
                                    │
                         HTTPS / JSON Delta Sync
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Cloud Backend (Node / TS)   │
                    │      Hosted on Render         │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     MongoDB Atlas (Cloud)     │
                    │   Users, Reminders & Events   │
                    └───────────────────────────────┘
```

---

## 📁 Repository Structure

```
todo-list/
├── app/                           # Mobile Application (React Native / Expo)
│   ├── App.tsx                    # Root component, router & life-cycle
│   ├── database/
│   │   ├── sqlite.ts              # SQLite database schema & migrations
│   │   └── reminderDao.ts         # DAO layer for local persistence & queues
│   ├── services/
│   │   ├── sync.ts                # Offline-first background sync engine
│   │   ├── api.ts                 # Universal API client with error abstraction
│   │   ├── auth.ts                # Client-side JWT auth & token storage
│   │   ├── notifications.ts       # Android notification channels & actions
│   │   ├── tts.ts                 # Text-to-Speech voice reminders
│   │   └── reminders.ts           # Core business logic & status organization
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Sectioned task list, quick add & search
│   │   ├── AddReminderScreen.tsx  # Reminder creation with time suggestions
│   │   ├── EditReminderScreen.tsx # Reminder editing & details
│   │   └── SettingsScreen.tsx     # Cloud sync status, account & voice settings
│   └── components/                # Reusable UI components & modals
│
└── backend/                       # Cloud Backend (Node.js + Express + TypeScript)
    ├── src/
    │   ├── server.ts              # Express app setup & graceful startup
    │   ├── config/
    │   │   ├── db.ts              # Mongoose MongoDB connection
    │   │   └── env.ts             # Environment variable validation
    │   ├── models/                # Mongoose models (User, Reminder, Event)
    │   ├── routes/
    │   │   ├── auth.ts            # Register, Login & Profile routes
    │   │   ├── sync.ts            # Delta sync engine endpoint
    │   │   ├── reminders.ts       # CRUD endpoints for reminders
    │   │   └── admin.ts           # Admin dashboard API & metrics
    │   └── public/admin/          # Static admin dashboard web application
    └── dist/                      # Compiled production JavaScript
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or v20 recommended)
- **npm**
- **Expo Go** app on your Android device (or an Android Emulator)
- Free **MongoDB Atlas** account (or local MongoDB)

---

### 1. Backend Setup & Local Development

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file (copy from `.env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/remind?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key_here
   CORS_ORIGIN=*
   ADMIN_EMAIL=admin@remind.local
   ADMIN_PASSWORD=YourAdminPassword123!
   ```
4. Start development server with auto-reload:
   ```bash
   npm run dev
   ```
   *The server will verify the MongoDB connection before opening port 5000.*

5. Open the Admin Dashboard:
   Navigate to `http://localhost:5000/admin` in your browser.

---

### 2. Mobile App Setup (Expo)

1. Navigate to the app directory:
   ```bash
   cd app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your API URL in `app/.env`:
   - **For Cloud Backend (e.g. Render):**
     ```env
     EXPO_PUBLIC_API_URL=https://remind-nc2b.onrender.com
     ```
   - **For Local Development (Physical Android Device):**
     ```env
     EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_LAN_IP>:5000
     ```
   - **For Android Emulator:**
     ```env
     EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
     ```
4. Start Expo:
   ```bash
   npx expo start -c
   ```
5. Run on your device:
   - **Physical Phone**: Scan the displayed terminal QR code using **Expo Go**.
   - **Emulator**: Press `a` in the terminal.

---

## ☁️ Hosting the Backend (Render)

The backend is pre-configured for zero-friction cloud deployment on [Render](https://render.com) without requiring a GitHub login:

1. **Sign up on Render**: Register at [render.com](https://render.com) using your **Email**.
2. **Create Web Service**:
   - Select **Public Git repository** and paste your repository URL.
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. **Set Environment Variables in Render**:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/remind?retryWrites=true&w=majority`
   - `JWT_SECRET`: `a_strong_random_secret_string`
   - `CORS_ORIGIN`: `*`
4. **MongoDB Atlas IP Access**:
   - In [cloud.mongodb.com](https://cloud.mongodb.com) > **Network Access**, ensure `0.0.0.0/0` ("Allow Access from Anywhere") is added so Render can communicate with your database.

---

## 📦 Standalone Android APK Build (EAS)

You can build a standalone installable APK without needing Expo Go:

### Option 1: Cloud Build (Recommended - No local Android SDK needed)
```bash
npx eas-cli build --platform android --profile preview
```
*When finished, EAS prints a direct download link and QR code to install the APK.*

### Option 2: Local Build (Requires Android Studio / SDK installed locally)
```bash
npx eas-cli build --platform android --profile preview --local --output ./remind.apk
```

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/` | Service health status | No |
| `GET` | `/health` | Server environment & timestamp | No |
| `POST` | `/auth/register` | Create a new user account | No |
| `POST` | `/auth/login` | Log in and receive JWT token | No |
| `GET` | `/auth/me` | Fetch authenticated user profile | Yes |
| `POST` | `/sync` | Bi-directional delta sync | Yes |
| `GET` | `/reminders` | Fetch all user reminders | Yes |
| `POST` | `/reminders` | Create reminder | Yes |
| `PATCH`| `/reminders/:id` | Update reminder | Yes |
| `DELETE`| `/reminders/:id` | Soft-delete reminder | Yes |
| `POST` | `/reminders/purge-deleted` | Permanently empty trash | Yes |
| `GET` | `/admin` | Web-based visual dashboard | Yes (Admin) |

---

## 📄 License
MIT License. Created for the **Remind** Project.
