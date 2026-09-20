/**
 * Room Chat Command Handler & Music Queue Manager
 * Processes in-room chat commands (!play, !queue, !skip, !radio, !friend, etc.)
 * and manages music playback synchronization for Bondage Club rooms.
 */

const path = require("path");
const { CONFIG, STATIONS, MAX_QUEUE, MAX_TRACK_DURATION, MASTER_ADMINS } = require("../config");
const { convertYoutubeToMp3 } = require("../services/audio");
const { acceptFriendRequest } = require("../services/friends");

// Queue system
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

/**
 * Extracts and cleans command text from chat messages,
 * supporting normal commands (!play ...) and bracketed inputs like:
 * (!play url), [!play url], {!play url}, or unclosed brackets.
 */
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

function isBotAdmin(botPlayer, currentRoomData) {
    if (!botPlayer || !currentRoomData || !Array.isArray(currentRoomData.Admin)) return false;
    return currentRoomData.Admin.includes(botPlayer.MemberNumber);
}

function checkIsAdmin(botPlayer, currentRoomData, senderId) {
    const id = Number(senderId);
    if (!id) return false;
    if (MASTER_ADMINS && MASTER_ADMINS.has(id)) return true;
    if (currentRoomData && Array.isArray(currentRoomData.Admin) && currentRoomData.Admin.includes(id)) {
        return true;
    }
    return false;
}

function getAdminMenuMessage(myName) {
    return `🔒 [${myName} Admin Menu]:\n` +
        `• Authorized: !addauth <id> | !delauth <id> | !authlist\n` +
        `• Admin: !admin <id> | !deladmin <id> | !adminlist\n` +
        `• Whitelist: !whitelist <id> | !delwhitelist <id> | !whitelistlist\n` +
        `• Banlist: !ban <id> | !unban <id> | !banlist\n` +
        `• Kick: !kick <id>\n` +
        `Example: /w ${myName} !addauth 254143`;
}

function getHelpMessage(myName) {
    const maxMins = Math.round(MAX_TRACK_DURATION / 60);
    return `🎵 [${myName} Music Commands]:\n` +
        `• Play: !play <title / YouTube link> (Max: ${maxMins} mins)\n` +
        `• Queue: !queue | !skip | !clear | !stop | !np\n` +
        `• Radio: !radio <genre> (lofi, synth, chillsynth, pop, dance, rock, hiphop, jazz)`;
}

/**
 * Broadcasts music to room via native BC Room Customization (Custom.MusicURL).
 * Must use MemberNumber: 0 in ChatRoomAdmin so game server accepts the update.
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
            requesterName: "DJ",
            startedAt: Date.now(),
        };

        if (title !== "SILENT_STOP") {
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
        if (title !== "SILENT_STOP") {
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
        sendRoomEmote(
            socket,
            `* ⏭️ [${myName} Music] Next up from queue: "${next.title}" (Requested by ${reqName}) 🎶`
        );
    } else {
        currentTrack = null;
        currentStation = null;
        console.log(`[Queue] All tracks finished and queue is empty. Clearing room Custom.MusicURL so audio does not repeat.`);
        setRoomMusic(context, "", "SILENT_STOP");
        sendRoomEmote(
            socket,
            `* 🎵 [${myName} Music] Song finished and queue is empty. Room music stopped. Feel free to request songs with !play <title or link> 🎧`
        );
    }
}

/**
 * Modular action: Plays or queues a song from a query or URL.
 */
async function playSong(context, inputQuery, sender = "DJ", customSenderName = null) {
    const { socket, botPlayer, sendRoomEmote, changeFaceExpression, getCharacterName } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    const senderName = customSenderName || (getCharacterName ? getCharacterName(sender) : String(sender));

    if (!inputQuery || typeof inputQuery !== "string") {
        return { success: false, message: "Please provide a song title or URL." };
    }

    const text = inputQuery.trim();
    const urlMatch = text.match(/https?:\/\/[^\s\)\>\]]+/i);
    let extractedUrl = urlMatch ? urlMatch[0].replace(/[\)\>\]\.\,\'\"\`]+$/, "") : null;
    const cleanQuery = text.replace(/^[\(\[\<\"\']+|[\)\]\>\"\']+$/g, "").trim();

    const isDirectAudio = extractedUrl && (extractedUrl.toLowerCase().includes(".mp3") || extractedUrl.toLowerCase().includes(".mp4"));

    if (!cleanQuery && !extractedUrl) {
        const maxMins = Math.round(MAX_TRACK_DURATION / 60);
        sendRoomEmote(
            socket,
            `* ⚠️ [${myName} Music] Please provide a song title or YouTube link (Max: ${maxMins} mins)! Example: !play https://youtu.be/... or !play linkin park numb`
        );
        return { success: false, message: "Song title or YouTube link required." };
    }

    // Direct MP3/MP4 URL
    if (isDirectAudio) {
        const trackTitle = `Custom Audio (${path.basename(new URL(extractedUrl).pathname)})`;
        if (!currentTrack) {
            setRoomMusic(context, extractedUrl, trackTitle, 0, {
                title: trackTitle,
                directUrl: extractedUrl,
                duration: 0,
                requestedBy: sender,
                requesterName: senderName,
            });
            return { success: true, message: `Now playing: ${trackTitle}` };
        } else {
            if (songQueue.length >= MAX_QUEUE) {
                sendRoomEmote(socket, `* ⚠️ [${myName} Music] The song queue is full! Maximum ${MAX_QUEUE} songs allowed.`);
                return { success: false, message: "Queue is full (max 20)." };
            }
            songQueue.push({
                title: trackTitle,
                directUrl: extractedUrl,
                duration: 0,
                requestedBy: sender,
                requesterName: senderName,
            });
            sendRoomEmote(socket, `* 📋 [${myName} Music] Added to queue (#${songQueue.length}/${MAX_QUEUE}): "${trackTitle}" (Requested by ${senderName}) 🎶`);
            if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
            return { success: true, message: `Added to queue (#${songQueue.length}): ${trackTitle}` };
        }
    }

    // YouTube track or search query
    const targetSong = extractedUrl || cleanQuery;

    if (currentTrack && songQueue.length >= MAX_QUEUE) {
        sendRoomEmote(
            socket,
            `* ⚠️ [${myName} Music] The song queue is full! Maximum ${MAX_QUEUE} songs allowed.`
        );
        return { success: false, message: "Queue is full (max 20)." };
    }

    if (isConverting) {
        sendRoomEmote(
            socket,
            `* ⏳ [${myName} Music] Another song is currently converting. Please wait a few seconds!`
        );
        return { success: false, message: "Another song is currently converting. Please wait!" };
    }

    isConverting = true;
    changeFaceExpression(socket, "Eyes", "Thinking");
    sendRoomEmote(
        socket,
        `* ⏳ [${myName} Music] Converting audio for "${targetSong}"... Please wait a few seconds! 🎧`
    );
    if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();

    try {
        const { title, directUrl, duration } = await convertYoutubeToMp3(targetSong);
        isConverting = false;

        if (duration && duration > MAX_TRACK_DURATION) {
            changeFaceExpression(socket, "Eyes", "Sad");
            const mins = Math.round(duration / 60);
            const maxMins = Math.round(MAX_TRACK_DURATION / 60);
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] "${title}" is too long (${mins} mins)! Maximum allowed duration is ${maxMins} minutes.`
            );
            if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
            return { success: false, message: `Track exceeds maximum allowed duration (${maxMins} mins).` };
        }

        if (!currentTrack) {
            setRoomMusic(context, directUrl, `YouTube: ${title}`, duration, {
                title,
                directUrl,
                duration,
                requestedBy: sender,
                requesterName: senderName,
            });
            return { success: true, message: `Now playing: ${title}` };
        } else {
            songQueue.push({
                title,
                directUrl,
                duration,
                requestedBy: sender,
                requesterName: senderName,
            });
            changeFaceExpression(socket, "Eyes", "Happy");
            sendRoomEmote(
                socket,
                `* 📋 [${myName} Music] Added to queue (#${songQueue.length}/${MAX_QUEUE}): "${title}" (Requested by ${senderName}) 🎶`
            );
            if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
            return { success: true, message: `Added to queue (#${songQueue.length}): ${title}` };
        }
    } catch (err) {
        isConverting = false;
        changeFaceExpression(socket, "Eyes", "Sad");
        console.error("[YouTube Conversion Error]", err);
        sendRoomEmote(
            socket,
            `* ⚠️ [${myName} Music] Failed to convert that YouTube track. Please make sure the link is accessible!`
        );
        if (typeof context.notifyWebRefresh === "function") context.notifyWebRefresh();
        return { success: false, message: "Failed to convert audio." };
    }
}

/**
 * Modular action: Skips currently playing song.
 */
function skipSong(context, customSenderName = null) {
    const { socket, botPlayer, sendRoomEmote, getCharacterName } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    const senderName = customSenderName || "DJ";

    if (!currentTrack && songQueue.length === 0) {
        sendRoomEmote(socket, `* ⚠️ [${myName} Music] No song is currently playing to skip!`);
        return { success: false, message: "No song is currently playing." };
    }

    sendRoomEmote(socket, `* ⏭️ [${myName} Music] Track skipped by ${senderName}!`);
    playNextInQueue(context);
    return { success: true, message: "Track skipped." };
}

/**
 * Modular action: Stops playback and clears queue.
 */
function stopSong(context, customSenderName = null) {
    const { botPlayer, sendRoomEmote, socket } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    songQueue.length = 0;
    currentStation = null;
    if (trackEndTimer) {
        clearTimeout(trackEndTimer);
        trackEndTimer = null;
    }
    setRoomMusic(context, "", "");
    return { success: true, message: "Music playback stopped." };
}

/**
 * Modular action: Clears upcoming songs from queue.
 */
function clearQueue(context, customSenderName = null) {
    const { botPlayer, sendRoomEmote, socket } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    const count = songQueue.length;
    songQueue.length = 0;
    const senderName = customSenderName || "DJ";
    sendRoomEmote(
        socket,
        `* 🗑️ [${myName} Music] Cleared ${count} song(s) from the queue (Requested by ${senderName}).`
    );
    if (typeof context.notifyWebRefresh === "function") {
        context.notifyWebRefresh();
    }
    return { success: true, message: `Cleared ${count} song(s) from queue.` };
}

/**
 * Modular action: Plays a 24/7 radio station.
 */
function playRadio(context, genreKey, customSenderName = null) {
    const { botPlayer, sendRoomEmote, socket } = context;
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    const key = (genreKey || "").toLowerCase().trim();

    if (STATIONS[key]) {
        currentStation = STATIONS[key];
        songQueue.length = 0;
        if (trackEndTimer) {
            clearTimeout(trackEndTimer);
            trackEndTimer = null;
        }
        setRoomMusic(context, currentStation.url, currentStation.name);
        return { success: true, message: `Switched to 24/7 radio: ${currentStation.name}` };
    } else {
        const available = Object.keys(STATIONS).join(", ");
        sendRoomEmote(
            socket,
            `* ⚠️ [${myName} Music] Available genres: ${available}. Example: !radio synth`
        );
        return { success: false, message: `Genre '${genreKey}' not found. Available: ${available}` };
    }
}

/**
 * Processes chat commands from room members.
 */
function handleRoomCommand(context, text, sender) {
    const { socket, botPlayer, currentRoomData, sendRoomEmote, sendWhisper, changeFaceExpression, getCharacterName } = context;
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    const senderName = getCharacterName(sender);

    if (cmd === "!help" || cmd === "!music") {
        changeFaceExpression(socket, "Eyes", "Wink");
        sendWhisper(socket, sender, getHelpMessage(myName));
        return;
    } else if (cmd === "!adminmenu" || cmd === "!adminhelp") {
        changeFaceExpression(socket, "Eyes", "Wink");
        const isAdmin = checkIsAdmin(botPlayer, currentRoomData, sender);
        if (isAdmin) {
            sendWhisper(socket, sender, getAdminMenuMessage(myName));
        } else {
            sendWhisper(
                socket,
                sender,
                `⛔ [${myName} Music] Access denied! Only Room Administrators can view the admin menu.`
            );
        }
        return;
    } else if (cmd === "!play" || cmd === "!yt") {
        const rawAfterCmd = text.slice(text.indexOf(parts[0]) + parts[0].length).trim();
        playSong(context, rawAfterCmd, sender, senderName);
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
            const curReq = currentTrack.requesterName || getCharacterName(currentTrack.requestedBy);
            lines.push(`▶️ [Now Playing]: "${currentTrack.title}" (Requested by ${curReq})`);
        }
        if (songQueue.length > 0) {
            lines.push(`📑 [Upcoming Tracks]:`);
            songQueue.forEach((item, idx) => {
                const req = item.requesterName || getCharacterName(item.requestedBy);
                lines.push(`${idx + 1}. "${item.title}" (Requested by ${req})`);
            });
        } else {
            lines.push(`(No more tracks in queue)`);
        }
        sendRoomEmote(socket, lines.join("\n"));
    } else if (cmd === "!skip" || cmd === "!next") {
        skipSong(context, senderName);
    } else if (cmd === "!clear") {
        clearQueue(context, senderName);
    } else if (cmd === "!radio") {
        const key = (parts[1] || "").toLowerCase().replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();
        playRadio(context, key, senderName);
    } else if (cmd === "!stop") {
        stopSong(context, senderName);
    } else if (cmd === "!np") {
        if (currentTrack) {
            sendRoomEmote(
                socket,
                `* 🎵 [${myName} Music] Now playing: "${currentTrack.title}" (Requested by ${currentTrack.requesterName || 'Member #' + currentTrack.requestedBy}) 🎧`
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
    } else if (
        cmd === "!admin" || cmd === "!addadmin" || cmd === "!deladmin" || cmd === "!adminlist" ||
        cmd === "!whitelist" || cmd === "!wl" || cmd === "!addwhitelist" || cmd === "!delwhitelist" ||
        cmd === "!ban" || cmd === "!addban" || cmd === "!unban" || cmd === "!banlist"
    ) {
        if (typeof sendWhisper === "function") {
            sendWhisper(
                socket,
                sender,
                `🔒 [${myName} Music] Admin, Whitelist, and Banlist management can only be run by Room Administrators via private whisper: /w ${myName} <command>`
            );
        }
    } else if (cmd === "!friend" || cmd === "!addfriend" || cmd === "!teman") {
        const targetId = sender;
        const targetName = getCharacterName(targetId);
        acceptFriendRequest({
            socket,
            botPlayer,
            isInRoom: true,
            senderNumber: targetId,
            senderName: targetName,
            getCharacterName,
            sendRoomEmote,
            changeFaceExpression,
        });
    }
}

module.exports = {
    extractCommand,
    handleRoomCommand,
    setRoomMusic,
    playNextInQueue,
    getQueueState,
    resetQueue,
    isBotAdmin,
    playSong,
    skipSong,
    stopSong,
    clearQueue,
    playRadio,
    getHelpMessage,
    getAdminMenuMessage,
};

