/**
 * Room Chat Command Handler & Music Queue Manager
 * Processes in-room chat commands (!play, !queue, !skip, !radio, !friend, etc.)
 * and manages music playback synchronization for Bondage Club rooms.
 */

const path = require("path");
const { CONFIG, STATIONS, MAX_QUEUE } = require("../config");
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
 * Processes chat commands from room members.
 */
function handleRoomCommand(context, text, sender) {
    const { socket, botPlayer, currentRoomData, sendRoomEmote, changeFaceExpression, getCharacterName } = context;
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;

    if (cmd === "!help" || cmd === "!music") {
        changeFaceExpression(socket, "Eyes", "Wink");
        sendRoomEmote(
            socket,
            `* 🎵 [${myName} Music]: Standalone DJ playing synced room music for everyone! Commands: !play <song/link> | !queue | !skip | !clear | !radio <genre> | !stop | !np | !friend | !whitelist <id>`
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
                setRoomMusic(context, extractedUrl, `Custom Audio (${path.basename(new URL(extractedUrl).pathname)})`);
            } else {
                if (songQueue.length >= MAX_QUEUE) {
                    sendRoomEmote(socket, `* ⚠️ [${myName} Music] The song queue is full! Maximum ${MAX_QUEUE} songs allowed.`);
                    return;
                }
                const trackTitle = `Custom Audio (${path.basename(new URL(extractedUrl).pathname)})`;
                const senderName = getCharacterName(sender);
                songQueue.push({
                    title: trackTitle,
                    directUrl: extractedUrl,
                    duration: 0,
                    requestedBy: sender,
                    requesterName: senderName,
                });
                sendRoomEmote(socket, `* 📋 [${myName} Music] Added to queue (#${songQueue.length}/${MAX_QUEUE}): "${trackTitle}" (Requested by ${senderName}) 🎶`);
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
                const senderName = getCharacterName(sender);

                if (!currentTrack) {
                    // Nothing playing: play immediately
                    setRoomMusic(context, directUrl, `YouTube: ${title}`, duration, {
                        title,
                        directUrl,
                        duration,
                        requestedBy: sender,
                        requesterName: senderName,
                    });
                } else {
                    // Something is already playing: add to queue
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
        if (!currentTrack && songQueue.length === 0) {
            sendRoomEmote(
                socket,
                `* ⚠️ [${myName} Music] No song is currently playing to skip!`
            );
            return;
        }
        sendRoomEmote(
            socket,
            `* ⏭️ [${myName} Music] Track skipped by ${getCharacterName(sender)}!`
        );
        playNextInQueue(context);
    } else if (cmd === "!clear") {
        const count = songQueue.length;
        songQueue.length = 0;
        sendRoomEmote(
            socket,
            `* 🗑️ [${myName} Music] Cleared ${count} song(s) from the queue (Requested by ${getCharacterName(sender)}).`
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
            setRoomMusic(context, currentStation.url, currentStation.name);
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
        setRoomMusic(context, "", "");
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
        if (!isBotAdmin(botPlayer, currentRoomData)) {
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
            `* 📜 [${myName} Music] Member #${targetId} has been successfully added to the room Whitelist (Authorized by Admin ${getCharacterName(sender)})!`
        );
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
};
