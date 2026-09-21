/**
 * Music Playback & Queue Management Service
 * Handles audio queue state, YouTube conversion dispatch, 
 * 24/7 radio station playback, track duration auto-advance timer,
 * and synchronized room audio broadcast via native BC Room Customization (Custom.MusicURL).
 */

const { CONFIG, STATIONS, MAX_QUEUE, MAX_TRACK_DURATION } = require("../config");
const { convertYoutubeToMp3, sanitizeQueryOrUrl } = require("./audio");

// Queue & Playback State
const songQueue = []; // Items: { title, directUrl, duration, requestedBy, requesterName }
let currentTrack = null; // { title, directUrl, duration, requestedBy, requesterName, startedAt }
let trackEndTimer = null;
let currentStation = null;
let isConverting = false;

function getQueueState() {
    return {
        songQueue,
        currentTrack,
        currentStation,
        isConverting,
    };
}

function resetQueue() {
    songQueue.length = 0;
    currentTrack = null;
    currentStation = null;
    if (trackEndTimer) {
        clearTimeout(trackEndTimer);
        trackEndTimer = null;
    }
}

function isBotAdmin(botPlayer, currentRoomData) {
    if (!botPlayer || !currentRoomData || !Array.isArray(currentRoomData.Admin)) return false;
    return currentRoomData.Admin.includes(botPlayer.MemberNumber);
}

/**
 * Broadcasts music to room via native BC Room Customization (Custom.MusicURL).
 * Uses MemberNumber: 0 in ChatRoomAdmin packet so server accepts the update.
 */
function setRoomMusic(context, musicUrl, title = "", duration = 0, trackInfo = null) {
    const { socket, botPlayer, currentRoomData, sendRoomEmote, changeFaceExpression } = context;

    if (!currentRoomData) {
        console.warn("⚠️ Failed to set room music: Bot is not currently inside a room.");
        return;
    }

    const myId = botPlayer ? botPlayer.MemberNumber : 0;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (!isBotAdmin(botPlayer, currentRoomData)) {
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

    if (typeof changeFaceExpression === "function") {
        changeFaceExpression(socket, "Eyes", "Happy");
        changeFaceExpression(socket, "Mouth", "Smile");
    }

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
            requesterName: "DJ",
            startedAt: Date.now(),
        };

        if (title !== "SILENT_STOP" && typeof sendRoomEmote === "function") {
            sendRoomEmote(
                socket,
                `* 🎵 [${myName} Music] Now playing: "${title}" for everyone in the room! 🎧`
            );
        }

        // Auto-play next track when duration expires
        if (duration && duration > 0) {
            const bufferMs = 4000;
            const waitMs = (duration * 1000) + bufferMs;
            console.log(`⏱️ Auto-advance timer set for ${Math.round(waitMs / 1000)}s based on audio length.`);
            trackEndTimer = setTimeout(() => {
                console.log(`⌛ Track duration finished (${duration}s). Moving to next song...`);
                playNextInQueue(context);
            }, waitMs);
        }
    } else {
        currentTrack = null;
        if (title !== "SILENT_STOP" && typeof sendRoomEmote === "function") {
            sendRoomEmote(socket, `* 🔇 [${myName} Music] Music stopped.`);
        }
    }

    if (typeof context.notifyWebRefresh === "function") {
        context.notifyWebRefresh();
    }
}

/**
 * Plays the next song in the queue, or resets playback if empty.
 */
function playNextInQueue(context) {
    const { socket, botPlayer, sendRoomEmote } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (trackEndTimer) {
        clearTimeout(trackEndTimer);
        trackEndTimer = null;
    }

    if (songQueue.length > 0) {
        const next = songQueue.shift();
        const reqName = next.requesterName || context.getCharacterName(next.requestedBy);
        console.log(`▶️ [Queue] Advancing to next track: "${next.title}" (Requested by ${reqName})`);

        setRoomMusic(context, next.directUrl, `${next.title}`, next.duration, next);
        if (typeof sendRoomEmote === "function") {
            sendRoomEmote(
                socket,
                `* ⏭️ [${myName} Music] Next up from queue: "${next.title}" (Requested by ${reqName}) 🎶`
            );
        }
    } else {
        currentTrack = null;
        currentStation = null;
        console.log(`[Queue] All tracks finished and queue is empty. Clearing room Custom.MusicURL.`);
        setRoomMusic(context, "", "SILENT_STOP");
    }
}

/**
 * Request a song to play or queue (supports Direct URL and YouTube queries).
 */
async function playSong(context, query, source = "Chat", requesterId = 0, requesterName = "") {
    const { socket, botPlayer, currentRoomData, sendRoomEmote } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    const name = requesterName || context.getCharacterName(requesterId) || "Guest";

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        const msg = `⚠️ [${myName} Music] I need Room Admin privileges to broadcast audio to everyone in the room!`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ${msg}`);
        return { success: false, message: msg };
    }

    if (!query || !query.trim()) {
        const msg = `Please provide a song title or URL! Example: !play Linkin Park Numb`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ℹ️ [${myName} Music] ${msg}`);
        return { success: false, message: msg };
    }

    const cleanQuery = sanitizeQueryOrUrl(query);
    if (!cleanQuery) {
        const msg = `Please provide a valid song title or URL! Example: !play Linkin Park Numb`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ℹ️ [${myName} Music] ${msg}`);
        return { success: false, message: msg };
    }

    // Direct MP3 or MP4 Audio Stream
    if (cleanQuery.startsWith("http://") || cleanQuery.startsWith("https://")) {
        const isDirectAudio = cleanQuery.toLowerCase().includes(".mp3") || cleanQuery.toLowerCase().includes(".mp4");
        const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(cleanQuery);

        if (isDirectAudio && !isYouTube) {
            currentStation = null;
            const trackItem = {
                title: cleanQuery.split("/").pop().split("?")[0] || "Direct Audio Stream",
                directUrl: cleanQuery,
                duration: 0,
                requestedBy: requesterId,
                requesterName: name,
                startedAt: Date.now(),
            };

            if (!currentTrack) {
                setRoomMusic(context, cleanQuery, trackItem.title, 0, trackItem);
                return { success: true, message: `Now playing direct stream: ${trackItem.title}` };
            } else {
                if (songQueue.length >= MAX_QUEUE) {
                    const msg = `Antrean lagu sudah penuh (${MAX_QUEUE} lagu). Harap tunggu!`;
                    if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ⚠️ [${myName} Music] ${msg}`);
                    return { success: false, message: msg };
                }
                songQueue.push(trackItem);
                if (typeof sendRoomEmote === "function") {
                    sendRoomEmote(
                        socket,
                        `* 📋 [${myName} Music] Direct audio added to queue [#${songQueue.length}]: "${trackItem.title}"`
                    );
                }
                if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
                return { success: true, message: `Added to queue: ${trackItem.title}` };
            }
        }
    }

    // YouTube Audio Extraction & Conversion
    if (isConverting) {
        const msg = `Sedang memproses lagu lain, mohon tunggu beberapa detik...`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ⏳ [${myName} Music] ${msg}`);
        return { success: false, message: msg };
    }

    if (songQueue.length >= MAX_QUEUE) {
        const msg = `Antrean lagu sudah penuh (${MAX_QUEUE} lagu). Harap tunggu lagu selesai!`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ⚠️ [${myName} Music] ${msg}`);
        return { success: false, message: msg };
    }

    isConverting = true;
    if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();

    if (typeof sendRoomEmote === "function") {
        sendRoomEmote(
            socket,
            `* 🔍 [${myName} Music] Searching & downloading "${cleanQuery}"... please wait 🎧`
        );
    }

    try {
        const result = await convertYoutubeToMp3(cleanQuery);
        isConverting = false;

        const directUrl = result ? (result.directUrl || result.publicUrl) : null;
        if (!result || !directUrl) {
            const err = (result && result.error) || "Gagal mengunduh audio YouTube.";
            if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ❌ [${myName} Music] ${err}`);
            if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
            return { success: false, message: err };
        }

        const trackItem = {
            title: result.title || "YouTube Audio",
            directUrl: directUrl,
            duration: result.duration || 0,
            requestedBy: requesterId,
            requesterName: name,
            startedAt: Date.now(),
        };

        currentStation = null;

        if (!currentTrack) {
            setRoomMusic(context, trackItem.directUrl, trackItem.title, trackItem.duration, trackItem);
            return { success: true, message: `Now playing: ${trackItem.title}` };
        } else {
            songQueue.push(trackItem);
            if (typeof sendRoomEmote === "function") {
                sendRoomEmote(
                    socket,
                    `* 📋 [${myName} Music] Added to queue [#${songQueue.length}]: "${trackItem.title}" (${name}) 🎶`
                );
            }
            if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
            return { success: true, message: `Added to queue: ${trackItem.title}` };
        }
    } catch (err) {
        isConverting = false;
        console.error("❌ Play error:", err);
        if (typeof sendRoomEmote === "function") {
            sendRoomEmote(socket, `* ❌ [${myName} Music] Error processing request: ${err.message}`);
        }
        if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
        return { success: false, message: err.message };
    }
}

/**
 * Skip currently playing track.
 */
function skipSong(context, requester = "DJ") {
    const { socket, botPlayer, sendRoomEmote } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (!currentTrack && !currentStation) {
        const msg = `Tidak ada musik yang sedang diputar untuk di-skip.`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ℹ️ [${myName} Music] ${msg}`);
        return { success: false, message: msg };
    }

    const skippedTitle = currentTrack ? currentTrack.title : (currentStation ? currentStation.name : "Track");
    console.log(`⏭️ [Skip] Song skipped by ${requester}: "${skippedTitle}"`);

    if (typeof sendRoomEmote === "function") {
        sendRoomEmote(socket, `* ⏭️ [${myName} Music] Skipped: "${skippedTitle}" (by ${requester})`);
    }

    playNextInQueue(context);
    return { success: true, message: `Skipped ${skippedTitle}` };
}

/**
 * Stop all room music and clear queue.
 */
function stopSong(context, requester = "DJ") {
    const { socket, botPlayer, sendRoomEmote } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    resetQueue();
    setRoomMusic(context, "", "SILENT_STOP");

    console.log(`⏹️ [Stop] Music stopped and queue cleared by ${requester}.`);
    if (typeof sendRoomEmote === "function") {
        sendRoomEmote(socket, `* ⏹️ [${myName} Music] Music stopped and queue cleared (by ${requester}).`);
    }

    return { success: true, message: "Music stopped and queue cleared." };
}

/**
 * Clear only the upcoming song queue without stopping currently playing song.
 */
function clearQueue(context, requester = "DJ") {
    const { socket, botPlayer, sendRoomEmote } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    const count = songQueue.length;
    songQueue.length = 0;

    console.log(`🗑️ [Queue Clear] ${count} songs cleared from queue by ${requester}.`);
    if (typeof sendRoomEmote === "function") {
        sendRoomEmote(socket, `* 🗑️ [${myName} Music] Cleared ${count} songs from the queue (by ${requester}).`);
    }

    if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
    return { success: true, message: `Cleared ${count} songs from queue.` };
}

/**
 * Play a curated 24/7 radio station.
 */
function playRadio(context, genreKey, requester = "DJ") {
    const { socket, botPlayer, currentRoomData, sendRoomEmote } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        const msg = `⚠️ [${myName} Music] I need Room Admin privileges to play radio in this room!`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ${msg}`);
        return { success: false, message: msg };
    }

    const key = (genreKey || "lofi").toLowerCase();
    const station = STATIONS[key] || STATIONS["lofi"];

    if (!station) {
        const available = Object.keys(STATIONS).join(", ");
        const msg = `Stasiun tidak ditemukan. Pilihan stasiun: ${available}`;
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, `* ℹ️ [${myName} Music] ${msg}`);
        return { success: false, message: msg };
    }

    currentStation = station;
    resetQueue();

    const trackInfo = {
        title: `📻 24/7 Radio: ${station.name}`,
        directUrl: station.url,
        duration: 0,
        requestedBy: "Radio",
        requesterName: requester,
        startedAt: Date.now(),
    };

    setRoomMusic(context, station.url, `📻 24/7 Radio: ${station.name}`, 0, trackInfo);
    return { success: true, message: `Playing radio station: ${station.name}` };
}

module.exports = {
    getQueueState,
    resetQueue,
    isBotAdmin,
    setRoomMusic,
    playNextInQueue,
    playSong,
    skipSong,
    stopSong,
    clearQueue,
    playRadio,
};

