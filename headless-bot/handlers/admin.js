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

const { CONFIG, MASTER_ADMINS } = require("../config");
const { extractCommand, isBotAdmin, getHelpMessage, getAdminMenuMessage } = require("./commands");

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
    if (!targetId) return { success: false, message: "Member ID tidak valid." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot belum memiliki hak Room Admin." };
    }

    if (!Array.isArray(currentRoomData.Admin)) currentRoomData.Admin = [];
    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];

    const targetName = getCharacterName(targetId);
    if (currentRoomData.Admin.includes(targetId)) {
        return { success: false, message: `Member #${targetId} (${targetName}) sudah menjadi Administrator ruangan.` };
    }

    currentRoomData.Admin.push(targetId);
    const banIdx = currentRoomData.Ban.indexOf(targetId);
    if (banIdx >= 0) currentRoomData.Ban.splice(banIdx, 1);

    updateRoom(context, currentRoomData);
    console.log(`👑 [Admin Update] Member #${targetId} added to Room Admins by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) telah ditambahkan ke Administrator ruangan.` };
}

/**
 * Modular action: Removes an admin from the room.
 */
function removeRoomAdmin(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    if (!targetId) return { success: false, message: "Member ID tidak valid." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot belum memiliki hak Room Admin." };
    }

    if (botPlayer && targetId === botPlayer.MemberNumber) {
        return { success: false, message: `Tidak dapat menghapus hak admin milik bot ${myName}.` };
    }

    if (!Array.isArray(currentRoomData.Admin)) currentRoomData.Admin = [];
    const idx = currentRoomData.Admin.indexOf(targetId);
    if (idx < 0) {
        return { success: false, message: `Member #${targetId} tidak ada di daftar Administrator ruangan.` };
    }

    currentRoomData.Admin.splice(idx, 1);
    updateRoom(context, currentRoomData);
    const targetName = getCharacterName(targetId);
    console.log(`👑 [Admin Update] Member #${targetId} removed from Room Admins by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) telah dihapus dari Administrator ruangan.` };
}

/**
 * Modular action: Adds a member to room whitelist.
 */
function addRoomWhitelist(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    if (!targetId) return { success: false, message: "Member ID tidak valid." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot belum memiliki hak Room Admin." };
    }

    if (!Array.isArray(currentRoomData.Whitelist)) currentRoomData.Whitelist = [];
    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];

    const targetName = getCharacterName(targetId);
    if (currentRoomData.Whitelist.includes(targetId)) {
        return { success: false, message: `Member #${targetId} (${targetName}) sudah ada di Whitelist ruangan.` };
    }

    currentRoomData.Whitelist.push(targetId);
    const banIdx = currentRoomData.Ban.indexOf(targetId);
    if (banIdx >= 0) currentRoomData.Ban.splice(banIdx, 1);

    updateRoom(context, currentRoomData);
    console.log(`📜 [Whitelist Update] Member #${targetId} added to Whitelist by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) telah ditambahkan ke Whitelist ruangan.` };
}

/**
 * Modular action: Removes a member from room whitelist.
 */
function removeRoomWhitelist(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    if (!targetId) return { success: false, message: "Member ID tidak valid." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot belum memiliki hak Room Admin." };
    }

    if (!Array.isArray(currentRoomData.Whitelist)) currentRoomData.Whitelist = [];
    const idx = currentRoomData.Whitelist.indexOf(targetId);
    if (idx < 0) {
        return { success: false, message: `Member #${targetId} tidak ditemukan di Whitelist ruangan.` };
    }

    currentRoomData.Whitelist.splice(idx, 1);
    updateRoom(context, currentRoomData);
    const targetName = getCharacterName(targetId);
    console.log(`📜 [Whitelist Update] Member #${targetId} removed from Whitelist by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) telah dihapus dari Whitelist ruangan.` };
}

/**
 * Modular action: Bans a member from the room.
 */
function addRoomBan(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    if (!targetId) return { success: false, message: "Member ID tidak valid." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot belum memiliki hak Room Admin." };
    }

    if (botPlayer && targetId === botPlayer.MemberNumber) {
        return { success: false, message: `Tidak dapat memasukkan bot ${myName} ke daftar ban.` };
    }

    if (MASTER_ADMINS.has(targetId)) {
        return { success: false, message: "Master Admin tidak dapat di-ban." };
    }

    if (!Array.isArray(currentRoomData.Admin)) currentRoomData.Admin = [];
    if (!Array.isArray(currentRoomData.Whitelist)) currentRoomData.Whitelist = [];
    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];

    const targetName = getCharacterName(targetId);
    if (currentRoomData.Ban.includes(targetId)) {
        return { success: false, message: `Member #${targetId} (${targetName}) sudah ada di Banlist ruangan.` };
    }

    currentRoomData.Ban.push(targetId);

    const adminIdx = currentRoomData.Admin.indexOf(targetId);
    if (adminIdx >= 0) currentRoomData.Admin.splice(adminIdx, 1);

    const wlIdx = currentRoomData.Whitelist.indexOf(targetId);
    if (wlIdx >= 0) currentRoomData.Whitelist.splice(wlIdx, 1);

    updateRoom(context, currentRoomData);
    console.log(`🚫 [Banlist Update] Member #${targetId} BANNED by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) telah ditambahkan ke Banlist ruangan.` };
}

/**
 * Modular action: Unbans a member from the room.
 */
function removeRoomBan(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    if (!targetId) return { success: false, message: "Member ID tidak valid." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot belum memiliki hak Room Admin." };
    }

    if (!Array.isArray(currentRoomData.Ban)) currentRoomData.Ban = [];
    const idx = currentRoomData.Ban.indexOf(targetId);
    if (idx < 0) {
        return { success: false, message: `Member #${targetId} tidak ada di Banlist ruangan.` };
    }

    currentRoomData.Ban.splice(idx, 1);
    updateRoom(context, currentRoomData);
    const targetName = getCharacterName(targetId);
    console.log(`🚫 [Banlist Update] Member #${targetId} UNBANNED by #${operatorId || 'Web'}.`);
    return { success: true, message: `Member #${targetId} (${targetName}) telah dihapus dari Banlist ruangan.` };
}

/**
 * Modular action: Kicks a member from the room.
 */
function kickRoomMember(context, targetMember, operatorId = 0) {
    const { socket, botPlayer, currentRoomData, getCharacterName } = context;
    const targetId = parseMemberId(targetMember);
    const myName = botPlayer ? botPlayer.Name : CONFIG.accountName;
    if (!targetId) return { success: false, message: "Member ID tidak valid." };

    if (!isBotAdmin(botPlayer, currentRoomData)) {
        return { success: false, message: "Bot belum memiliki hak Room Admin untuk kick." };
    }

    if (botPlayer && targetId === botPlayer.MemberNumber) {
        return { success: false, message: `Tidak dapat menendang bot ${myName} sendiri.` };
    }

    if (MASTER_ADMINS.has(targetId)) {
        return { success: false, message: "Master Admin tidak dapat di-kick." };
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
    return { success: true, message: `Member #${targetId} (${targetName}) berhasil di-kick dari ruangan.` };
}

/**
 * Main whisper handler for room administration commands.
 */
function handleAdminWhisper(context, rawText, sender) {
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
        const isAdmin = isRoomAdmin(botPlayer, currentRoomData, senderId);
        sendWhisper(socket, senderId, getHelpMessage(myName, isAdmin));
        return;
    }

    // 2. ADMIN MENU COMMAND VIA WHISPER - Available to Room Admins
    if (cmd === "!adminmenu" || cmd === "!adminhelp" || cmd === "!menu") {
        if (!isRoomAdmin(botPlayer, currentRoomData, senderId)) {
            sendWhisper(
                socket,
                senderId,
                `⛔ [${myName} Music] Akses ditolak! Hanya Administrator ruangan yang dapat melihat menu admin. Ketik !help untuk bantuan.`
            );
            return;
        }
        sendWhisper(socket, senderId, getAdminMenuMessage(myName));
        return;
    }

    // 3. Verify that sender is a Room Administrator or Master Admin for management commands
    if (!isRoomAdmin(botPlayer, currentRoomData, senderId)) {
        console.warn(`⛔ [Admin Whisper Denied] Non-admin Member #${senderId} (${senderName}) attempted admin whisper: "${text}"`);
        sendWhisper(
            socket,
            senderId,
            `⛔ [${myName} Music] Akses ditolak! Hanya Administrator ruangan yang dapat mengatur Admin, Whitelist, dan Banlist. Ketik !help untuk bantuan.`
        );
        return;
    }

    // 3. Check if the bot itself has Room Admin rights to commit changes
    if (!isBotAdmin(botPlayer, currentRoomData)) {
        sendWhisper(
            socket,
            senderId,
            `⚠️ [${myName} Music] Bot belum memiliki hak Room Admin di ruangan ini. Mohon berikan Admin ke ${myName} (#${botPlayer ? botPlayer.MemberNumber : 0}) terlebih dahulu!`
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
            : "Tidak ada.";
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
            : "Kosong (Semua orang dengan akses room dapat masuk).";
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
            : "Tidak ada pemain yang di-ban.";
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

    // Default whisper response for unknown admin commands
    sendWhisper(
        socket,
        senderId,
        `❓ [${myName} Music] Perintah whisper "${cmd}" tidak dikenal. Ketik !help untuk melihat menu perintah admin.`
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

