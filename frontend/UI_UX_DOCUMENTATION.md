# OverTheWire CyberBandit CTF - Frontend UI/UX Documentation

This document provides a comprehensive overview of the **UI/UX Enhancements** implemented on the `Dhruv` branch for the OverTheWire CyberBandit CTF frontend application (`frontend/`).

---

## 🎨 Overview of UI/UX Enhancements

The frontend application has been upgraded with a retro-futuristic hacker aesthetic, interactive terminal controls, multiple color themes, cheat sheet modal tools, and developer preview conveniences while maintaining **100% compatibility** with the underlying backend Socket.IO architecture and database task models.

---

## 🌟 Key Features & Enhancements Applied

### 1. 🖥️ Interactive Theme Selector
* **Location**: Top Navigation Header (`Header` -> Theme Dropdown)
* **Description**: Allows users to switch color schemes dynamically across the entire UI and terminal.
* **Available Themes**:
  * **Matrix Green (Default)**: Deep dark green matrix vibe (`#00ff66` neon accents).
  * **Cyber Neon**: Vibrant cyan & magenta cyberpunk aesthetic (`#00f3ff` accents).
  * **Hacker Amber**: Retro golden amber CRT monitor style (`#fbbf24` accents).
  * **Dark Slate**: Sleek dark slate blue modern theme (`#38bdf8` accents).
* **Technical Implementation**:
  * CSS variables defined in [`src/index.css`](file:///Users/dhruvmehta/ORGoverthewire/frontend/src/index.css) under root classes (`.theme-matrix-green`, `.theme-cyber-neon`, `.theme-hacker-amber`, `.theme-dark-slate`).
  * Dynamic `xterm.js` theme updates in real-time (`background`, `foreground`, `cursor`, `selectionBackground`).

---

### 2. 📖 High-Tech Linux CLI Cheat Sheet Modal
* **Location**: Top Navigation Header (`📖 Cheat Sheet` Button)
* **Description**: An accessible, high-tech reference modal containing Linux command cheatsheets designed for CTF players and freshers.
* **Command Categories Included**:
  1. **📁 File System & Navigation**: `pwd`, `ls -la`, `cd folder`, `cd ..`
  2. **📄 Reading & Searching Files**: `cat readme.txt`, `cat ./-`, `cat "file with spaces"`, `grep 'keyword' data.txt`
  3. **🔍 Finding & Type Inspection**: `file ./inhere/*`, `find inhere -type f -size 1033c`, `sort data.txt | uniq -u`
  4. **🔐 Encodings, Strings & Network**: `base64 -d encoded.txt`, `tr 'A-Za-z' 'N-ZA-Mn-za-m'`, `strings data.dat | grep '='`, `nc localhost 1337`
* **Interactive Utility**:
  * Every command card includes a **1-click Copy button (`📋`)**.
  * Clicking copy copies the command to the user's clipboard and automatically types it into the active xterm input prompt!

---

### 3. 🎯 Header Controls & Top Navigation
* **Location**: Fixed Top Navigation Bar
* **Components**:
  * **Branding Badge**: `OVERTHEWIRE CYBERBANDIT` (*Fresher Linux CTF Edition*).
  * **Room Badge**: `👤 ROOM: TEAM: <NAME>` showing the active team room profile.
  * **Real-Time Elapsed Timer**: `🔴 ELAPSED: mm:ss` live counter tracking session duration.
  * **User Profile Pill**: `🥷 <USERNAME>` with direct Logout action.
  * **Cheat Sheet Modal Trigger**: `📖 Cheat Sheet`.
  * **Password Vault Modal Trigger**: `🔑 Vault` showing solved mission flags & keys.
  * **Audio Toggle**: `🔊` / `🔇` toggling UI keystroke sound feedback.
  * **Theme Picker Dropdown**: `🖥️ <THEME_NAME> ↕`.
  * **Red Admin Button**: `🔒 ADMIN` providing instant access to the Super Admin Panel.

---

### 4. ⚡ Instant Guest Preview Mode
* **Location**: Auth Panel (`Join Team` / `Sign In` Modal)
* **Description**: Added an `⚡ Instant Guest Preview` button directly on the authentication cards.
* **Purpose**: Enables developers, testers, and reviewers to instantly bypass authentication and launch the full interactive CTF dashboard & terminal interface with zero database setup required.

---

## 🛠️ File Structure & Implementation Summary

```
frontend/
├── UI_UX_DOCUMENTATION.md      # This documentation file
├── package.json                # React, Vite, Socket.io, xterm.js dependencies
├── index.html                  # Google Fonts (JetBrains Mono, Fira Code, Share Tech Mono)
└── src/
    ├── App.tsx                 # Main application logic, theme state, socket listeners & layout
    ├── index.css               # Design tokens, CSS glassmorphism, theme classes & scrollbars
    └── main.tsx                # Application mount point
```

---

## 🚀 How to Run the Frontend Locally

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local Vite development server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   Open [http://localhost:3000/](http://localhost:3000/) in your browser.

---

## 📝 Git Branch Information

* **Repository**: `https://github.com/wtfnixin/overthewire.git`
* **Branch**: `Dhruv`
* **Scope**: All modifications are contained strictly within the `frontend/` directory.
