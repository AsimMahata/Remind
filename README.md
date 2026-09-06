# Remind - Minimal Android Reminder App

A minimal, fast, offline-first Android reminder app built with **React Native + Expo**, **TypeScript**, **AsyncStorage**, **Expo Notifications**, and **Android Text-to-Speech (TTS)**.

---

## 📱 Features

- **Android-First Visual Language**: Deep navy background (`#042236`), bright blue top app bar (`#0078B7`), clean card layouts, large readable typography, and floating action button.
- **Sectioned List**:
  - **Overdue** (coral red highlight)
  - **Today** (cyan highlight)
  - **Upcoming** (sky blue highlight)
  - **Completed** (strikethrough & archive)
- **Local Persistence**: Reminders & settings persist across app restarts using AsyncStorage.
- **Instantaneous Search**: Live keyword search filtering through your tasks instantly.
- **Local Notifications**: Scheduled at exact reminder time with Android Notification Channel.
- **Notification Actions**:
  - `[✓ FINISH]`: Completes reminder immediately.
  - `[⏳ +15 MIN]`: Postpones reminder by 15 minutes.
  - `[⏰ +1 HOUR]`: Postpones reminder by 1 hour.
- **Postpone Flow**: Easily postpone tasks for 15 min, 30 min, 1 hour, tomorrow morning (9 AM), or custom date & time.
- **Voice Reminders (TTS)**: Spoken reminder aloud using system Text-to-Speech (`"Reminder. <Task text>"`).
- **Quick Task Bar**: Fast input line with mic button and FAB at the bottom.
- **Zero Cloud / Backend**: Completely private and offline-first.

---

## 🛠️ Project Structure

```
todo-list/
├── App.tsx                      # Root component & screen router
├── app.json                     # Expo configuration & Android permissions
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript configuration
├── constants/
│   └── theme.ts                 # Colors, typography & layout constants
├── types/
│   └── reminder.ts              # Reminder, Section & Settings data types
├── services/
│   ├── storage.ts               # AsyncStorage local persistence
│   ├── tts.ts                   # Android Text-to-Speech service
│   ├── notifications.ts         # Expo local notification scheduling & actions
│   └── reminders.ts             # Core business logic & section organizer
├── components/
│   ├── Header.tsx               # Android top app bar with actions & menu
│   ├── ReminderCard.tsx         # Task card with checkbox, badge, speak & snooze
│   ├── QuickTaskBar.tsx         # Bottom quick input & circular FAB
│   ├── DateTimePickerModal.tsx  # Android Date & Time picker dialog
│   ├── PostponeModal.tsx        # Postpone modal dialog
│   └── MenuDropdown.tsx         # 3-dots overflow action menu
└── screens/
    ├── HomeScreen.tsx           # Main reminders screen with search & sections
    ├── AddReminderScreen.tsx    # "New Task" creation screen
    └── SettingsScreen.tsx       # Notifications, Voice TTS & app preferences
```

---

## 🚀 How to Run

Run the following commands in your terminal from this directory:

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Expo Development Server
```bash
npx expo start
```

### 3. Running on Android
- **Android Device**: Scan the QR code using the **Expo Go** app on your Android phone.
- **Android Emulator**: Press `a` in the terminal.
- **Web Preview**: Press `w` in the terminal to view on your browser.

---

## 📦 Building Standalone Android APK

You can build a standalone `.apk` to install directly on any Android phone (no Expo Go required):

### 1. Build and Automatically Save as `remind.apk`
Builds on EAS cloud and automatically downloads the finished APK directly to your project folder as `remind.apk`:
```bash
npx eas-cli build --platform android --profile preview --output ./remind.apk
```

### 2. Standard Cloud Build
Builds on EAS cloud and gives you a QR code and web link to download:
```bash
npx eas-cli build --platform android --profile preview
```

### 3. Download Latest Completed Build as `remind.apk`
If the build is already finished on Expo servers, download it directly without rebuilding:
```bash
npx eas-cli build:download --platform android --profile preview --output ./remind.apk
```

### 4. Check Project Health
Verify configuration and dependencies before building:
```bash
npx expo-doctor
```

