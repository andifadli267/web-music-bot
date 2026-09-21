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
    defaultRoom: process.env.BC_TARGET_ROOM || "V Main Hall",
    roomPassword: process.env.BC_ROOM_PASSWORD || "",
    defaultPassword: process.env.BC_ROOM_PASSWORD || "",
    webPort: parseInt(process.env.WEB_PORT, 10) || 3000,
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

// Maximum track duration in seconds (10 minutes)
const MAX_TRACK_DURATION = 600;

// Default seed admins if authorized_members.json does not exist yet
const DEFAULT_SEED_ADMINS = [245253, 249540];
const AUTH_FILE = path.join(__dirname, "authorized_members.json");

function loadAuthorizedMembers() {
    try {
        if (fs.existsSync(AUTH_FILE)) {
            const raw = fs.readFileSync(AUTH_FILE, "utf8");
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return new Set(parsed.map(Number).filter(n => !isNaN(n) && n > 0));
            }
        } else {
            fs.writeFileSync(AUTH_FILE, JSON.stringify(DEFAULT_SEED_ADMINS, null, 2), "utf8");
        }
    } catch (err) {
        console.warn("⚠️ Failed to load authorized_members.json, using defaults:", err.message);
    }
    return new Set(DEFAULT_SEED_ADMINS);
}

// Authorized Master Admins who can command the bot to switch rooms, use admin commands, and manage bot
const MASTER_ADMINS = loadAuthorizedMembers();

function saveAuthorizedMembers() {
    try {
        const arr = Array.from(MASTER_ADMINS);
        fs.writeFileSync(AUTH_FILE, JSON.stringify(arr, null, 2), "utf8");
        return true;
    } catch (err) {
        console.error("❌ Failed to save authorized_members.json:", err.message);
        return false;
    }
}

function addAuthorizedMember(memberNumber) {
    const num = parseInt(memberNumber, 10);
    if (isNaN(num) || num <= 0) {
        return { success: false, message: "Nomor Member tidak valid." };
    }
    if (MASTER_ADMINS.has(num)) {
        return { success: false, message: `Member #${num} sudah terdaftar sebagai Authorized Member bot.` };
    }
    MASTER_ADMINS.add(num);
    saveAuthorizedMembers();
    console.log(`⭐ [Authorized Member Added] Member #${num} has been granted Authorized Member privileges.`);
    return { success: true, message: `Member #${num} berhasil ditambahkan ke bot sebagai Authorized Member.` };
}

function removeAuthorizedMember(memberNumber) {
    const num = parseInt(memberNumber, 10);
    if (isNaN(num) || num <= 0) {
        return { success: false, message: "Nomor Member tidak valid." };
    }
    if (!MASTER_ADMINS.has(num)) {
        return { success: false, message: `Member #${num} tidak ditemukan dalam daftar Authorized Member bot.` };
    }
    MASTER_ADMINS.delete(num);
    saveAuthorizedMembers();
    console.log(`⭐ [Authorized Member Removed] Member #${num} was removed from Authorized Members.`);
    return { success: true, message: `Member #${num} berhasil dihapus dari Authorized Member bot.` };
}

function getAuthorizedMembersList() {
    return Array.from(MASTER_ADMINS).map(id => ({
        memberNumber: id,
    }));
}

module.exports = {
    CONFIG,
    STATIONS,
    MAX_QUEUE,
    MAX_TRACK_DURATION,
    MASTER_ADMINS,
    DEFAULT_SEED_ADMINS,
    CONVERT_DIR,
    resolveServerUrl,
    addAuthorizedMember,
    removeAuthorizedMember,
    getAuthorizedMembersList,
};

