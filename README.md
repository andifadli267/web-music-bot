# Bondage Club - Standalone Music DJ Character Bot

Bot karakter mandiri (avatar akun tersendiri) untuk **Bondage Club (R132+)** ([https://www.bondage-asia.com/club/R132/](https://www.bondage-asia.com/club/R132/)) dan **BC-Desktop** yang bergabung ke ruangan private **V Main Hall** sebagai **Music DJ Room**.

> [!IMPORTANT]
> **Terdengar oleh SEMUA ORANG di Ruangan Tanpa Addon Apapun!**  
> Bot ini memanfaatkan fitur native room resmi game (**Bondage Club Room Customization `Custom.MusicURL`**). Setiap kali lagu/radio diputar atau diganti, server Bondage Club secara otomatis menyiarkan audio ke **semua pemain yang ada di dalam room**, sehingga musik berputar serempak di speaker/headset setiap pemain tanpa siapapun harus memasang addon atau ekstensi!

---

## 🚀 Keunggulan Karakter Bot Mandiri (`headless-bot/`)

- **Bukan Addon Pemain**: Karakter utama Anda di BC-Desktop bebas bermain normal tanpa script/addon DJ di karakter Anda. Bot berjalan di background sebagai karakter avatar terpisah.
- **Bergabung ke Ruangan Private**: Dikonfigurasi otomatis untuk terhubung ke ruangan private **`V Main Hall`**.
- **Lagu Didengar Semua Orang**: Musik room otomatis tersinkronisasi untuk seluruh pengunjung room via server resmi game.
- **Animasi Wajah & Gerak Otomatis**: Karakter bot berkedip, tersenyum, berjoget (`!dance`), dan bernyanyi (`!sing`) mengikuti alunan musik.
- **Sapa Pengunjung Otomatis (Auto-Welcome)**: Bot otomatis menyambut setiap pemain yang bergabung ke room.
- **Auto-Join via Beep**: Cukup kirim Beep ke nomor bot (**`#258115`**) dari dalam room, dan bot akan langsung melangkah masuk ke room Anda.

---

## 📻 Daftar Stasiun Radio Room (Format MP3 Resmi BC)

| ID | Nama Stasiun | Genre | Perintah Chat |
| :--- | :--- | :--- | :--- |
| `lofi` | Lo-Fi Chill Beats | Chill / Study ☕ | `!radio lofi` |
| `synth` | Nightride FM | Synthwave / Cyberpunk 🕹️ | `!radio synth` |
| `chillsynth` | Chillsynth FM | Chillwave / Retrowave 🌌 | `!radio chillsynth` |
| `pop` | Top 40 Pop Hits | Top Pop Hits 🎧 | `!radio pop` |
| `dance` | Club Dance & EDM | Club / Dance 💃 | `!radio dance` |
| `rock` | Rock Nonstop | Rock & Alternative 🎸 | `!radio rock` |
| `hiphop` | Hip Hop Beats | Hip Hop / Rap 🎤 | `!radio hiphop` |
| `jazz` | Swiss Jazz & Lounge | Cafe Jazz & Lounge 🎷 | `!radio jazz` |

---

## 💬 DJ Character Chat Commands (English Interface)

| Command | Example | Description |
| :--- | :--- | :--- |
| `!help` / `!music` | `!help` | Displays command list and available radio stations |
| `!yt <link/title>` | `!yt https://youtu.be/...` | Converts YouTube track to MP3, uploads to `tmpfile.link`, and plays or queues it |
| `!queue` / `!q` | `!queue` | Displays currently playing track and upcoming songs (up to 10 in queue) |
| `!skip` / `!next` | `!skip` | Skips current song and immediately plays next track in queue |
| `!clear` | `!clear` | Clears all upcoming songs from queue |
| `!radio <genre>` | `!radio synth` | Switches to 24/7 radio stream (e.g. lofi, synth, pop, rock, jazz) |
| `!play <url.mp3>` | `!play https://.../song.mp3` | Plays custom MP3 audio or adds it to queue |
| `!stop` | `!stop` | Stops room music and clears queue |
| `!np` | `!np` | Announces current song or radio station |
| `!whitelist <id>` | `!whitelist 254143` | **Room Admin only**: Adds a player to the private room Whitelist |
| `!dance` | `!dance` | Character dances in the DJ booth |
| `!sing` | `!sing` | Character sings along into the DJ mic |

---

## 📁 Local Storage & Audio Conversion Workflow

1. **Dedicated Conversion Folder (`converted_tracks/`)**:
   - All intermediate and downloaded files are processed in a dedicated project directory: `e:\project\web-music-bot\converted_tracks`.
   - Users can directly view this folder to verify that temporary files are properly created during conversion and **automatically deleted** immediately after upload and playback.
2. **Audio Conversion**:
   - Supports conversion via [ytmp3.gg](https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo) with automatic fallback to high-speed local extraction (`yt-dlp` + `ffmpeg-static`).
3. **Cloudflare CDN Hosting**:
   - Converted MP3 files are uploaded to [tmpfile.link](https://tmpfile.link/index-id) (Cloudflare R2 storage).
4. **Auto Clean-Up**:
   - Local audio files are unlinked from `converted_tracks/` immediately after upload into memory/CDN, keeping your computer storage completely clean.

---

## 🛠️ Cara Menjalankan Karakter Bot

1. Buka folder `headless-bot/`:
   ```bash
   cd e:\project\web-music-bot\headless-bot
   ```
2. Konfigurasi file `.env`:
   ```env
   BC_SERVER_URL=https://www.bondage-asia.com
   BC_BOT_USERNAME=Nava1
   BC_BOT_PASSWORD=yondaime
   BC_TARGET_ROOM=V Main Hall
   BC_ROOM_PASSWORD=
   ```
3. Jalankan bot:
   - Klik ganda **`start-bot.bat`**, atau
   - Jalankan perintah: `node bot.js`
4. Buka game **Bondage Club** ([https://www.bondage-asia.com/club/R132/](https://www.bondage-asia.com/club/R132/)) atau lewat **BC-Desktop**.
5. Masuk ke ruangan private **`V Main Hall`**. Pastikan nomor member bot (**`258115`** / Nava) telah dimasukkan ke dalam **Whitelist** room (atau kirim Beep ke `#258115` dari dalam room) agar bot langsung masuk!
