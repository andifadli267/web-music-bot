/**
 * Bondage Club (R132+) - Standalone Headless DJ Character Bot
 * 
 * Bot karakter mandiri yang login dengan akun tersendiri,
 * bergabung ke ruangan private yang telah ditentukan (misal: "V Main Hall"),
 * dan menyiarkan musik room resmi via native BC Room Customization (Custom.MusicURL)
 * sehingga MUSIK DAPAT DIDENGAR SECARA BERSAMAAN OLEH SEMUA ORANG DI ROOM
 * tanpa pemain lain perlu menginstall addon atau ekstensi apapun!
 */

const { io } = require("socket.io-client");
require("dotenv").config();

function resolveServerUrl(url) {
    if (!url) return "https://bondage-club-server.herokuapp.com/";
    const lower = url.toLowerCase();
    if (lower.includes("bondage-asia") || lower.includes("bondage-europe") || lower.includes("bondageprojects") || lower.includes("bondageeurope")) {
        return "https://bondage-club-server.herokuapp.com/";
    }
    return url;
}

const CONFIG = {
    webUrl: process.env.BC_SERVER_URL || "https://www.bondage-asia.com/club/R132/",
    serverUrl: resolveServerUrl(process.env.BC_SERVER_URL),
    accountName: process.env.BC_BOT_USERNAME || "Nava1",
    password: process.env.BC_BOT_PASSWORD || "yondaime",
    targetRoom: process.env.BC_TARGET_ROOM || "V Main Hall",
    roomPassword: process.env.BC_ROOM_PASSWORD || "",
};

// Daftar stasiun radio 24/7 format .mp3 (Wajib .mp3 / .mp4 sesuai aturan validasi server Bondage Club)
const STATIONS = {
    lofi: { name: "☕ Lo-Fi Chill Beats", genre: "Lo-Fi / Study", url: "https://streams.ilovemusic.de/iloveradio17.mp3" },
    synth: { name: "🕹️ Nightride FM (Synthwave)", genre: "Synthwave / Cyberpunk", url: "https://stream.nightride.fm/synthwave.mp3" },
    chillsynth: { name: "🌌 Chillsynth FM", genre: "Chillwave / Ambient", url: "https://stream.nightride.fm/chillsynth.mp3" },
    pop: { name: "🎧 Top 40 Pop Hits", genre: "Pop Hits", url: "https://streams.ilovemusic.de/iloveradio1.mp3" },
    dance: { name: "💃 Club Dance & EDM", genre: "EDM / Dance", url: "https://streams.ilovemusic.de/iloveradio2.mp3" },
    rock: { name: "🎸 Rock Nonstop", genre: "Rock & Alternative", url: "https://streams.ilovemusic.de/iloveradio4.mp3" },
    hiphop: { name: "🎤 Hip Hop Beats", genre: "Hip Hop / Rap", url: "https://streams.ilovemusic.de/iloveradio3.mp3" },
    jazz: { name: "🎷 Swiss Jazz & Lounge", genre: "Cafe Jazz", url: "https://jazz-wr01.ice.infomaniak.ch/jazz-wr01-128.mp3" },
};

let currentStation = STATIONS.lofi;
let botPlayer = null;
let currentRoomData = null;
let isInRoom = false;
let knownCharacters = new Set();
let vibeTimer = null;
let retryJoinTimer = null;

async function startBot() {
    console.log("==========================================================");
    console.log("🤖 Bondage Club - Standalone Music DJ Character Bot");
    console.log("   Memutar musik room resmi agar terdengar oleh SEMUA ORANG");
    console.log("==========================================================");
    console.log(`🌐 Website Login  : ${CONFIG.webUrl}`);
    console.log(`👤 Akun Karakter  : ${CONFIG.accountName}`);
    console.log(`🚪 Target Ruangan : "${CONFIG.targetRoom}" (Private Room)`);
    console.log("----------------------------------------------------------");

    const socket = io(CONFIG.serverUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 50,
        reconnectionDelay: 3000,
        extraHeaders: {
            Origin: "https://www.bondage-asia.com",
            Referer: "https://www.bondage-asia.com/club/R132/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    socket.on("connect", () => {
        console.log("✅ Terhubung ke socket server BC! (Socket ID: " + socket.id + ")");
        console.log(`🔑 Mengirim permintaan login untuk "${CONFIG.accountName}"...`);

        socket.emit("AccountLogin", {
            AccountName: CONFIG.accountName,
            Password: CONFIG.password,
        });
    });

    socket.on("LoginResponse", (res) => {
        if (typeof res === "string") {
            console.error("❌ Login gagal. Respon server:", res);
            return;
        }

        if (res && res.AccountName) {
            botPlayer = res;
            console.log(`🎉 Login Berhasil!`);
            console.log(`   Nama Karakter : ${res.Name || res.AccountName}`);
            console.log(`   Member Number : #${res.MemberNumber}`);
            console.log("----------------------------------------------------------");
            console.log(`🚪 Memulai pencarian dan bergabung ke ruangan private "${CONFIG.targetRoom}"...`);
            console.log(`💡 PENTING: Pada room private Anda di game, pastikan nomor #${res.MemberNumber} (${res.Name || res.AccountName}) sudah ditambahkan ke Whitelist / Admin list!`);
            console.log("----------------------------------------------------------");
            
            joinTargetRoom(socket);
        }
    });

    // Menangani respon jika room belum ditemukan / terkunci
    socket.on("ChatRoomSearchResponse", (data) => {
        if (isInRoom) return;

        if (data === "CannotFindRoom" || data === "RoomLocked") {
            process.stdout.write(`\r⏳ Menunggu akses ke ruangan "${CONFIG.targetRoom}" (Respon: ${data}). Mencoba kembali... `);
            scheduleRetryJoin(socket, 5000);
        } else if (data === "RoomFull") {
            console.warn(`\n⚠️ Ruangan "${CONFIG.targetRoom}" penuh. Mencoba kembali dalam 8 detik...`);
            scheduleRetryJoin(socket, 8000);
        } else if (data === "JoinedRoom") {
            console.log(`\n✅ Respon server: Berhasil bergabung ke room!`);
        } else {
            console.log(`\nℹ️ ChatRoomSearchResponse:`, data);
        }
    });

    // Fitur Beep / Invite: Jika pemilik mengirim beep kepada bot dari dalam room, bot langsung bergabung
    socket.on("AccountBeep", (data) => {
        if (!data || typeof data !== "object") return;
        console.log(`\n📩 Menerima Beep/Panggilan dari: ${data.MemberName} (#${data.MemberNumber})`);
        if (data.ChatRoomName) {
            console.log(`🚪 Beep mengundang ke Chat Room: "${data.ChatRoomName}"! Mengarahkan bot masuk...`);
            CONFIG.targetRoom = data.ChatRoomName;
            joinTargetRoom(socket);
        }
    });

    socket.on("ChatRoomSync", (data) => {
        if (!data || !data.Name) return;

        isInRoom = true;
        currentRoomData = data;
        if (retryJoinTimer) {
            clearTimeout(retryJoinTimer);
            retryJoinTimer = null;
        }

        const charList = Array.isArray(data.Character) ? data.Character : [];
        console.log(`\n==========================================================`);
        console.log(`📍 Karakter bot BERHASIL BERADA di Ruangan: "${data.Name}"!`);
        console.log(`👥 Pemain di room (${charList.length}): ${charList.map(c => c.Name).join(", ") || "Hanya bot"}`);
        console.log(`👑 Admin Room: ${Array.isArray(data.Admin) ? data.Admin.join(", ") : "Tidak ada"}`);
        
        const activeMusic = data.Custom && data.Custom.MusicURL;
        console.log(`🎵 Status Musik Room: ${activeMusic ? activeMusic : "Belum aktif (Gunakan perintah !radio untuk menyalakan)"}`);
        console.log(`==========================================================\n`);

        // Sapaan hangat saat baru masuk room
        setTimeout(() => {
            sendRoomEmote(
                socket,
                `* 🎵 [DJ ${botPlayer.Name || CONFIG.accountName}] Siap menyiarkan musik di ${data.Name}! Ketik !help untuk memilih genre lagu yang ingin didengar bersama 🎧`
            );
        }, 1500);

        // Sambut pemain lain yang ada
        charList.forEach(c => {
            if (c.MemberNumber !== botPlayer.MemberNumber && !knownCharacters.has(c.MemberNumber)) {
                knownCharacters.add(c.MemberNumber);
            }
        });

        // Mulai getaran ekspresi wajah menikmati musik
        startVibeAnimation(socket);
    });

    socket.on("ChatRoomMessage", (data) => {
        if (!data || !data.Content || typeof data.Content !== "string") return;

        const content = data.Content.trim();
        const sender = data.Sender;

        if (botPlayer && sender === botPlayer.MemberNumber) return;

        // Catat pemain yang aktif chat
        if (sender && !knownCharacters.has(sender)) {
            knownCharacters.add(sender);
        }

        console.log(`💬 [Member #${sender}]: "${content}"`);
        if (!content.startsWith("!")) return;

        handleRoomCommand(socket, content, sender);
    });

    // Auto-rejoin timer jika bot terlempar keluar dari room
    setInterval(() => {
        if (botPlayer && !isInRoom) {
            joinTargetRoom(socket);
        }
    }, 12000);

    socket.on("disconnect", (reason) => {
        isInRoom = false;
        currentRoomData = null;
        stopVibeAnimation();
        console.warn(`\n⚠️ Terputus dari game server (${reason}). Menyambung ulang...`);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Socket error:", err.message);
    });
}

function scheduleRetryJoin(socket, delayMs) {
    if (retryJoinTimer) clearTimeout(retryJoinTimer);
    retryJoinTimer = setTimeout(() => {
        if (!isInRoom) {
            joinTargetRoom(socket);
        }
    }, delayMs);
}

function joinTargetRoom(socket) {
    socket.emit("ChatRoomJoin", {
        Name: CONFIG.targetRoom,
    });
}

function isBotAdmin() {
    if (!botPlayer || !currentRoomData || !Array.isArray(currentRoomData.Admin)) return false;
    return currentRoomData.Admin.includes(botPlayer.MemberNumber);
}

/**
 * Menyetel musik room resmi Bondage Club via Custom.MusicURL
 * Server akan menyiarkan ChatRoomSync ke seluruh pemain di room,
 * sehingga audio otomatis terputar di browser/device semua orang.
 */
function setRoomMusic(socket, musicUrl, title = "") {
    if (!currentRoomData) {
        console.warn("⚠️ Gagal menyetel musik: Bot belum berada di dalam room.");
        return;
    }

    const myId = botPlayer ? botPlayer.MemberNumber : 0;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (!isBotAdmin()) {
        sendRoomEmote(
            socket,
            `* ⚠️ [DJ ${myName}] Saya butuh hak Admin room untuk bisa menyetel musik agar didengar SEMUA ORANG di room. Mohon berikan hak Admin kepada ${myName} (#${myId}) ya!`
        );
        return;
    }

    // Pastikan URL berakhiran .mp3 atau .mp4 sesuai aturan server BC
    if (musicUrl && !musicUrl.toLowerCase().includes(".mp3") && !musicUrl.toLowerCase().includes(".mp4")) {
        sendRoomEmote(
            socket,
            `* ⚠️ [DJ ${myName}] Server game hanya mengizinkan link audio dengan format .mp3 atau .mp4!`
        );
        return;
    }

    const updatedRoom = {
        Name: currentRoomData.Name,
        Language: currentRoomData.Language || "EN",
        Description: currentRoomData.Description || "Music DJ Room",
        Background: currentRoomData.Background || "MainHall",
        Limit: currentRoomData.Limit || 10,
        Admin: currentRoomData.Admin || [myId],
        Whitelist: currentRoomData.Whitelist || [],
        Ban: currentRoomData.Ban || [],
        BlockCategory: currentRoomData.BlockCategory || [],
        Game: currentRoomData.Game || "",
        Visibility: currentRoomData.Visibility || ["All"],
        Access: currentRoomData.Access || ["All"],
        MapData: currentRoomData.MapData || { Type: "Never" },
        Custom: {
            ...(currentRoomData.Custom || {}),
            MusicURL: musicUrl ? musicUrl : undefined,
            MusicStart: musicUrl ? Date.now() : undefined,
        },
    };

    console.log(`📻 [Room Music Broadcast] Memperbarui MusicURL room ke: "${musicUrl}"`);
    socket.emit("ChatRoomAdmin", {
        MemberNumber: myId,
        Room: updatedRoom,
        Action: "Update",
    });

    changeFaceExpression(socket, "Eyes", "Happy");
    changeFaceExpression(socket, "Mouth", "Smile");

    if (musicUrl) {
        sendRoomEmote(
            socket,
            `* 🎧 [DJ ${myName}] Memutar musik room untuk SEMUA ORANG: ${title || musicUrl} 🎶 (Tersinkronisasi otomatis di speaker semua pemain)`
        );
    } else {
        sendRoomEmote(
            socket,
            `* 🔇 [DJ ${myName}] Musik room telah dimatikan untuk semua pemain.`
        );
    }
}

function sendRoomEmote(socket, msg) {
    socket.emit("ChatRoomChat", {
        Content: msg,
        Type: "Emote",
        Dictionary: [{ Tag: "MsgId", MsgId: Date.now().toString() }],
    });
}

function changeFaceExpression(socket, group, expression) {
    socket.emit("ChatRoomCharacterExpressionUpdate", {
        Group: group,
        Name: expression,
    });
}

function handleRoomCommand(socket, text, sender) {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (cmd === "!help" || cmd === "!music") {
        changeFaceExpression(socket, "Eyes", "Wink");
        sendRoomEmote(
            socket,
            `* 🎵 [DJ ${myName}]: Karakter mandiri yang memutar lagu room untuk semua orang! Perintah: !radio <genre> | !play <url-mp3> | !stop | !np | !dance | !sing | !admin`
        );
        setTimeout(() => {
            sendRoomEmote(
                socket,
                `* 📻 Pilihan Genre Radio: lofi, synth, chillsynth, pop, dance, rock, hiphop, jazz`
            );
        }, 1200);
    } else if (cmd === "!radio") {
        const key = (parts[1] || "").toLowerCase();
        if (STATIONS[key]) {
            currentStation = STATIONS[key];
            setRoomMusic(socket, currentStation.url, currentStation.name);
        } else {
            sendRoomEmote(
                socket,
                `* ⚠️ [DJ ${myName}] Genre tersedia: lofi, synth, chillsynth, pop, dance, rock, hiphop, jazz. Contoh: !radio synth`
            );
        }
    } else if (cmd === "!play") {
        const url = parts[1];
        if (!url) {
            sendRoomEmote(
                socket,
                `* ⚠️ [DJ ${myName}] Masukkan link audio .mp3! Contoh: !play https://contoh.com/lagu.mp3`
            );
            return;
        }
        setRoomMusic(socket, url, `Lagu Request (${url})`);
    } else if (cmd === "!stop") {
        setRoomMusic(socket, "", "");
    } else if (cmd === "!np") {
        const activeUrl = currentRoomData && currentRoomData.Custom && currentRoomData.Custom.MusicURL;
        if (activeUrl) {
            sendRoomEmote(
                socket,
                `* 🎵 [DJ ${myName}] Sedang diputar di room: ${currentStation ? currentStation.name : activeUrl} 🎧`
            );
        } else {
            sendRoomEmote(
                socket,
                `* 🔇 [DJ ${myName}] Saat ini tidak ada musik yang sedang diputar di room. Ketik !radio <genre> untuk memutar!`
            );
        }
    } else if (cmd === "!dance") {
        changeFaceExpression(socket, "Eyes", "Wink");
        changeFaceExpression(socket, "Mouth", "Smile");
        sendRoomEmote(
            socket,
            `* 💃 ${myName} menari dan berdisko energik di tengah room mengikuti irama lagu! 🎶✨`
        );
    } else if (cmd === "!sing") {
        changeFaceExpression(socket, "Eyes", "Happy");
        changeFaceExpression(socket, "Mouth", "Sing");
        sendRoomEmote(
            socket,
            `* 🎤 ${myName} bernyanyi merdu di mikrofon DJ: "Feel the beat, let the music take control~!" 🎵`
        );
    } else if (cmd === "!admin") {
        if (!isBotAdmin()) {
            sendRoomEmote(socket, `* ⚠️ [DJ ${myName}] Saya sendiri belum memiliki hak Admin di room ini.`);
            return;
        }
        if (sender && Array.isArray(currentRoomData.Admin) && !currentRoomData.Admin.includes(sender)) {
            currentRoomData.Admin.push(sender);
            socket.emit("ChatRoomAdmin", {
                MemberNumber: botPlayer.MemberNumber,
                Room: currentRoomData,
                Action: "Update",
            });
            sendRoomEmote(socket, `* 👑 [DJ ${myName}] Berhasil memberikan hak Room Admin kepada Member #${sender}!`);
        } else {
            sendRoomEmote(socket, `* 👑 Anda sudah menjadi Admin di room ini.`);
        }
    }
}

function startVibeAnimation(socket) {
    stopVibeAnimation();
    const eyes = ["Happy", "Wink", "Normal", "Closed"];
    const mouths = ["Smile", "Sing", "Normal"];

    vibeTimer = setInterval(() => {
        if (!isInRoom) return;
        const randomEye = eyes[Math.floor(Math.random() * eyes.length)];
        const randomMouth = mouths[Math.floor(Math.random() * mouths.length)];
        changeFaceExpression(socket, "Eyes", randomEye);
        changeFaceExpression(socket, "Mouth", randomMouth);
    }, 12000);
}

function stopVibeAnimation() {
    if (vibeTimer) {
        clearInterval(vibeTimer);
        vibeTimer = null;
    }
}

startBot().catch((err) => console.error("Fatal Error:", err));
