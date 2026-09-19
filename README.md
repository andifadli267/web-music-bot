# Bondage Club - Music DJ Character Bot & Floating Player

Interactive In-Game **Music DJ Character Bot**, 24/7 Radio & YouTube Audio Player untuk **Bondage Club (R132+)** (`https://www.bondage-asia.com/club/R132/`) dan **BC-Desktop**.

---

## 🤖 2 Cara Menjalankan Bot Sebagai Karakter Game

### Cara 1 (Paling Mudah): In-Game Character DJ Bot (`bc-music-bot.js`)
Karakter avatar Anda di dalam game langsung bertindak sebagai **Room DJ / Music Bot**:
- **Animasi Ekspresi & Vibe Otomatis**: Karakter Anda otomatis berganti ekspresi wajah (tersenyum, berkedip, menutup mata menikmati musik, not balok musik) mengikuti irama lagu setiap beberapa detik.
- **Interaksi Karakter**: Saat pemain lain meminta lagu, karakter Anda berinteraksi dengan ekspresi senang dan berbicara di room.
- **Menari & Bernyanyi**: Dilengkapi aksi khusus `!dance` (karakter berdisko/menari di room) dan `!sing` (karakter bernyanyi).
- **Auto-Welcome Pengunjung**: Karakter DJ otomatis menyapa pemain baru yang baru saja masuk ke room (`* 🎵 [DJ] Halo [Nama]! Selamat datang di room...`).
- **Floating UI Controller**: Panel kontrol melayang di dalam game untuk mengaktifkan/menonaktifkan mode karakter bot, mengganti stasiun radio, dan mengatur volume.

**Lokasi file**:
- `c:\Users\asusR\BC-Desktop\Scripts\bc-music-bot.js` *(Langsung aktif saat membuka BC-Desktop)*
- `e:\project\web-music-bot\bc-music-bot.js` *(Untuk Tampermonkey di browser)*

---

### Cara 2: Standalone Headless Bot Account (`headless-bot/`)
Menjalankan akun bot kedua yang terpisah dari komputer/terminal (Node.js):
- Bot akan login ke akun tersendiri (misal: `DJ_LoungeBot`).
- Bot masuk dan berdiri di chat room sebagai karakter avatar tersendiri 24/7.
- Merespon chat room, mengganti ekspresi wajah avatar saat menerima perintah, dan menyiarkan status lagu.

**Cara Menjalankan Headless Bot**:
```bash
cd e:\project\web-music-bot\headless-bot
npm install
copy .env.example .env
# Edit .env dengan Akun, Password, dan Nama Room
node bot.js
```

---

## 📻 Daftar Stasiun Radio 24/7

| ID | Nama Stasiun | Genre | Perintah Chat |
| :--- | :--- | :--- | :--- |
| `lofi` | Lo-Fi Chill Beats | Chill / Study ☕ | `!radio lofi` |
| `synth` | Nightride FM | Synthwave / Cyberpunk 🕹️ | `!radio synth` |
| `chillsynth` | Chillsynth FM | Retrowave Chill 🌌 | `!radio chillsynth` |
| `anime` | LISTEN.moe Anime | Anime OST & J-Pop 🌸 | `!radio anime` |
| `kpop` | LISTEN.moe K-Pop | Korean Pop Hits ✨ | `!radio kpop` |
| `jazz` | Swiss Jazz & Lounge | Cafe Jazz 🎷 | `!radio jazz` |
| `pop` | I Love Radio Hits | Top 40 Pop 🎧 | `!radio pop` |
| `classical` | Radio Swiss Classic | Piano / Orchestra 🎻 | `!radio classical` |

---

## 💬 Perintah Chat Karakter DJ

| Perintah | Contoh | Efek Karakter & Musik |
| :--- | :--- | :--- |
| `!help` atau `!music` | `!help` | Karakter berkedip 😉 dan menampilkan bantuan |
| `!radio <genre>` | `!radio synth` | Memutar radio dan karakter tersenyum senang |
| `!play <url>` | `!play <link-mp3>` | Memutar audio custom atau resume |
| `!yt <url/ID>` | `!yt dQw4w9WgXcQ` | Memutar audio YouTube |
| `!dance` | `!dance` | Karakter menari & berdisko di room 💃 |
| `!sing` | `!sing` | Karakter ikut bernyanyi di room 🎤 |
| `!pause` / `!resume` | `!pause` | Menjeda atau melanjutkan pemutaran |
| `!stop` | `!stop` | Menghentikan pemutaran musik |
| `!volume <0-100>` | `!volume 70` | Mengatur volume suara |
| `!np` | `!np` | Mengumumkan lagu yang sedang diputar ke room |

---

## 🎮 Panel Kontrol Karakter DJ di Game

Pada panel floating widget di layar game, Anda dapat mengontrol:
1. **🤖 Mode Karakter DJ Bot**: Menghidupkan / mematikan persona bot karakter.
2. **Animasi Vibe**: Karakter bergoyang dan berekspresi otomatis sesuai irama.
3. **Sapa Pengunjung**: Menyapa pemain baru yang bergabung ke room secara otomatis.
4. **Tombol Cepat `💃 Menari` & `🎤 Bernyanyi`**.
5. **Hak Akses Perintah**: Pilihan siapa yang boleh me-request lagu (*Hanya Saya*, *Room Admin*, atau *Semua Orang*).
