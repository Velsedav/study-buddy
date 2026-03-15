# StudyB — Smart Study Companion

A desktop study app built with Tauri + React. Manage subjects, run Pomodoro sessions, track spaced repetition reviews, and study interactive lessons — all in one place.

## Download

Grab the latest release for your platform from the [Releases page](../../releases).

| Platform | File |
|---|---|
| Windows | `.msi` or `.exe` |
| macOS (Apple Silicon) | `.dmg` |
| Linux | `.AppImage` or `.deb` |

## Installation

### Windows
Download the `.msi` or `.exe` installer and run it.

### macOS
1. Download the `.dmg` disk image
2. Open it and drag **StudyB** to your Applications folder
3. Launch from Applications

> **"App is damaged and can't be opened"?**
> This happens because the app isn't signed with an Apple Developer certificate. To fix it, open **Terminal** and run:
> ```bash
> xattr -cr /Applications/StudyB.app
> ```
> Then try launching again.

### Linux
- **AppImage**: Download, make executable, then run:
  ```bash
  chmod +x StudyB_*.AppImage
  ./StudyB_*.AppImage
  ```
- **Debian/Ubuntu**: Install with:
  ```bash
  sudo dpkg -i StudyB_*.deb
  ```

## Features

- **Dashboard** — daily overview, streaks, study stats
- **Subjects** — organize topics with tags and cover images
- **Pomodoro Planner** — drag-and-drop session scheduling with priority flags
- **Learning Center** — interactive lessons with quizzes and spaced repetition (SRS)
- **Analytics** — heatmaps, session history, technique tracking
- **Themes** — Sailor Moon, Terminal, Neumorphism, Neobrutalism, Honey Lemon, and more
- **i18n** — English, French, Spanish, Indonesian, Simplified & Traditional Chinese

## Development

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run tauri dev

# Build for production
npm run tauri build
```

Requires [Node.js 20+](https://nodejs.org) and [Rust stable](https://rustup.rs).
