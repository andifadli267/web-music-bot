/**
 * Room Administration Whisper Handler
 * 
 * Allows authorized Room Administrators to securely manage:
 * - Room Administrators (Admin list)
 * - Room Whitelist (Whitelist)
 * - Room Banlist (Ban list)
 * 
 * Communication is strictly restricted to private whispers (/w) both ways.
 */

const { CONFIG, MASTER_ADMINS, addAuthorizedMember, removeAuthorizedMember } = require("../config");
const { extractCommand, isBotAdmin, getHelpMessage, getAdminMenuMessage } = require("./commands");
const { playSong, skipSong, stopSong, clearQueue, playRadio, getQueueState } = require("../services/music");

/**
 * Checks if a member has room administrator permissions.
 */
function isRoomAdmin(botPlayer, currentRoomData, senderId) {
    const id = Number(senderId);
    if (!id) return false;
    if (MASTER_ADMINS.has(id)) return true;
    if (currentRoomData && Array.isArray(currentRoomData.Admin) && currentRoomData.Admin.includes(id)) {
        return true;
    }
    return false;
}

/**
 * Sends a room administration update packet to the Bondage Club server.
 */
function updateRoom(socketOrContext, currentRoomData) {
    const socket = socketOrContext.socket || socketOrContext;
    socket.emit("ChatRoomAdmin", {
        MemberNumber: 0,
        Room: currentRoomData,
        Action: "Update",
    });
    if (socketOrContext && typeof socketOrContext.notifyWebRefresh === "function") {
        socketOrContext.notifyWebRefresh();
    }
}

/**
 * Parses numeric member IDs from command arguments (supports #12345, (12345), etc.)
 */
function parseMemberId(arg) {
    if (!arg) return null;
    const cleaned = String(arg).replace(/[#\(\)\[\]\{\}\,\.\s]/g, "");
    const num = parseInt(cleaned, 10);
    return (!isNaN(num) && num > 0) ? num : null;
}

/**
 * Modular action: Adds an admin to the room.
 */
function addRoomAdmin(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    if (!targetId) return { success: false, message: "Invalid Member ID." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot does not have Room Admin permissions." };
    }

    if (!Array.isArray(currentRoomData.Admin)) currentRoomData.Admin = [];
    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];

    const targetName = getCharacterName(targetId);
    if (currentRoomData.Admin.includes(targetId)) {
        return { success: false, message: `Member #${targetId} (${targetName}) is already a Room Administrator.` };
    }

    currentRoomData.Admin.push(targetId);
    const banIdx = currentRoomData.Ban.indexOf(targetId);
    if (banIdx >= 0) currentRoomData.Ban.splice(banIdx, 1);

    updateRoom(context, currentRoomData);
    console.log(`👑 [Admin Update] Member #${targetId} added to Room Admins by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) has been added as a Room Administrator.` };
}

/**
 * Modular action: Removes an admin from the room.
 */
function removeRoomAdmin(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    if (!targetId) return { success: false, message: "Invalid Member ID." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot does not have Room Admin permissions." };
    }

    if (botPlayer && targetId === botPlayer.MemberNumber) {
        return { success: false, message: `Cannot remove admin permissions of bot ${myName}.` };
    }

    if (!Array.isArray(currentRoomData.Admin)) currentRoomData.Admin = [];
    const idx = currentRoomData.Admin.indexOf(targetId);
    if (idx < 0) {
        return { success: false, message: `Member #${targetId} is not in the Room Administrator list.` };
    }

    currentRoomData.Admin.splice(idx, 1);
    updateRoom(context, currentRoomData);
    const targetName = getCharacterName(targetId);
    console.log(`👑 [Admin Update] Member #${targetId} removed from Room Admins by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) has been removed from Room Administrators.` };
}

/**
 * Modular action: Adds a member to room whitelist.
 */
function addRoomWhitelist(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    if (!targetId) return { success: false, message: "Invalid Member ID." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot does not have Room Admin permissions." };
    }

    if (!Array.isArray(currentRoomData.Whitelist)) currentRoomData.Whitelist = [];
    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];

    const targetName = getCharacterName(targetId);
    if (currentRoomData.Whitelist.includes(targetId)) {
        return { success: false, message: `Member #${targetId} (${targetName}) is already on the Room Whitelist.` };
    }

    currentRoomData.Whitelist.push(targetId);
    const banIdx = currentRoomData.Ban.indexOf(targetId);
    if (banIdx >= 0) currentRoomData.Ban.splice(banIdx, 1);

    updateRoom(context, currentRoomData);
    console.log(`📜 [Whitelist Update] Member #${targetId} added to Whitelist by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) has been added to the Room Whitelist.` };
}

/**
 * Modular action: Removes a member from room whitelist.
 */
function removeRoomWhitelist(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    if (!targetId) return { success: false, message: "Invalid Member ID." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot does not have Room Admin permissions." };
    }

    if (!Array.isArray(currentRoomData.Whitelist)) currentRoomData.Whitelist = [];
    const idx = currentRoomData.Whitelist.indexOf(targetId);
    if (idx < 0) {
        return { success: false, message: `Member #${targetId} was not found on the Room Whitelist.` };
    }

    currentRoomData.Whitelist.splice(idx, 1);
    updateRoom(context, currentRoomData);
    const targetName = getCharacterName(targetId);
    console.log(`📜 [Whitelist Update] Member #${targetId} removed from Whitelist by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) has been removed from the Room Whitelist.` };
}

/**
 * Modular action: Bans a member from the room.
 */
function addRoomBan(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    if (!targetId) return { success: false, message: "Invalid Member ID." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot does not have Room Admin permissions." };
    }

    if (botPlayer && targetId === botPlayer.MemberNumber) {
        return { success: false, message: `Cannot ban bot ${myName}.` };
    }

    if (MASTER_ADMINS.has(targetId)) {
        return { success: false, message: "Master Admin cannot be banned." };
    }

    if (!Array.isArray(currentRoomData.Admin)) currentRoomData.Admin = [];
    if (!Array.isArray(currentRoomData.Whitelist)) currentRoomData.Whitelist = [];
    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];

    const targetName = getCharacterName(targetId);
    if (currentRoomData.Ban.includes(targetId)) {
        return { success: false, message: `Member #${targetId} (${targetName}) is already on the Room Banlist.` };
    }

    currentRoomData.Ban.push(targetId);

    const adminIdx = currentRoomData.Admin.indexOf(targetId);
    if (adminIdx >= 0) currentRoomData.Admin.splice(adminIdx, 1);

    const wlIdx = currentRoomData.Whitelist.indexOf(targetId);
    if (wlIdx >= 0) currentRoomData.Whitelist.splice(wlIdx, 1);

    updateRoom(context, currentRoomData);
    console.log(`🚫 [Banlist Update] Member #${targetId} BANNED by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) has been added to the Room Banlist.` };
}

/**
 * Modular action: Unbans a member from the room.
 */
function removeRoomBan(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    if (!targetId) return { success: false, message: "Invalid Member ID." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot does not have Room Admin permissions." };
    }

    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];
    const idx = currentRoomData.Ban.indexOf(targetId);
    if (idx < 0) {
        return { success: false, message: `Member #${targetId} is not on the Room Banlist.` };
    }

    currentRoomData.Ban.splice(idx, 1);
    updateRoom(context, currentRoomData);
    const targetName = getCharacterName(targetId);
    console.log(`🚫 [Banlist Update] Member #${targetId} UNBANNED by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) has been removed from the Room Banlist.` };
}

/**
 * Modular action: Kicks a member from the room.
 */
function kickRoomMember(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    if (!targetId) return { success: false, message: "Invalid Member ID." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot does not have Room Admin permissions to kick players." };
    }

    if (botPlayer && targetId === botPlayer.MemberNumber) {
        return { success: false, message: `Cannot kick bot ${myName}.` };
    }

    if (MASTER_ADMINS.has(targetId)) {
        return { success: false, message: "Master Admin cannot be kicked." };
    }

    socket.emit("ChatRoomAdmin", {
        MemberNumber: targetId,
        Action: "Kick",
    });

    const targetName = getCharacterName(targetId);
    console.log(`👢 [Room Kick] Member #${targetId} (${targetName}) kicked by #${operatorId || 'Web'}.`);
    if (typeof context.notifyWebRefresh === "function") {
        context.notifyWebRefresh();
    }
    return { success: true, message: `Member #${targetId} (${targetName}) was kicked from the room.` };
}

/**
 * Main whisper handler for room administration commands.
 */
async function handleAdminWhisper(context, rawText, sender) {
    const { socket, botPlayer, currentRoomData, sendWhisper, getCharacterName } = context;
    const senderId = Number(sender);
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    const senderName = getCharacterName(senderId);

    // Clean text / support bracketed commands
    const text = extractCommand(rawText) || rawText.trim();
    if (!text) return;

    const parts = text.split(/\s+/);
    const rawCmd = parts[0].toLowerCase();
    const cmd = rawCmd.startsWith("!") ? rawCmd : `!${rawCmd}`;
    const arg = parts[1] || "";

    // 1. HELP COMMAND VIA WHISPER - Available to EVERYONE (Both regular members & admins)
    if (cmd === "!help" || cmd === "!music") {
        sendWhisper(socket, senderId, getHelpMessage(myName));
        return;
    }

    // 2. MUSIC COMMANDS VIA WHISPER - Available to EVERYONE
    if (cmd === "!play" || cmd === "!yt") {
        const rawAfterCmd = text.slice(text.indexOf(parts[0]) + parts[0].length).trim();
        if (!rawAfterCmd) {
            sendWhisper(socket, senderId, `ℹ️ [${myName} Music] Usage: /w ${myName} !play <song title or YouTube link>`);
            return;
        }
        const res = await playSong(context, rawAfterCmd, "Whisper", senderId, senderName);
        // playSong already sends room emotes; optionally whisper status back
        if (!res || !res.success) {
            sendWhisper(socket, senderId, `⚠️ [${myName} Music] ${res ? res.message : "Failed to play song."}`);
        }
        return;
    }

    if (cmd === "!skip" || cmd === "!next") {
        const res = skipSong(context, senderName);
        sendWhisper(socket, senderId, (res.success ? "⏭️ " : "ℹ️ ") + `[${myName} Music] ` + res.message);
        return;
    }

    if (cmd === "!stop") {
        const res = stopSong(context, senderName);
        sendWhisper(socket, senderId, `🔇 [${myName} Music] ` + res.message);
        return;
    }

    if (cmd === "!clear") {
        const res = clearQueue(context, senderName);
        sendWhisper(socket, senderId, `🗑️ [${myName} Music] ` + res.message);
        return;
    }

    if (cmd === "!np") {
        const { currentTrack, currentStation } = getQueueState();
        if (currentTrack) {
            sendWhisper(socket, senderId, `🎵 [${myName} Music] Now playing: "${currentTrack.title}" (Requested by ${currentTrack.requesterName || "Member #" + currentTrack.requestedBy})`);
        } else if (currentStation) {
            sendWhisper(socket, senderId, `🎵 [${myName} Music] Now playing 24/7 radio: ${currentStation.name}`);
        } else {
            sendWhisper(socket, senderId, `🔇 [${myName} Music] No music is currently playing. Type !play <song> to start!`);
        }
        return;
    }

    if (cmd === "!queue" || cmd === "!q") {
        const { currentTrack, songQueue: queue } = getQueueState();
        if (!currentTrack && queue.length === 0) {
            sendWhisper(socket, senderId, `📋 [${myName} Music] Queue is empty! Use !play <song> to request a track.`);
            return;
        }
        let lines = [`📋 [${myName} Music] Queue (${queue.length} tracks):`];
        if (currentTrack) {
            lines.push(`▶️ Now Playing: "${currentTrack.title}" (by ${currentTrack.requesterName || "Member #" + currentTrack.requestedBy})`);
        }
        queue.forEach((item, idx) => {
            lines.push(`${idx + 1}. "${item.title}" (by ${item.requesterName || "Member #" + item.requestedBy})`);
        });
        sendWhisper(socket, senderId, lines.join("\n"));
        return;
    }

    if (cmd === "!radio") {
        const key = (parts[1] || "").toLowerCase().replace(/^[\(<\[{"']+|[\)>\]}"']+$/g, "").trim();
        if (!key) {
            sendWhisper(socket, senderId, `ℹ️ [${myName} Music] Usage: /w ${myName} !radio <genre>\nAvailable: lofi, synth, chillsynth, pop, dance, rock, hiphop, jazz`);
            return;
        }
        const res = playRadio(context, key, senderName);
        if (!res || !res.success) {
            sendWhisper(socket, senderId, `⚠️ [${myName} Music] ${res ? res.message : "Unknown radio genre."}`);
        }
        return;
    }

    // 3. ADMIN MENU COMMAND VIA WHISPER - Available to Room Admins
    if (cmd === "!adminmenu" || cmd === "!adminhelp" || cmd === "!menu") {
        if (!isRoomAdmin(botPlayer, currentRoomData, senderId)) {
            sendWhisper(
                socket,
                senderId,
                `⛔ [${myName} Music] Access denied! Only Room Administrators can view the admin menu. Type !help for assistance.`
            );
            return;
        }
        sendWhisper(socket, senderId, getAdminMenuMessage(myName));
        return;
    }

    // 4. Verify that sender is a Room Administrator or Master Admin for management commands
    if (!isRoomAdmin(botPlayer, currentRoomData, senderId)) {
        console.warn(`⛔ [Admin Whisper Denied] Non-admin Member #${senderId} (${senderName}) attempted admin whisper: "${text}"`);
        sendWhisper(
            socket,
            senderId,
            `⛔ [${myName} Music] Access denied! Only Room Administrators can manage Admin, Whitelist, and Banlist. Type !help for assistance.`
        );
        return;
    }

    // 5. Check if the bot itself has Room Admin rights to commit changes
    if (!isBotAdmin(botPlayer, currentRoomData)) {
        sendWhisper(
            socket,
            senderId,
            `⚠️ [${myName} Music] Bot does not have Room Admin privileges in this room yet. Please grant Admin to ${myName} (#${botPlayer ? botPlayer.MemberNumber : 0}) first!`
        );
        return;
    }

    // Ensure list arrays exist on currentRoomData
    if (!Array.isArray(currentRoomData.Admin)) currentRoomData.Admin = [];
    if (!Array.isArray(currentRoomData.Whitelist)) currentRoomData.Whitelist = [];
    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];

    // ==========================================
    // B. ADMINISTRATOR MANAGEMENT
    // ==========================================
    if (cmd === "!adminlist" || cmd === "!admins" || (cmd === "!admin" && !arg)) {
        const list = currentRoomData.Admin;
        const formatted = list.length > 0
            ? list.map((id, i) => `${i + 1}. #${id} (${getCharacterName(id)})`).join("\n")
            : "None.";
        sendWhisper(
            socket,
            senderId,
            `👑 [${myName} Admin List] Total (${list.length}):\n${formatted}`
        );
        return;
    }

    if (cmd === "!admin" || cmd === "!addadmin") {
        const res = addRoomAdmin(context, arg, senderId);
        sendWhisper(socket, senderId, (res.success ? "✅ " : "⚠️ ") + res.message);
        return;
    }

    if (cmd === "!deladmin" || cmd === "!removeadmin" || cmd === "!unadmin") {
        const res = removeRoomAdmin(context, arg, senderId);
        sendWhisper(socket, senderId, (res.success ? "✅ " : "⚠️ ") + res.message);
        return;
    }

    // ==========================================
    // C. WHITELIST MANAGEMENT
    // ==========================================
    if (cmd === "!whitelistlist" || cmd === "!whitelists" || ((cmd === "!whitelist" || cmd === "!wl") && !arg)) {
        const list = currentRoomData.Whitelist;
        const formatted = list.length > 0
            ? list.map((id, i) => `${i + 1}. #${id} (${getCharacterName(id)})`).join("\n")
            : "Empty (Public room access enabled).";
        sendWhisper(
            socket,
            senderId,
            `📜 [${myName} Whitelist] Total (${list.length}):\n${formatted}`
        );
        return;
    }

    if (cmd === "!whitelist" || cmd === "!wl" || cmd === "!addwhitelist" || cmd === "!addwl") {
        const res = addRoomWhitelist(context, arg, senderId);
        sendWhisper(socket, senderId, (res.success ? "✅ " : "⚠️ ") + res.message);
        return;
    }

    if (cmd === "!delwhitelist" || cmd === "!delwl" || cmd === "!removewhitelist" || cmd === "!unwhitelist") {
        const res = removeRoomWhitelist(context, arg, senderId);
        sendWhisper(socket, senderId, (res.success ? "✅ " : "⚠️ ") + res.message);
        return;
    }

    // ==========================================
    // D. BANLIST MANAGEMENT
    // ==========================================
    if (cmd === "!banlist" || cmd === "!bans" || (cmd === "!ban" && !arg)) {
        const list = currentRoomData.Ban;
        const formatted = list.length > 0
            ? list.map((id, i) => `${i + 1}. #${id} (${getCharacterName(id)})`).join("\n")
            : "No banned players.";
        sendWhisper(
            socket,
            senderId,
            `🚫 [${myName} Banlist] Total (${list.length}):\n${formatted}`
        );
        return;
    }

    if (cmd === "!ban" || cmd === "!addban") {
        const res = addRoomBan(context, arg, senderId);
        sendWhisper(socket, senderId, (res.success ? "🚫 " : "⚠️ ") + res.message);
        return;
    }

    if (cmd === "!unban" || cmd === "!delban" || cmd === "!removeban") {
        const res = removeRoomBan(context, arg, senderId);
        sendWhisper(socket, senderId, (res.success ? "✅ " : "⚠️ ") + res.message);
        return;
    }

    // ==========================================
    // E. KICK MANAGEMENT
    // ==========================================
    if (cmd === "!kick") {
        const res = kickRoomMember(context, arg, senderId);
        sendWhisper(socket, senderId, (res.success ? "👢 " : "⚠️ ") + res.message);
        return;
    }

    // ==========================================
    // F. AUTHORIZED MEMBER MANAGEMENT
    // ==========================================
    if (cmd === "!authlist" || cmd === "!auths") {
        const list = Array.from(MASTER_ADMINS);
        const formatted = list.length > 0
            ? list.map((id, i) => `${i + 1}. #${id} (${getCharacterName(id)})`).join("\n")
            : "None.";
        sendWhisper(
            socket,
            senderId,
            `⭐ [${myName} Authorized Members] Total (${list.length}):\n${formatted}`
        );
        return;
    }

    if (cmd === "!addauth") {
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah: !addauth <memberNumber>`);
            return;
        }
        const res = addAuthorizedMember(targetId);
        if (res.success) {
            if (isBotAdmin(botPlayer, currentRoomData)) {
                addRoomAdmin(context, targetId, senderId);
            }
            if (typeof context.notifyWebRefresh === "function") {
                context.notifyWebRefresh();
            }
        }
        sendWhisper(socket, senderId, (res.success ? "⭐ " : "⚠️ ") + res.message);
        return;
    }

    if (cmd === "!delauth" || cmd === "!removeauth") {
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah: !delauth <memberNumber>`);
            return;
        }
        const res = removeAuthorizedMember(targetId);
        if (res.success) {
            if (isBotAdmin(botPlayer, currentRoomData) && Array.isArray(currentRoomData.Admin) && currentRoomData.Admin.includes(targetId)) {
                removeRoomAdmin(context, targetId, senderId);
            }
            if (typeof context.notifyWebRefresh === "function") {
                context.notifyWebRefresh();
            }
        }
        sendWhisper(socket, senderId, (res.success ? "⭐ " : "⚠️ ") + res.message);
        return;
    }

    // Default whisper response for unknown admin commands
    sendWhisper(
        socket,
        senderId,
        `❓ [${myName} Music] Unknown whisper command "${cmd}". Type !adminmenu to view the admin command menu.`
    );
}

module.exports = {
    isRoomAdmin,
    handleAdminWhisper,
    parseMemberId,
    addRoomAdmin,
    removeRoomAdmin,
    addRoomWhitelist,
    removeRoomWhitelist,
    addRoomBan,
    removeRoomBan,
    kickRoomMember,
};

