/**
 * Bondage Club (R132+) - Standalone Headless DJ Character Bot
 * 
 * Bot karakter mandiri yang login dengan akun tersendiri, masuk/membuat room,
 * dan memutar musik room via native BC Room Customization (Custom.MusicURL)
 * sehingga MUSIK DAPAT DIDENGAR SECARA BERSAMAAN OLEH SEMUA PEMAIN DI ROOM
 * tanpa pemain lain perlu menginstall addon atau ekstensi apapun!
 */

const { io } = require("socket.io-client");
require("dotenv").config();

const CONFIG = {
    serverUrl: process.env.BC_SERVER_URL || "https://bondage-club-server.herokuapp.com/",
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

async function startBot() {
    console.log("==========================================================");
    console.log("🤖 Bondage Club - Standalone Music DJ Character Bot");
    console.log("   Memutar musik room resmi agar terdengar oleh SEMUA ORANG");
    console.log("==========================================================");
    console.log(`📡 Server Game   : ${CONFIG.serverUrl}`);
    console.log(`👤 Akun Karakter : ${CONFIG.accountName}`);
    console.log(`🚪 Target Room   : "${CONFIG.targetRoom}"`);
    console.log("----------------------------------------------------------");

    const socket = io(CONFIG.serverUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 25,
        reconnectionDelay: 3000,
    });

    socket.on("connect", () => {
        console.log("✅ Terhubung ke socket server BC! Socket ID:", socket.id);
        console.log(`🔑 Login sebagai karakter "${CONFIG.accountName}"...`);

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
            console.log(`🎉 Login Berhasil! Nama Karakter: ${res.Name || res.AccountName} [Member #${res.MemberNumber}]`);
            console.log(`🚪 Memasuki chat room "${CONFIG.targetRoom}"...`);
            joinTargetRoom(socket);
        }
    });

    socket.on("ChatRoomSearchResponse", (data) => {
        if (data === "CannotFindRoom") {
            console.log(`ℹ️ Room "${CONFIG.targetRoom}" belum ada.`);
            console.log(`🔨 Karakter bot membuat room baru "${CONFIG.targetRoom}" sebagai Room Creator & Admin...`);
            createRoom(socket);
        } else if (data === "RoomFull") {
            console.warn(`⚠️ Room "${CONFIG.targetRoom}" penuh. Mencoba kembali dalam 8 detik...`);
            setTimeout(() => joinTargetRoom(socket), 8000);
        } else if (data === "RoomLocked") {
            console.warn(`⚠️ Room "${CONFIG.targetRoom}" terkunci.`);
        }
    });

    socket.on("ChatRoomCreateResponse", (data) => {
        console.log("ℹ️ ChatRoomCreateResponse:", data);
    });

    socket.on("ChatRoomSync", (data) => {
        if (!data || !data.Name) return;

        isInRoom = true;
        currentRoomData = data;

        const charList = Array.isArray(data.Character) ? data.Character : [];
        console.log(`\n==========================================================`);
        console.log(`📍 Karakter bot berada di Room: "${data.Name}"!`);
        console.log(`👥 Pemain di room (${charList.length}): ${charList.map(c => c.Name).join(", ") || "Hanya bot"}`);
        console.log(`👑 Admin Room: ${Array.isArray(data.Admin) ? data.Admin.join(", ") : "Tidak ada"}`);
        
        const activeMusic = data.Custom && data.Custom.MusicURL;
        console.log(`🎵 Status Musik Room: ${activeMusic ? activeMusic : "Belum ada (Ketik !radio untuk menyalakan)"}`);
        console.log(`==========================================================\n`);

        // Deteksi pemain baru untuk auto-welcome
        charList.forEach(c => {
            if (c.MemberNumber !== botPlayer.MemberNumber && !knownCharacters.has(c.MemberNumber)) {
                knownCharacters.add(c.MemberNumber);
                setTimeout(() => {
                    sendRoomEmote(
                        socket,
                        `* 🎵 [DJ ${botPlayer.Name || CONFIG.accountName}] Halo ${c.Name}! Selamat datang di music lounge. Ketik !help untuk memilih lagu yang ingin diputar di room! 🎧`
                    );
                }, 2000);
            }
        });

        // Jika room belum ada musik dan bot adalah admin, aktifkan default radio
        if (!activeMusic && isBotAdmin()) {
            console.log("🎶 Mengaktifkan musik room awal (Lo-Fi Chill Beats)...");
            setTimeout(() => {
                setRoomMusic(socket, currentStation.url, currentStation.name);
            }, 2500);
        }

        // Mulai getaran vibe animasi wajah
        startVibeAnimation(socket);
    });

    socket.on("ChatRoomMessage", (data) => {
        if (!data || !data.Content || typeof data.Content !== "string") return;

        const content = data.Content.trim();
        const sender = data.Sender;

        if (botPlayer && sender === botPlayer.MemberNumber) return;

        // Tangkap pemain baru yang mengirim pesan
        if (sender && !knownCharacters.has(sender)) {
            knownCharacters.add(sender);
        }

        console.log(`💬 Chat [Member #${sender}]: "${content}"`);
        if (!content.startsWith("!")) return;

        handleRoomCommand(socket, content, sender);
    });

    // Auto-rejoin timer jika terputus atau tertinggal di luar room
    setInterval(() => {
        if (botPlayer && !isInRoom) {
            joinTargetRoom(socket);
        }
    }, 15000);

    socket.on("disconnect", (reason) => {
        isInRoom = false;
        currentRoomData = null;
        stopVibeAnimation();
        console.warn(`⚠️ Terputus dari server BC (${reason}). Menyambung ulang...`);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Socket error:", err.message);
    });
}

function joinTargetRoom(socket) {
    console.log(`🚪 Mencoba bergabung ke room "${CONFIG.targetRoom}"...`);
    socket.emit("ChatRoomJoin", {
        Name: CONFIG.targetRoom,
    });
}

function createRoom(socket) {
    const myId = botPlayer ? botPlayer.MemberNumber : 0;
    const newRoom = {
        Name: CONFIG.targetRoom,
        Description: "🎵 DJ Music Lounge - Lagu terdengar oleh semua orang!",
        Background: "MainHall",
        Limit: 10,
        Language: "EN",
        Admin: [myId],
        Whitelist: [],
        Ban: [],
        BlockCategory: [],
        Game: "",
        Visibility: ["All"],
        Access: ["All"],
        Space: "",
        MapData: { Type: "Never" },
        Custom: {
            MusicURL: currentStation.url,
            MusicStart: Date.now(),
        },
    };
    socket.emit("ChatRoomCreate", newRoom);
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
            `* ⚠️ [DJ ${myName}] Saya butuh hak Admin room untuk bisa menyetel musik agar didengar SEMUA ORANG di room. Jadikan ${myName} admin room terlebih dahulu ya!`
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
        // Berikan sender hak room admin jika bot adalah admin
        if (!isBotAdmin()) {
            sendRoomEmote(socket, `* ⚠️ [DJ ${myName}] Saya sendiri belum menjadi admin di room ini.`);
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
