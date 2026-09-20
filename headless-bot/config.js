const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Dedicated folder in project root for converted audio files
const CONVERT_DIR = path.resolve(__dirname, "..", "converted_tracks");
if (!fs.existsSync(CONVERT_DIR)) {
    fs.mkdirSync(CONVERT_DIR, { recursive: true });
}

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

// 24/7 Radio stations in direct .mp3 stream format
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

// Maximum songs in queue
const MAX_QUEUE = 10;

// Authorized Master Admins who can command the bot to switch rooms via beep
const MASTER_ADMINS = new Set([245253, 249540]);

module.exports = {
    CONFIG,
    STATIONS,
    MAX_QUEUE,
    MASTER_ADMINS,
    CONVERT_DIR,
    resolveServerUrl,
};

