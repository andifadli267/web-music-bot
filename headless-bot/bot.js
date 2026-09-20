/**
 * Bondage Club (R132+) - Standalone Headless DJ Character Bot
 * 
 * An autonomous character bot that logs in with its own account,
 * joins the designated private room ("V Main Hall"),
 * and broadcasts room music using native BC Room Customization (Custom.MusicURL).
 * Music is synchronized and audible to EVERYONE in the room without requiring addons!
 */

const { io } = require("socket.io-client");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("ffmpeg-static");
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

// Queue system (Maximum 10 songs)
const MAX_QUEUE = 10;
const songQueue = []; // Items: { title, directUrl, duration, requestedBy }
let currentTrack = null; // { title, directUrl, duration, requestedBy, startedAt }
let trackEndTimer = null;
let currentStation = null;

// Authorized Master Admins who can command the bot to switch rooms via beep
const MASTER_ADMINS = new Set([245253, 249540]);

let botPlayer = null;
let currentRoomData = null;
let isInRoom = false;
let knownCharacters = new Set();
let vibeTimer = null;
let retryJoinTimer = null;
let isConverting = false;

/**
 * Automatically cleans up local audio files in converted_tracks/ and temp/
 * to ensure no leftover audio files occupy user's local disk space.
 */
function cleanLocalFiles(fileIdPattern = null) {
    const dirs = [CONVERT_DIR, path.join(__dirname, "temp")];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                if (f === ".gitkeep") continue;
                if (!fileIdPattern || f.includes(fileIdPattern)) {
                    try {
                        const fullPath = path.join(dir, f);
                        if (fs.statSync(fullPath).isFile()) {
                            fs.unlinkSync(fullPath);
                            console.log(`🧹 [Clean-up] Removed local file: ${f}`);
                        }
                    } catch (e) {
                        // Ignore if locked briefly
                    }
                }
            }
        } catch (err) {
            console.warn("[Clean-up Warning]:", err.message);
        }
    }
}

async function startBot() {
    cleanLocalFiles();
    console.log("==========================================================");
    console.log("🤖 Bondage Club - Standalone Music DJ Character Bot");
    console.log("   Broadcasting synchronized room audio for EVERYONE");
    console.log("==========================================================");
    console.log(`🌐 Game Web URL   : ${CONFIG.webUrl}`);
    console.log(`👤 Bot Account    : ${CONFIG.accountName}`);
    console.log(`🚪 Target Room    : "${CONFIG.targetRoom}" (Private Room)`);
    console.log(`📁 Local Storage  : ${CONVERT_DIR}`);
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
        console.log("✅ Connected to BC socket server! (Socket ID: " + socket.id + ")");
        console.log(`🔑 Sending login request for "${CONFIG.accountName}"...`);

        socket.emit("AccountLogin", {
            AccountName: CONFIG.accountName,
            Password: CONFIG.password,
        });
    });

    socket.on("LoginResponse", (res) => {
        if (typeof res === "string") {
            console.error("❌ Login failed. Server response:", res);
            return;
        }

        if (res && res.AccountName) {
            botPlayer = res;
            console.log(`🎉 Login Successful!`);
            console.log(`   Character Name : ${res.Name || res.AccountName}`);
            console.log(`   Member Number  : #${res.MemberNumber}`);
            console.log("----------------------------------------------------------");
            console.log(`🚪 Joining private room "${CONFIG.targetRoom}"...`);
            console.log(`💡 NOTE: Ensure member #${res.MemberNumber} (${res.Name || res.AccountName}) is on the Whitelist/Admin list of the room!`);
            console.log("----------------------------------------------------------");
            
            joinTargetRoom(socket);
        }
    });

    socket.on("ChatRoomSearchResponse", (data) => {
        if (isInRoom) return;

        if (data === "CannotFindRoom" || data === "RoomLocked") {
            process.stdout.write(`\r⏳ Waiting to access room "${CONFIG.targetRoom}" (Response: ${data}). Retrying... `);
            scheduleRetryJoin(socket, 5000);
        } else if (data === "RoomFull") {
            console.warn(`\n⚠️ Room "${CONFIG.targetRoom}" is currently full. Retrying in 8s...`);
            scheduleRetryJoin(socket, 8000);
        } else if (data === "JoinedRoom") {
            console.log(`\n✅ Server response: Successfully joined room!`);
        } else {
            console.log(`\nℹ️ ChatRoomSearchResponse:`, data);
        }
    });

    // Beep / Invite Listener: If owner (#245253) sends "join here" or room invite, bot navigates to that room
    socket.on("AccountBeep", (data) => {
        if (!data || typeof data !== "object") return;

        console.log(`\n📩 Incoming Beep from Member #${data.MemberNumber} (${data.MemberName || 'Unknown'}):`);
        console.log(`   Packet:`, JSON.stringify(data));

        const senderId = Number(data.MemberNumber);
        const senderName = data.MemberName || "Unknown";
        const isMaster = MASTER_ADMINS.has(senderId);

        // Convert message to string whether it's a plain string or an object from an addon (GGC/BCX)
        let msg = "";
        if (typeof data.Message === "string") {
            msg = data.Message.trim();
        } else if (data.Message && typeof data.Message === "object") {
            const rawMsgJson = JSON.stringify(data.Message);
            // Ignore pure addon background heartbeat/ping without user text
            if (rawMsgJson.includes("GGC_BEEP_PING") && !rawMsgJson.toLowerCase().includes("join")) {
                console.log(`   ℹ️ [Filter] Ignored background GGC ping.`);
                return;
            }
            msg = data.Message.text || data.Message.message || data.Message.Content || rawMsgJson;
            if (typeof msg === "object") msg = JSON.stringify(msg);
        }

        // Ignore pure addon background pings with no user command
        if (data.BeepType === "GGC_BEEP" && msg.includes("GGC_BEEP_PING") && !msg.toLowerCase().includes("join")) {
            return;
        }

        const space = data.ChatRoomSpace || "";
        const isJoinHere = /(?:join\s+here|join\s+sini|masuk\s+sini)/i.test(msg);
        const joinMatch = msg.match(/(?:join\s+here|join\s+sini|masuk\s+sini)(?:\s*[:\-]?\s*(.+))?/i);

        let targetRoomToJoin = null;

        if (isMaster && isJoinHere) {
            // Priority 1: Official ChatRoomName attached to the beep by the game client
            if (data.ChatRoomName) {
                targetRoomToJoin = data.ChatRoomName;
            } 
            // Priority 2: Room name manually typed after "join here"
            else if (joinMatch && joinMatch[1] && joinMatch[1].trim()) {
                let cleaned = joinMatch[1].replace(/[\u200B-\u200D\uFEFF\u2060-\u2064]/g, '');
                cleaned = cleaned.replace(/LikoMAT:[a-zA-Z0-9_-]+/gi, '').trim();
                const roomNameCandidate = cleaned.replace(/^["'(\[]+|["')\]]+$/g, '').trim();
                if (roomNameCandidate && !roomNameCandidate.includes("{") && !roomNameCandidate.includes("}")) {
                    targetRoomToJoin = roomNameCandidate;
                }
            }

            if (targetRoomToJoin) {
                console.log(`🎯 [Master Command] Member #${senderId} ordered bot to join "${targetRoomToJoin}" (Space: "${space || 'Default'}")!`);
                try {
                    socket.emit("AccountBeep", {
                        MemberNumber: senderId,
                        Message: `Understood! Joining "${targetRoomToJoin}" now 🎵`
                    });
                } catch (err) {
                    console.warn("Failed to send reply beep:", err.message);
                }
                switchRoom(socket, targetRoomToJoin, space);
            } else {
                console.warn(`⚠️ Received "join here" from #${senderId}, but room name could not be identified.`);
                try {
                    socket.emit("AccountBeep", {
                        MemberNumber: senderId,
                        Message: `Received "join here", but room name is missing. Please send a room invite beep or specify: "join here <RoomName>"`
                    });
                } catch (err) {}
            }
            return;
        }

        // Native in-game Room Invite
        if (isMaster && data.BeepType === "ChatRoomInvite" && data.ChatRoomName) {
            targetRoomToJoin = data.ChatRoomName;
            console.log(`🚪 Native room invite to "${targetRoomToJoin}" received from Member #${senderId}! Navigating bot...`);
            try {
                socket.emit("AccountBeep", {
                    MemberNumber: senderId,
                    Message: `Joining room "${targetRoomToJoin}"...`
                });
            } catch (err) {}
            switchRoom(socket, targetRoomToJoin, space);
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
        console.log(`📍 Bot character IS NOW IN ROOM: "${data.Name}"!`);
        console.log(`👥 Players in room (${charList.length}): ${charList.map(c => c.Name).join(", ") || "Only bot"}`);
        console.log(`👑 Room Admins: ${Array.isArray(data.Admin) ? data.Admin.join(", ") : "None"}`);
        
        const activeMusic = data.Custom && data.Custom.MusicURL;
        console.log(`🎵 Current Room Music: ${activeMusic ? activeMusic : "None active"}`);
        console.log(`==========================================================\n`);

        setTimeout(() => {
            sendRoomEmote(
                socket,
                `* 🎵 [${botPlayer.Name || CONFIG.accountName} Music] Ready to play synced music in ${data.Name}! Type !help to see commands & radio genres 🎧`
            );
        }, 1500);

        charList.forEach(c => {
            if (c.MemberNumber !== botPlayer.MemberNumber && !knownCharacters.has(c.MemberNumber)) {
                knownCharacters.add(c.MemberNumber);
            }
        });

        startVibeAnimation(socket);
    });

    // Greet new players when they join
    socket.on("ChatRoomSyncMemberJoin", (data) => {
        if (!data || !data.Character) return;
        const newChar = data.Character;
        if (botPlayer && newChar.MemberNumber === botPlayer.MemberNumber) return;
        if (!knownCharacters.has(newChar.MemberNumber)) {
            knownCharacters.add(newChar.MemberNumber);
            setTimeout(() => {
                sendRoomEmote(
                    socket,
                    `* 👋 [${botPlayer.Name || CONFIG.accountName} Music] Welcome to the room, ${newChar.Name || 'friend'}! Feel free to request music using !play <song or youtube url> 🎶`
                );
            }, 2000);
        }
    });

    socket.on("ChatRoomUpdateResponse", (res) => {
        if (res === "Updated") {
            console.log("✅ [Server] Room administration update (Music/Settings) ACCEPTED by server!");
        } else {
            console.warn("⚠️ [Server] Room update response:", res);
        }
    });

    socket.on("ChatRoomSyncRoomProperties", (data) => {
        if (data && currentRoomData) {
            Object.assign(currentRoomData, data);
            console.log(`🔄 [Room Sync] Room properties synced to all players! MusicURL: "${data.Custom?.MusicURL || 'None'}"`);
        }
    });

    function extractCommand(msg) {
        if (!msg || typeof msg !== "string") return null;
        let text = msg.trim();
        if (!text) return null;

        if (text.startsWith("!") || text.startsWith("/music")) {
            return text;
        }

        let prev = "";
        while (text !== prev) {
            prev = text;
            if (
                (text.startsWith("(") && text.endsWith(")")) ||
                (text.startsWith("[") && text.endsWith("]")) ||
                (text.startsWith("{") && text.endsWith("}"))
            ) {
                text = text.slice(1, -1).trim();
            }
        }

        if (text.startsWith("!") || text.startsWith("/music")) {
            return text;
        }

        const openOnlyMatch = text.match(/^[\(\[\{\s]+((?:!|\/music)\b.+)$/i);
        if (openOnlyMatch) {
            return openOnlyMatch[1].trim();
        }

        const inlineMatch = text.match(/[\(\[\{]+(\s*(?:!|\/music)\b[^\)\]\}]+)[\)\]\}]*/i);
        if (inlineMatch) {
            return inlineMatch[1].trim();
        }

        return null;
    }

    socket.on("ChatRoomMessage", (data) => {
        if (!data || !data.Content || typeof data.Content !== "string") return;

        const content = data.Content.trim();
        const sender = data.Sender;

        if (botPlayer && sender === botPlayer.MemberNumber) return;

        if (sender && !knownCharacters.has(sender)) {
            knownCharacters.add(sender);
        }

        const isInternalAddon = /^(ECHO_|PCM_|CG_|BCEMsg|BCXMsg|KIKILINK|Liko)/.test(content);
        if (!isInternalAddon) {
            console.log(`💬 [Member #${sender}]: "${content}"`);
        }

        const cmdText = extractCommand(content);
        if (!cmdText) return;

        handleRoomCommand(socket, cmdText, sender);
    });

    // Auto-rejoin timer if disconnected from room
    setInterval(() => {
        if (botPlayer && !isInRoom) {
            joinTargetRoom(socket);
        }
    }, 12000);

    socket.on("disconnect", (reason) => {
        isInRoom = false;
        currentRoomData = null;
        stopVibeAnimation();
        console.warn(`\n⚠️ Disconnected from game server (${reason}). Reconnecting...`);
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

function joinTargetRoom(socket, roomName = CONFIG.targetRoom, space = (CONFIG.targetSpace || "")) {
    const packet = { Name: roomName };
    if (space) packet.Space = space;
    socket.emit("ChatRoomJoin", packet);
}

function switchRoom(socket, roomName, space = "") {
    if (!roomName) return;
    CONFIG.targetRoom = roomName;
    CONFIG.targetSpace = space || "";

    if (isInRoom) {
        if (currentRoomData && currentRoomData.Name && currentRoomData.Name.toLowerCase() === roomName.toLowerCase()) {
            console.log(`📍 Bot is already inside room "${roomName}".`);
            sendRoomEmote(
                socket,
                `* 🎵 [${botPlayer ? botPlayer.Name : CONFIG.accountName} Music] I am already here in ${roomName}! Ready for music requests 🎧`
            );
            return;
        }

        console.log(`🚪 Leaving current room "${currentRoomData?.Name || 'Unknown'}" to join "${roomName}"...`);
        try {
            socket.emit("ChatRoomLeave", "");
        } catch (e) {
            console.error("Error leaving room:", e);
        }
        isInRoom = false;
        currentRoomData = null;
        if (trackEndTimer) {
            clearTimeout(trackEndTimer);
            trackEndTimer = null;
        }
        songQueue.length = 0;
        currentTrack = null;
        currentStation = null;
        stopVibeAnimation();

        setTimeout(() => {
            console.log(`🚪 Joining new room: "${roomName}"...`);
            joinTargetRoom(socket, roomName, space);
        }, 600);
    } else {
        console.log(`🚪 Joining room: "${roomName}"...`);
        joinTargetRoom(socket, roomName, space);
    }
}

function isBotAdmin() {
    if (!botPlayer || !currentRoomData || !Array.isArray(currentRoomData.Admin)) return false;
    return currentRoomData.Admin.includes(botPlayer.MemberNumber);
}

/**
 * Broadcasts music to room via native BC Room Customization (Custom.MusicURL).
 * Must use MemberNumber: 0 in ChatRoomAdmin so game server accepts the update.
 */
function setRoomMusic(socket, musicUrl, title = "", duration = 0, trackInfo = null) {
    if (!currentRoomData) {
        console.warn("⚠️ Failed to set room music: Bot is not currently inside a room.");
        return;
    }

    const myId = botPlayer ? botPlayer.MemberNumber : 0;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (!isBotAdmin()) {
        sendRoomEmote(
            socket,
            `* ⚠️ [${myName} Music] I need Room Admin privileges to broadcast music to EVERYONE in the room. Please grant Admin to ${myName} (#${myId})!`
        );
        return;
    }

    if (musicUrl && !musicUrl.toLowerCase().includes(".mp3") && !musicUrl.toLowerCase().includes(".mp4")) {
        sendRoomEmote(
            socket,
            `* ⚠️ [${myName} Music] The game server only allows audio links ending with .mp3 or .mp4 format!`
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
            MusicURL: musicUrl ? musicUrl : "",
            MusicStart: musicUrl ? Date.now() : 0,
        },
    };

    if (currentRoomData.Custom) {
        currentRoomData.Custom.MusicURL = musicUrl ? musicUrl : "";
        currentRoomData.Custom.MusicStart = musicUrl ? Date.now() : 0;
    }

    console.log(`📻 [Room Music Broadcast] Updating room MusicURL to: "${musicUrl || ''}" (Empty: ${!musicUrl})`);
    socket.emit("ChatRoomAdmin", {
        MemberNumber: 0,
        Room: updatedRoom,
        Action: "Update",
    });

    changeFaceExpression(socket, "Eyes", "Happy");
    changeFaceExpression(socket, "Mouth", "Smile");

    if (trackEndTimer) {
        clearTimeout(trackEndTimer);
        trackEndTimer = null;
    }

    if (musicUrl) {
        currentTrack = trackInfo || {
            title: title || musicUrl,
            directUrl: musicUrl,
            duration: duration || 0,
            requestedBy: "DJ",
            startedAt: Date.now(),
        };

        sendRoomEmote(
            socket,
            `* 🎧 [${myName} Music] Now playing for EVERYONE in the room: ${title || musicUrl} 🎶 (Auto-synced to all players' speakers)`
        );

        if (duration && duration > 0) {
            console.log(`[Playback Timer] Track duration: ${duration}s. Scheduling next queue track in ${duration + 3}s...`);
            trackEndTimer = setTimeout(() => {
                playNextInQueue(socket);
            }, (duration + 3) * 1000);
        }
    } else {
        currentTrack = null;
        currentStation = null;
        if (title !== "SILENT_STOP") {
            sendRoomEmote(
                socket,
                `* 🔇 [${myName} Music] Room music has been stopped for all players.`
            );
        }
    }
}

/**
 * Plays next song in queue when previous finishes or is skipped.
 */
function playNextInQueue(socket) {
    if (trackEndTimer) {
        clearTimeout(trackEndTimer);
        trackEndTimer = null;
    }

    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (songQueue.length > 0) {
        const nextSong = songQueue.shift();
        console.log(`[Queue] Playing next track: "${nextSong.title}" (Requested by Member #${nextSong.requestedBy})`);
        setRoomMusic(socket, nextSong.directUrl, `YouTube: ${nextSong.title}`, nextSong.duration, nextSong);
        sendRoomEmote(
            socket,
            `* 🎶 [${myName} Music] Up next from queue: "${nextSong.title}" (Requested by Member #${nextSong.requestedBy})!`
        );
    } else {
        currentTrack = null;
        currentStation = null;
        console.log(`[Queue] All tracks finished and queue is empty. Clearing room Custom.MusicURL so audio does not repeat.`);
        setRoomMusic(socket, "", "SILENT_STOP");
        sendRoomEmote(
            socket,
            `* 🎵 [${myName} Music] Song finished and queue is empty. Room music stopped. Feel free to request songs with !play <title or link> 🎧`
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

/**
 * Uploads converted MP3 to tmpfile.link (https://tmpfile.link/index-id)
 * Generates direct high-speed Cloudflare R2 links ending in .mp3
 */
async function uploadToTmpfileLink(buffer, filename = "track.mp3") {
    console.log(`[Upload tmpfile.link] Uploading ${filename} (${buffer.length} bytes)...`);
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch("https://tmpfile.link/api/upload", {
        method: "POST",
        body: formData,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://tmpfile.link/index-id",
            "Origin": "https://tmpfile.link"
        }
    });

    if (!res.ok) {
        throw new Error(`tmpfile.link upload HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data || !data.downloadLink) {
        throw new Error("Invalid response from tmpfile.link: " + JSON.stringify(data));
    }

    return data.downloadLink;
}

/**
 * Fallback uploader if tmpfile.link is unavailable
 */
async function uploadToTmpfilesOrg(buffer, filename = "track.mp3") {
    console.log(`[Upload tmpfiles.org] Uploading fallback ${filename} (${buffer.length} bytes)...`);
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body: formData,
    });
    const data = await res.json();
    if (data && data.data && data.data.url) {
        return data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
    throw new Error("Failed to upload fallback to tmpfiles.org");
}

async function uploadAudio(buffer, filename) {
    try {
        return await uploadToTmpfileLink(buffer, filename);
    } catch (err) {
        console.warn("[Upload Warning] tmpfile.link failed (" + err.message + "), trying fallback tmpfiles.org...");
        return await uploadToTmpfilesOrg(buffer, filename);
    }
}

/**
 * Attempts conversion via ytmp3.gg backend (https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo)
 */
async function convertViaYtmp3(youtubeUrl) {
    console.log(`[ytmp3.gg] Attempting API conversion: ${youtubeUrl}`);
    const res = await fetch("https://ytdl.convert1s.com/api/v2/download", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": "https://media.ytmp3.gg",
            "Referer": "https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo"
        },
        body: JSON.stringify({
            url: youtubeUrl,
            output: { type: "audio", format: "mp3" }
        })
    });

    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const job = await res.json();
    if (!job || !job.statusUrl) throw new Error("statusUrl not found");

    const title = job.title || "YouTube Audio";
    const statusUrl = job.statusUrl;

    for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const sRes = await fetch(statusUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://media.ytmp3.gg",
                "Referer": "https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo"
            }
        });
        if (!sRes.ok) continue;
        const sData = await sRes.json();
        if (sData.downloadUrl) {
            console.log(`[ytmp3.gg] Audio conversion complete! URL: ${sData.downloadUrl}`);
            const aRes = await fetch(sData.downloadUrl);
            const buf = await aRes.arrayBuffer();
            return { title, buffer: Buffer.from(buf), duration: job.duration || 0 };
        }
        if (sData.status === "error") throw new Error("Status error: " + (sData.error || sData.message));
    }
    throw new Error("ytmp3.gg queue took longer than 12 seconds");
}

/**
 * Fast local conversion via yt-dlp + ffmpeg directly in converted_tracks/ folder
 */
function convertViaYtDlp(queryOrUrl) {
    return new Promise((resolve, reject) => {
        const fileId = "track_" + Date.now();
        const outputPath = path.join(CONVERT_DIR, `${fileId}.%(ext)s`);
        const finalMp3Path = path.join(CONVERT_DIR, `${fileId}.mp3`);
        const titleFilePath = path.join(CONVERT_DIR, `${fileId}_title.txt`);
        const durationFilePath = path.join(CONVERT_DIR, `${fileId}_duration.txt`);

        const target = (queryOrUrl.startsWith("http://") || queryOrUrl.startsWith("https://")) 
            ? queryOrUrl 
            : `ytsearch1:${queryOrUrl}`;

        const args = [
            "-m", "yt_dlp",
            "--no-cache-dir",
            "--ffmpeg-location", ffmpegPath,
            "-x", "--audio-format", "mp3",
            "--audio-quality", "5",
            "--max-filesize", "30M",
            "--no-playlist",
            "--print-to-file", "%(title)s", titleFilePath,
            "--print-to-file", "%(duration)s", durationFilePath,
            "-o", outputPath,
            target
        ];

        console.log(`[yt-dlp] Converting "${queryOrUrl}" in folder: ${CONVERT_DIR}...`);
        execFile("python", args, { timeout: 75000 }, (err, stdout, stderr) => {
            let title = queryOrUrl;
            let duration = 0;

            if (fs.existsSync(titleFilePath)) {
                try {
                    title = fs.readFileSync(titleFilePath, "utf8").trim() || queryOrUrl;
                    fs.unlinkSync(titleFilePath);
                } catch(_) {}
            }

            if (fs.existsSync(durationFilePath)) {
                try {
                    const durRaw = fs.readFileSync(durationFilePath, "utf8").trim();
                    duration = parseInt(durRaw, 10) || 0;
                    fs.unlinkSync(durationFilePath);
                } catch(_) {}
            }

            if (err) {
                cleanLocalFiles(fileId);
                return reject(err);
            }

            if (!fs.existsSync(finalMp3Path)) {
                cleanLocalFiles(fileId);
                return reject(new Error("Converted MP3 file was not found."));
            }

            const buffer = fs.readFileSync(finalMp3Path);
            // Immediately clean up temporary local audio file after reading into memory
            cleanLocalFiles(fileId);
            resolve({ title, buffer, duration });
        });
    });
}

/**
 * Main YouTube -> MP3 -> tmpfile.link pipeline
 * Ensures converted audio file is deleted from local disk after upload.
 */
async function convertYoutubeToMp3(queryOrUrl) {
    let result = null;
    const isUrl = queryOrUrl.startsWith("http://") || queryOrUrl.startsWith("https://");

    try {
        if (isUrl && (queryOrUrl.includes("youtube.com") || queryOrUrl.includes("youtu.be"))) {
            try {
                result = await convertViaYtmp3(queryOrUrl);
            } catch (e) {
                console.log(`[YouTube] Info ytmp3.gg (${e.message}), switching automatically to fast local extractor...`);
            }
        }

        if (!result) {
            result = await convertViaYtDlp(queryOrUrl);
        }

        const safeTitle = (result.title || "song").replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 30);
        const filename = `${safeTitle}_${Date.now()}.mp3`;
        const directUrl = await uploadAudio(result.buffer, filename);

        // Free buffer memory and guarantee converted_tracks is clear
        result.buffer = null;
        cleanLocalFiles();

        console.log(`[YouTube] Success! Title: "${result.title}", Direct URL: ${directUrl}, Duration: ${result.duration}s`);
        console.log(`🧹 [Storage] Local converted file for "${result.title}" has been deleted from ${CONVERT_DIR}.`);
        return { title: result.title, directUrl, duration: result.duration || 0 };
    } catch (err) {
        cleanLocalFiles();
        throw err;
    }
}

function handleRoomCommand(socket, text, sender) {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (cmd === "!help" || cmd === "!music") {
        changeFaceExpression(socket, "Eyes", "Wink");
        sendRoomEmote(
            socket,
            `* 🎵 [${myName} Music]: Standalone DJ playing synced room music for everyone! Commands: !play <song/link> | !queue | !skip | !clear | !radio <genre> | !stop | !np | !whitelist <id>`
        );
        setTimeout(() => {
            sendRoomEmote(
                socket,
                `* 📻 Radio Genres: lofi, synth, chillsynth, pop, dance, rock, hiphop, jazz. Example: !radio synth`
            );
        }, 1200);
    } else if (cmd === "!play" || cmd === "!yt") {
        const urlMatch = text.match(/https?:\/\/[^\s\)\>\]]+/i);
        let extractedUrl = urlMatch ? urlMatch[0].replace(/[\)\>\]\.\,\'\"\`]+$/, "") : null;

        const rawAfterCmd = text.slice(text.indexOf(parts[0]) + parts[0].length).trim();
        const cleanQuery = rawAfterCmd.replace(/^[\(\[\<\"\']+|[\)\]\>\"\']+$/g, "").trim();

        const isDirectAudio = extractedUrl && (extractedUrl.toLowerCase().includes(".mp3") || extractedUrl.toLowerCase().includes(".mp4"));
        const isYoutube = (extractedUrl && (extractedUrl.includes("youtube.com") || extractedUrl.includes("youtu.be"))) || (!isDirectAudio && cleanQuery.length > 0);

        if (!cleanQuery && !extractedUrl) {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] Please provide a song title, YouTube link, or .mp3 URL! Example: !play https://youtu.be/... or !play linkin park numb`
            );
            return;
        }

        // Direct MP3 URL
        if (isDirectAudio) {
            if (!currentTrack) {
                setRoomMusic(socket, extractedUrl, `Custom Audio (${path.basename(new URL(extractedUrl).pathname)})`);
            } else {
                if (songQueue.length >= MAX_QUEUE) {
                    sendRoomEmote(socket, `* ⚠️ [${myName} Music] The song queue is full! Maximum ${MAX_QUEUE} songs allowed.`);
                    return;
                }
                const trackTitle = `Custom Audio (${path.basename(new URL(extractedUrl).pathname)})`;
                songQueue.push({
                    title: trackTitle,
                    directUrl: extractedUrl,
                    duration: 0,
                    requestedBy: sender,
                });
                sendRoomEmote(socket, `* 📋 [${myName} Music] Added to queue (#${songQueue.length}/${MAX_QUEUE}): "${trackTitle}" (Requested by Member #${sender}) 🎶`);
            }
            return;
        }

        // YouTube track or search query
        const targetSong = extractedUrl || cleanQuery;

        if (currentTrack && songQueue.length >= MAX_QUEUE) {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] The song queue is full! Maximum ${MAX_QUEUE} songs allowed.`
            );
            return;
        }

        if (isConverting) {
            sendRoomEmote(
                socket,
                `* ⏳ [${myName} Music] Another song is currently converting. Please wait a few seconds!`
            );
            return;
        }

        isConverting = true;
        changeFaceExpression(socket, "Eyes", "Thinking");
        sendRoomEmote(
            socket,
            `* ⏳ [${myName} Music] Converting audio for "${targetSong}"... Please wait a few seconds! 🎧`
        );

        convertYoutubeToMp3(targetSong)
            .then(({ title, directUrl, duration }) => {
                isConverting = false;

                if (!currentTrack) {
                    // Nothing playing: play immediately
                    setRoomMusic(socket, directUrl, `YouTube: ${title}`, duration, {
                        title,
                        directUrl,
                        duration,
                        requestedBy: sender,
                    });
                } else {
                    // Something is already playing: add to queue
                    songQueue.push({
                        title,
                        directUrl,
                        duration,
                        requestedBy: sender,
                    });
                    changeFaceExpression(socket, "Eyes", "Happy");
                    sendRoomEmote(
                        socket,
                        `* 📋 [${myName} Music] Added to queue (#${songQueue.length}/${MAX_QUEUE}): "${title}" (Requested by Member #${sender}) 🎶`
                    );
                }
            })
            .catch((err) => {
                isConverting = false;
                changeFaceExpression(socket, "Eyes", "Sad");
                console.error("[YouTube Conversion Error]", err);
                sendRoomEmote(
                    socket,
                    `* ⚠️ [${myName} Music] Failed to convert that YouTube track. Please make sure the link is accessible!`
                );
            });
    } else if (cmd === "!queue" || cmd === "!q") {
        if (!currentTrack && songQueue.length === 0) {
            sendRoomEmote(
                socket,
                `* 📋 [${myName} Music] The song queue is currently empty! Use !play <song/link> to request a track.`
            );
            return;
        }

        let lines = [`* 📋 [${myName} Music] Queue Status (${songQueue.length}/${MAX_QUEUE}):`];
        if (currentTrack) {
            lines.push(`▶️ [Now Playing]: "${currentTrack.title}" (Requested by Member #${currentTrack.requestedBy || 'DJ'})`);
        }
        if (songQueue.length > 0) {
            lines.push(`📑 [Upcoming Tracks]:`);
            songQueue.forEach((item, idx) => {
                lines.push(`${idx + 1}. "${item.title}" (Requested by #${item.requestedBy})`);
            });
        } else {
            lines.push(`(No more tracks in queue)`);
        }
        sendRoomEmote(socket, lines.join("\n"));
    } else if (cmd === "!skip" || cmd === "!next") {
        if (!currentTrack && songQueue.length === 0) {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] No song is currently playing to skip!`
            );
            return;
        }
        sendRoomEmote(
            socket,
            `* ⏭️ [${myName} Music] Track skipped by Member #${sender}!`
        );
        playNextInQueue(socket);
    } else if (cmd === "!clear") {
        const count = songQueue.length;
        songQueue.length = 0;
        sendRoomEmote(
            socket,
            `* 🗑️ [${myName} Music] Cleared ${count} song(s) from the queue (Requested by Member #${sender}).`
        );
    } else if (cmd === "!radio") {
        const key = (parts[1] || "").toLowerCase().replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();
        if (STATIONS[key]) {
            currentStation = STATIONS[key];
            songQueue.length = 0;
            if (trackEndTimer) {
                clearTimeout(trackEndTimer);
                trackEndTimer = null;
            }
            setRoomMusic(socket, currentStation.url, currentStation.name);
        } else {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] Available genres: lofi, synth, chillsynth, pop, dance, rock, hiphop, jazz. Example: !radio synth`
            );
        }
    } else if (cmd === "!stop") {
        songQueue.length = 0;
        currentStation = null;
        if (trackEndTimer) {
            clearTimeout(trackEndTimer);
            trackEndTimer = null;
        }
        setRoomMusic(socket, "", "");
    } else if (cmd === "!np") {
        if (currentTrack) {
            sendRoomEmote(
                socket,
                `* 🎵 [${myName} Music] Now playing: "${currentTrack.title}" (Requested by Member #${currentTrack.requestedBy || 'DJ'}) 🎧`
            );
        } else if (currentStation) {
            sendRoomEmote(
                socket,
                `* 🎵 [${myName} Music] Now playing 24/7 radio: ${currentStation.name} 🎧`
            );
        } else {
            sendRoomEmote(
                socket,
                `* 🔇 [${myName} Music] No music is currently playing in the room. Type !play <song> or !radio <genre> to start!`
            );
        }
    } else if (cmd === "!admin") {
        sendRoomEmote(
            socket,
            `* ⚠️ [${myName} Music] Granting Room Admin via bot is disabled. Room Admins can add members to the room Whitelist using !whitelist <member_number>.`
        );
    } else if (cmd === "!whitelist" || cmd === "!wl") {
        if (!isBotAdmin()) {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] I need Room Admin privileges myself to modify the room Whitelist.`
            );
            return;
        }

        // Only existing room admins can command the bot to whitelist members
        const senderIsAdmin = currentRoomData && Array.isArray(currentRoomData.Admin) && currentRoomData.Admin.includes(sender);
        if (!senderIsAdmin) {
            sendRoomEmote(
                socket,
                `* ⛔ [${myName} Music] Permission denied! Only Room Admins can add members to the room Whitelist.`
            );
            return;
        }

        const rawTarget = parts[1] || "";
        const targetId = parseInt(rawTarget.replace(/[#\(\)\,\.]/g, ""), 10);
        if (!targetId || isNaN(targetId) || targetId <= 0) {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] Please specify a valid member number! Example: !whitelist 254143`
            );
            return;
        }

        if (!Array.isArray(currentRoomData.Whitelist)) {
            currentRoomData.Whitelist = [];
        }

        if (currentRoomData.Whitelist.includes(targetId)) {
            sendRoomEmote(
                socket,
                `* ℹ️ [${myName} Music] Member #${targetId} is already on the room Whitelist!`
            );
            return;
        }

        currentRoomData.Whitelist.push(targetId);
        socket.emit("ChatRoomAdmin", {
            MemberNumber: 0,
            Room: currentRoomData,
            Action: "Update",
        });

        sendRoomEmote(
            socket,
            `* 📜 [${myName} Music] Member #${targetId} has been successfully added to the room Whitelist (Authorized by Admin #${sender})!`
        );
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

process.on("SIGINT", () => {
    console.log("\n🛑 Stopping bot & cleaning local storage...");
    cleanLocalFiles();
    process.exit(0);
});

process.on("SIGTERM", () => {
    cleanLocalFiles();
    process.exit(0);
});

startBot().catch((err) => console.error("Fatal Error:", err));
