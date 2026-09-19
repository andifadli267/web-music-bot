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

## 💬 Daftar Perintah Chat Karakter DJ

| Perintah | Contoh | Efek Musik & Karakter |
| :--- | :--- | :--- |
| `!help` / `!music` | `!help` | Menampilkan panduan dan daftar stasiun radio |
| `!yt <link/judul>` | `!yt https://youtu.be/...` | **Otomatis konversi video YouTube ke MP3** & diupload ke `tmpfile.link` untuk diputar ke seluruh room! 🎶 |
| `!radio <genre>` | `!radio synth` | Mengganti musik room untuk **semua orang** |
| `!play <url.mp3>` | `!play https://.../lagu.mp3` | Memutar link MP3 kustom untuk seluruh room |
| `!stop` | `!stop` | Menghentikan musik room untuk semua orang |
| `!np` | `!np` | Mengumumkan stasiun/lagu yang sedang diputar di room |
| `!dance` | `!dance` | Karakter bot berjoget dan berdisko di tengah room 💃 |
| `!sing` | `!sing` | Karakter bot bernyanyi di chat mikrofon room 🎤 |
| `!admin` | `!admin` | Memberikan hak Room Admin kepada Anda |

---

## 🎵 Alur Konversi & Hosting Lagu YouTube

Bot mengintegrasikan alur pemutaran musik otomatis:
1. **Konverter Audio**: Mendukung integrasi konversi YouTube ke MP3 via layanan [ytmp3.gg](https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo) dengan fallback otomatis ke engine lokal berkecepatan tinggi (`yt-dlp` + `ffmpeg`).
2. **Hosting Direct CDN Cloudflare**: MP3 hasil konversi diunggah secara otomatis ke layanan [tmpfile.link](https://tmpfile.link/index-id) (menggunakan storage backend Cloudflare R2).
3. **URL Kompatibel Bondage Club**: Menghasilkan link direct berakhiran `.mp3` dengan panjang ringkas (< 120 karakter, jauh di bawah limit game 250 karakter) sehingga langsung dapat dimuat dan diputar secara serempak oleh audio engine game untuk setiap pemain di dalam room.

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
