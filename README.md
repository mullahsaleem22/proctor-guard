# 🛡️ ProctorGuard - Free & Open-Source Exam Proctoring Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Web APIs](https://img.shields.io/badge/Web%20APIs-Fullscreen%20%7C%20Visibility-indigo.svg)](https://developer.mozilla.org/en-US/)
[![Cost](https://img.shields.io/badge/Cost-100%25%20Free%20%26%20Open%20Source-emerald.svg)]()

**ProctorGuard** is a modern, lightweight, **100% free and open-source** web-based online examination and automated proctoring platform. It requires **zero paid software or backend servers** and can be hosted for **$0 cost** on GitHub Pages, Vercel, or Netlify.

---

## 🌟 Key Open-Source Features

- **⏱️ Stopwatch & Countdown Timer**: Dynamic timing system with visual warning indicators (yellow/red) and automatic test submission on timeout.
- **🖥️ Screen & Tab Switch Protection**:
  - **Fullscreen API**: Forces the browser into Fullscreen mode upon starting an exam. Exiting mode logs a strike.
  - **Tab & Window Switch Monitor**: Detects tab switches and focus loss using `visibilitychange` & `blur` events.
  - **Focus Obfuscation Screen**: Instantly hides and blurs exam text when window focus is lost.
- **📸 Anti-Screenshot & Anti-Copy Protection**:
  - Blocks `PrintScreen` (PrtScn), `F12` (DevTools), `Ctrl+C`, `Ctrl+V`, `Ctrl+P`, `Ctrl+S`, `Ctrl+U`, and `Ctrl+Shift+I`.
  - Context menu (`contextmenu`) and text selection (`user-select: none`) disabled.
  - Dynamic **Canvas Security Watermark** displaying student name, ID, and live timestamp to discourage physical photo taking.
- **📋 Strike Violation Audit Log**: Tracks cheating attempts with auto-submit on reaching 3 strikes.
- **📊 Examiner Dashboard**: View real-time security incident logs, timestamped strikes, and student scores.

---

## 🚀 How to Run Locally (Free Setup)

No paid dependencies are required. Standard Node.js / NPM is used for local preview.

### Option A: Standard Browser (Zero Install)
Simply double click [`index.html`](file:///C:/Users/mulla/.gemini/antigravity/scratch/exam-proctor-app/index.html) or open it directly in Chrome, Firefox, or Edge.

### Option B: Modern Vite Development Mode
```bash
# 1. Clone the repository
git clone https://github.com/your-username/proctor-guard.git
cd proctor-guard

# 2. Install dependencies (Vite)
npm install

# 3. Start high-speed local dev server
npm run dev
```

---

## 🌐 How to Host Online for $0 (Free of Cost)

### 1. Free GitHub Pages Hosting (Automated)
This repository includes a pre-configured GitHub Actions workflow at `.github/workflows/deploy.yml`:
1. Create a public repository on GitHub named `proctor-guard`.
2. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial open source release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/proctor-guard.git
   git push -u origin main
   ```
3. Go to **Repository Settings -> Pages -> Source**, select **GitHub Actions**. Your app will automatically build and publish at `https://YOUR_USERNAME.github.io/proctor-guard/` completely free of charge!

### 2. Free Vercel / Netlify Hosting
Drag and drop the project folder onto [Vercel](https://vercel.com) or [Netlify](https://netlify.com) for instant free SSL hosting.

---

## 📄 Open Source License

This project is open-source and released under the [MIT License](LICENSE). You are free to use, modify, distribute, and commercialize this software at zero cost.
