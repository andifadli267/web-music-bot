# Bondage Club: Standalone Music DJ Character Bot & Web Dashboard

A dedicated character bot and real-time web dashboard for **Bondage Club (R132+)** and **BC-Desktop**. The bot joins your room (configured by default for **`V Main Hall`**) as a live audio DJ and interactive room administrator.

> [!IMPORTANT]
> **Heard by Everyone in the Room Without Any Addons**  
> This bot utilizes the official Bondage Club room customization feature (`Custom.MusicURL`). Whenever a track or radio station is played or changed, the game server broadcasts the audio stream directly to **all players inside the room**, synchronizing playback across all speakers and headsets without requiring any player to install client scripts or browser extensions.

---

## Key Features

- **Independent Character Process (`headless-bot/`)**: Operates as a distinct avatar account in the background. Your main character on BC-Desktop is free to play normally without attaching DJ scripts or addon hooks.
- **Real-Time Web Dashboard (`http://localhost:3000`)**: Full remote control interface with real-time Server-Sent Events (SSE) updates, live player queue, animated vinyl turntable, and synchronized browser audio playback.
- **Anti-Slop Design System**:
  - High-contrast typography powered by **Source Sans Pro** (`Source Sans 3`).
  - Full WCAG AA contrast compliance (> 17:1 contrast ratio).
  - Dual theme support (Dark and Light modes) with persistent user preference.
  - Atmospheric **Cyber Club DJ Console** acoustic background with low-light scrim.
  - Fully accessible keyboard navigation and mobile-first responsive layout (minimum 44px touch targets).
- **Whisper & Beep Command Support**: Send `!play <song>` or `!adminmenu` directly in private whisper to queue tracks or manage room settings discreetly.
- **Authorized Member & Auto-Join System**: Authorized members can invite or relocate the bot instantly by sending a beep with `join here` or typing a room name.
- **24/7 Commercial Radio Stations**: Switch instantly to high-quality streaming stations (Lo-Fi, Synthwave, Pop, Rock, EDM, Jazz, Hip Hop).
- **Resilient Audio Pipeline**: Automated YouTube audio fetching with local `yt-dlp` and `ffmpeg-static` transcoding fallback, hosted through Cloudflare R2 (`tmpfile.link`) with instant local cache clean-up.

---

## 24/7 Streaming Radio Stations

| Station ID | Name | Genre | In-Game Command |
| :--- | :--- | :--- | :--- |
| `lofi` | Lo-Fi Chill Beats | Study and Relax ☕ | `!radio lofi` |
| `synth` | Nightride FM | Synthwave and Retrowave 🕹️ | `!radio synth` |
| `chillsynth` | Chillsynth FM | Ambient Chillwave 🌌 | `!radio chillsynth` |
| `pop` | Top 40 Pop Hits | Mainstream Pop Hits 🎧 | `!radio pop` |
| `dance` | Club Dance & EDM | Club and Electronic 💃 | `!radio dance` |
| `rock` | Rock Nonstop | Classic and Modern Rock 🎸 | `!radio rock` |
| `hiphop` | Hip Hop Beats | Hip Hop and Rap 🎤 | `!radio hiphop` |
| `jazz` | Swiss Jazz & Lounge | Cafe Jazz and Lounge 🎷 | `!radio jazz` |

---

## Chat & Whisper Commands

Commands work in public room chat or directly via private whisper (beep) to the bot.

| Command | Example | Description |
| :--- | :--- | :--- |
| `!help` or `!music` | `!help` | Displays available bot commands and radio station shortcuts. |
| `!play <title/URL>` | `!play Linkin Park Numb` | Plays or queues a YouTube track, search keyword, or direct MP3 audio stream. Alias: `!yt`. |
| `!queue` or `!q` | `!queue` | Displays the current track and up to 20 queued songs. |
| `!skip` or `!next` | `!skip` | Skips the current track and plays the next item in queue. |
| `!clear` | `!clear` | Empties all upcoming songs from the queue. |
| `!radio <genre>` | `!radio synth` | Switches to a 24/7 online radio station. |
| `!stop` | `!stop` | Stops audio playback and clears room music. |
| `!np` | `!np` | Announces currently playing song title and requester. |
| `!adminmenu` | `!adminmenu` | **Whisper only**: Opens private room administration menu for registered admins. |
| `!whitelist <id>` | `!whitelist 254143` | **Room Admin only**: Adds a player to the room whitelist. |
| `!kick <id>` | `!kick 12345` | **Room Admin only**: Removes a player from the room. |
| `!ban <id>` | `!ban 12345` | **Room Admin only**: Adds a player to the room banlist. |

---

## Audio Pipeline & Storage Workflow

1. **Dedicated Workspace (`converted_tracks/`)**:
   - Temporary audio files are created inside `converted_tracks/` during download and transcode steps.
2. **Dual-Engine Conversion & Transcode Fallback**:
   - The bot first checks fast remote extractors before falling back to local `yt-dlp` and `ffmpeg-static`.
   - Non-standard streams (.webm, .opus, .m4a) are automatically transcoded to 44.1kHz stereo MP3.
3. **Cloudflare CDN Distribution**:
   - Audio is uploaded to high-bandwidth Cloudflare R2 storage (`tmpfile.link`).
4. **Immediate Storage Clean-Up**:
   - Local audio chunks are automatically unlinked and purged from `converted_tracks/` immediately after upload, preventing disk clutter.

---

## Setup & Running the Bot

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or newer recommended).
- [Python 3](https://www.python.org/) (for `yt-dlp` extractor support).

### 1. Installation
Clone the repository and install required dependencies:
```bash
git clone https://github.com/andifadli267/web-music-bot.git
cd web-music-bot/headless-bot
npm install
```

### 2. Configuration (`.env`)
Create or edit `headless-bot/.env`:
```env
BC_SERVER_URL=https://www.bondage-asia.com
BC_BOT_USERNAME=Nava1
BC_BOT_PASSWORD=your_bot_password
BC_TARGET_ROOM=V Main Hall
BC_ROOM_PASSWORD=
PORT=3000
```

### 3. Launching
Run the bot via script or terminal:
- **Windows Batch**: Double-click `start-bot.bat`.
- **Node.js**:
  ```bash
  node bot.js
  ```

Once running:
- The bot logs in and connects to your configured room.
- The web dashboard will be available at **`http://localhost:3000`**.
- Add the bot's member number to your private room's Whitelist or Admin list so it can enter freely.
