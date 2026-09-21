/**
 * Room Chat Command Handler & Router
 * Processes in-room chat commands (!play, !queue, !skip, !radio, !np, !help, !adminmenu, etc.)
 * and delegates playback logic to the Music Service.
 */

const { CONFIG, MAX_QUEUE, MAX_TRACK_DURATION, MASTER_ADMINS } = require("../config");
const { acceptFriendRequest } = require("../services/friends");
const {
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
} = require("../services/music");

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
        `• Radio: !radio <genre> (lofi, synth, chillsynth, pop, dance, rock, hiphop, jazz)\n` +
        `💬 Tip: You can also use all music commands via private whisper:\n` +
        `   /w ${myName} !play <song>`;
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
        if (typeof changeFaceExpression === "function") changeFaceExpression(socket, "Eyes", "Wink");
        if (typeof sendWhisper === "function") sendWhisper(socket, sender, getHelpMessage(myName));
        return;
    } 
    
    if (cmd === "!adminmenu" || cmd === "!adminhelp") {
        if (typeof changeFaceExpression === "function") changeFaceExpression(socket, "Eyes", "Wink");
        const isAdmin = checkIsAdmin(botPlayer, currentRoomData, sender);
        if (isAdmin) {
            if (typeof sendWhisper === "function") sendWhisper(socket, sender, getAdminMenuMessage(myName));
        } else {
            if (typeof sendWhisper === "function") {
                sendWhisper(
                    socket,
                    sender,
                    `⛔ [${myName} Music] Access denied! Only Room Administrators can view the admin menu.`
                );
            }
        }
        return;
    } 
    
    if (cmd === "!play" || cmd === "!yt") {
        const rawAfterCmd = text.slice(text.indexOf(parts[0]) + parts[0].length).trim();
        playSong(context, rawAfterCmd, "Chat", sender, senderName);
        return;
    } 
    
    if (cmd === "!queue" || cmd === "!q") {
        const queueState = getQueueState();
        const { currentTrack, songQueue } = queueState;

        if (!currentTrack && songQueue.length === 0) {
            if (typeof sendRoomEmote === "function") {
                sendRoomEmote(
                    socket,
                    `* 📋 [${myName} Music] The song queue is currently empty! Use !play <song/link> to request a track.`
                );
            }
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
        if (typeof sendRoomEmote === "function") sendRoomEmote(socket, lines.join("\n"));
        return;
    } 
    
    if (cmd === "!skip" || cmd === "!next") {
        skipSong(context, senderName);
        return;
    } 
    
    if (cmd === "!clear") {
        clearQueue(context, senderName);
        return;
    } 
    
    if (cmd === "!radio") {
        const key = (parts[1] || "").toLowerCase().replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();
        playRadio(context, key, senderName);
        return;
    } 
    
    if (cmd === "!stop") {
        stopSong(context, senderName);
        return;
    } 
    
    if (cmd === "!np") {
        const queueState = getQueueState();
        const { currentTrack, currentStation } = queueState;

        if (currentTrack) {
            if (typeof sendRoomEmote === "function") {
                sendRoomEmote(
                    socket,
                    `* 🎵 [${myName} Music] Now playing: "${currentTrack.title}" (Requested by ${currentTrack.requesterName || 'Member #' + currentTrack.requestedBy}) 🎧`
                );
            }
        } else if (currentStation) {
            if (typeof sendRoomEmote === "function") {
                sendRoomEmote(
                    socket,
                    `* 🎵 [${myName} Music] Now playing 24/7 radio: ${currentStation.name} 🎧`
                );
            }
        } else {
            if (typeof sendRoomEmote === "function") {
                sendRoomEmote(
                    socket,
                    `* 🔇 [${myName} Music] No music is currently playing in the room. Type !play <song> or !radio <genre> to start!`
                );
            }
        }
        return;
    } 
    
    if (
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
        return;
    } 
    
    if (cmd === "!friend" || cmd === "!addfriend" || cmd === "!teman") {
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
        return;
    }
}

module.exports = {
    extractCommand,
    handleRoomCommand,
    checkIsAdmin,
    getHelpMessage,
    getAdminMenuMessage,
    // Re-exports from services/music for backwards compatibility
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
