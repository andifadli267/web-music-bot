# Bondage Club - Standalone Music DJ Character Bot

Bot karakter mandiri (avatar akun tersendiri) untuk **Bondage Club (R132+)** & **BC-Desktop** yang berdiri 24/7 di dalam chat room sebagai **Music DJ Room**.

> [!IMPORTANT]
> **Terdengar oleh SEMUA ORANG di Room Tanpa Addon Apapun!**  
> Bot ini memanfaatkan fitur native room resmi game (**Bondage Club Room Customization `Custom.MusicURL`**). Setiap kali lagu/radio diputar atau diganti, server Bondage Club secara otomatis menyiarkan audio ke **semua pemain yang ada di dalam room** sehingga musik terdengar langsung di speaker/headset setiap pemain tanpa pemain lain harus menginstall addon atau ekstensi apapun!

---

## 🚀 Keunggulan Karakter Bot Mandiri (`headless-bot/`)

- **Bukan Addon Pemain**: Karakter utama Anda di BC-Desktop bebas bermain normal tanpa script/addon DJ di karakter Anda. Bot berjalan di background sebagai karakter avatar terpisah.
- **Lagu Didengar Semua Orang**: Musik room otomatis tersinkronisasi untuk seluruh pengunjung room via server resmi BC.
- **Animasi Wajah & Gerak Otomatis**: Karakter bot berkedip, tersenyum, berjoget (`!dance`), dan bernyanyi (`!sing`) mengikuti alunan musik.
- **Sapa Pengunjung Otomatis (Auto-Welcome)**: Bot otomatis menyapa dan menyambut setiap pemain baru yang bergabung ke room.
- **Kendalikan Via Chat**: Siapapun di room dapat meminta stasiun radio atau lagu menggunakan perintah chat sederhana.

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
| `!radio <genre>` | `!radio synth` | Mengganti musik room untuk **semua orang** |
| `!play <url.mp3>` | `!play https://.../lagu.mp3` | Memutar link MP3 kustom untuk seluruh room |
| `!stop` | `!stop` | Menghentikan musik room untuk semua orang |
| `!np` | `!np` | Mengumumkan stasiun/lagu yang sedang diputar di room |
| `!dance` | `!dance` | Karakter bot berjoget dan berdisko di tengah room 💃 |
| `!sing` | `!sing` | Karakter bot bernyanyi di chat mikrofon room 🎤 |
| `!admin` | `!admin` | Memberikan hak Room Admin kepada Anda |

---

## 🛠️ Cara Menjalankan Karakter Bot Mandiri

1. Buka folder `headless-bot/`:
   ```bash
   cd e:\project\web-music-bot\headless-bot
   ```
2. Pastikan file konfigurasi `.env` sudah sesuai:
   ```env
   BC_SERVER_URL=https://bondage-club-server.herokuapp.com/
   BC_BOT_USERNAME=Nava1
   BC_BOT_PASSWORD=yondaime
   BC_TARGET_ROOM=V Lounge
   BC_ROOM_PASSWORD=
   ```
3. Jalankan bot:
   - Klik ganda **`start-bot.bat`**, atau
   - Jalankan perintah: `node bot.js`
4. Buka game **Bondage Club** dengan akun utama Anda, cari dan masuklah ke room: **`V Lounge`**. Anda akan langsung bertemu dengan bot **Nava** dan mendengar alunan musik yang sedang diputar!
