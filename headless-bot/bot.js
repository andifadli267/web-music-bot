/**
 * Headless Character Music Bot for Bondage Club (R132+)
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

const STATIONS = {
    lofi: { name: "☕ Lo-Fi Chill Beats", url: "https://streams.ilovemusic.de/iloveradio17.mp3" },
    synth: { name: "🕹️ Nightride FM (Synthwave)", url: "https://stream.nightride.fm/synthwave.mp3" },
    chillsynth: { name: "🌌 Chillsynth FM", url: "https://stream.nightride.fm/chillsynth.mp3" },
    anime: { name: "🌸 LISTEN.moe Anime & J-Pop", url: "https://listen.moe/stream" },
    kpop: { name: "✨ LISTEN.moe K-Pop", url: "https://listen.moe/kpop/stream" },
    jazz: { name: "🎷 Swiss Jazz & Lounge", url: "https://jazz-wr01.ice.infomaniak.ch/jazz-wr01-128.mp3" },
    pop: { name: "🎧 Top Pop Hits", url: "https://streams.ilovemusic.de/iloveradio1.mp3" },
    classical: { name: "🎻 Radio Swiss Classic", url: "https://stream.srg-ssr.ch/m/rsc_de/mp3_128" },
};

let currentStation = STATIONS.lofi;
let botPlayer = null;
let isInRoom = false;

async function startBot() {
    console.log("==================================================");
    console.log("🤖 Bondage Club - Headless Music DJ Character Bot");
    console.log("==================================================");
    console.log(`📡 Menghubungkan ke server : ${CONFIG.serverUrl}`);
    console.log(`👤 Akun Bot               : ${CONFIG.accountName}`);
    console.log(`🚪 Target Chat Room        : "${CONFIG.targetRoom}"`);
    console.log("--------------------------------------------------");

    const socket = io(CONFIG.serverUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 3000,
    });

    socket.on("connect", () => {
        console.log("✅ Berhasil terhubung ke Server Socket! (ID: " + socket.id + ")");
        console.log("🔑 Mengirim permintaan login untuk " + CONFIG.accountName + "...");

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
            
            // Masuk ke room
            joinTargetRoom(socket);
        }
    });

    socket.on("ChatRoomSearchResponse", (data) => {
        if (data === "CannotFindRoom") {
            console.log(`⚠️ Room "${CONFIG.targetRoom}" belum aktif.`);
            console.log(`🔨 Mencoba membuat room "${CONFIG.targetRoom}"...`);
            createRoom(socket);
        } else if (data === "RoomFull") {
            console.warn(`⚠️ Room "${CONFIG.targetRoom}" penuh. Mencoba kembali dalam 8 detik...`);
            setTimeout(() => joinTargetRoom(socket), 8000);
        } else if (data === "RoomLocked") {
            console.warn(`⚠️ Room "${CONFIG.targetRoom}" terkunci.`);
        }
    });

    socket.on("ChatRoomCreateResponse", (data) => {
        if (data && typeof data === "string" && data.includes("Error")) {
            console.error("ℹ️ ChatRoomCreateResponse:", data);
        }
    });

    socket.on("ChatRoomSync", (data) => {
        isInRoom = true;
        console.log(`\n==================================================`);
        console.log(`📍 Karakter bot BERHASIL BERADA di Chat Room: "${data.Name}"!`);
        console.log(`👥 Pemain di room: ${data.Character ? data.Character.map(c => c.Name).join(", ") : "Hanya bot"}`);
        console.log(`==================================================\n`);

        setTimeout(() => {
            sendRoomEmote(
                socket,
                `* 🎵 [DJ Bot] ${botPlayer ? botPlayer.Name : CONFIG.accountName} siap melayani permintaan musik di room! Ketik !help untuk bantuan lagu 🎧`
            );
        }, 1500);
    });

    socket.on("ChatRoomMessage", (data) => {
        if (!data || !data.Content || typeof data.Content !== "string") return;

        const content = data.Content.trim();
        const sender = data.Sender;

        if (botPlayer && sender === botPlayer.MemberNumber) return;

        console.log(`💬 Chat di room [Member #${sender}]: "${content}"`);
        if (!content.startsWith("!")) return;

        handleRoomCommand(socket, content, sender);
    });

    // Auto-rejoin timer jika keluar dari room
    setInterval(() => {
        if (botPlayer && !isInRoom) {
            joinTargetRoom(socket);
        }
    }, 15000);

    socket.on("disconnect", (reason) => {
        isInRoom = false;
        console.warn(`⚠️ Terputus dari game server (${reason}). Mencoba menyambung kembali...`);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Koneksi socket error:", err.message);
    });
}

function joinTargetRoom(socket) {
    console.log(`🚪 Mencari dan bergabung ke room "${CONFIG.targetRoom}"...`);
    socket.emit("ChatRoomJoin", {
        Name: CONFIG.targetRoom,
    });
}

function createRoom(socket) {
    const newRoom = {
        Name: CONFIG.targetRoom,
        Description: "Music Lounge DJ Room",
        Background: "MainHall",
        Limit: 10,
        Language: "EN",
        Admin: [botPlayer ? botPlayer.MemberNumber : 0],
        Whitelist: [],
        Ban: [],
        BlockCategory: [],
        Game: "",
        Visibility: ["All"],
        Access: ["All"],
        Space: "",
        MapData: { Type: "Never" },
    };
    socket.emit("ChatRoomCreate", newRoom);
}

function sendRoomChat(socket, msg) {
    socket.emit("ChatRoomChat", {
        Content: msg,
        Type: "Chat",
        Dictionary: [{ Tag: "MsgId", MsgId: Date.now().toString() }],
    });
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
        changeFaceExpression(socket, "Eyes", "Happy");
        sendRoomEmote(
            socket,
            `* 🎵 [${myName} DJ Commands]: !radio <lofi|synth|chillsynth|anime|kpop|jazz|pop|classical> | !dance | !sing | !np | !help`
        );
    } else if (cmd === "!radio") {
        const key = (parts[1] || "lofi").toLowerCase();
        if (STATIONS[key]) {
            currentStation = STATIONS[key];
            changeFaceExpression(socket, "Eyes", "Happy");
            changeFaceExpression(socket, "Mouth", "Smile");
            sendRoomEmote(
                socket,
                `* 🎧 [${myName} DJ] Mengganti stasiun ke: ${currentStation.name}! Stream: ${currentStation.url} 🎶`
            );
        } else {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} DJ] Pilihan stasiun: lofi, synth, chillsynth, anime, kpop, jazz, pop, classical`
            );
        }
    } else if (cmd === "!dance") {
        changeFaceExpression(socket, "Eyes", "Wink");
        changeFaceExpression(socket, "Mouth", "Smile");
        sendRoomEmote(
            socket,
            `* 💃 ${myName} menari dan berdisko energik mengikuti irama musik di room! 🎶✨`
        );
    } else if (cmd === "!sing") {
        changeFaceExpression(socket, "Eyes", "Happy");
        changeFaceExpression(socket, "Mouth", "Sing");
        sendRoomEmote(
            socket,
            `* 🎤 ${myName} bernyanyi: "La la la~ feel the rhythm in your heart!" 🎵`
        );
    } else if (cmd === "!np") {
        sendRoomEmote(
            socket,
            `* 🎵 [${myName} DJ] Sedang memutar: ${currentStation.name} 🎧`
        );
    }
}

startBot().catch((err) => console.error("Fatal Error:", err));
