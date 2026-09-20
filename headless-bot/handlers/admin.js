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
const { extractCommand, isBotAdmin } = require("./commands");

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
function updateRoom(socket, currentRoomData) {
    socket.emit("ChatRoomAdmin", {
        MemberNumber: 0,
        Room: currentRoomData,
        Action: "Update",
    });
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

    // 1. Verify that sender is a Room Administrator or Master Admin
    if (!isRoomAdmin(botPlayer, currentRoomData, senderId)) {
        console.warn(`⛔ [Admin Whisper Denied] Non-admin Member #${senderId} (${senderName}) attempted admin whisper: "${text}"`);
        sendWhisper(
            socket,
            senderId,
            `⛔ [${myName} Music] Akses ditolak! Hanya Administrator ruangan yang dapat mengatur Admin, Whitelist, dan Banlist.`
        );
        return;
    }

    // 2. Check if the bot itself has Room Admin rights to commit changes
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
    // A. HELP COMMAND VIA WHISPER
    // ==========================================
    if (cmd === "!help" || cmd === "!adminhelp" || cmd === "!menu") {
        sendWhisper(
            socket,
            senderId,
            `🔒 [${myName} Admin Whisper Menu]:\n` +
            `• Admin: !admin <id> | !deladmin <id> | !adminlist\n` +
            `• Whitelist: !whitelist <id> | !delwhitelist <id> | !whitelistlist\n` +
            `• Banlist: !ban <id> | !unban <id> | !banlist\n` +
            `Contoh: /w ${myName} !whitelist 254143`
        );
        return;
    }

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
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah! Contoh: !admin 254143`);
            return;
        }

        if (currentRoomData.Admin.includes(targetId)) {
            sendWhisper(socket, senderId, `ℹ️ Member #${targetId} (${getCharacterName(targetId)}) sudah menjadi Administrator ruangan.`);
            return;
        }

        currentRoomData.Admin.push(targetId);
        // Also ensure they are not banned
        const banIdx = currentRoomData.Ban.indexOf(targetId);
        if (banIdx >= 0) currentRoomData.Ban.splice(banIdx, 1);

        updateRoom(socket, currentRoomData);
        console.log(`👑 [Admin Update] Member #${targetId} added to Room Admins by Admin #${senderId} (${senderName}).`);
        sendWhisper(
            socket,
            senderId,
            `✅ Sukses! Member #${targetId} (${getCharacterName(targetId)}) telah ditambahkan ke Administrator ruangan.`
        );
        return;
    }

    if (cmd === "!deladmin" || cmd === "!removeadmin" || cmd === "!unadmin") {
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah! Contoh: !deladmin 254143`);
            return;
        }

        if (botPlayer && targetId === botPlayer.MemberNumber) {
            sendWhisper(socket, senderId, `⚠️ Tidak dapat menghapus hak admin milik bot ${myName}.`);
            return;
        }

        const idx = currentRoomData.Admin.indexOf(targetId);
        if (idx < 0) {
            sendWhisper(socket, senderId, `ℹ️ Member #${targetId} tidak ada di daftar Administrator ruangan.`);
            return;
        }

        currentRoomData.Admin.splice(idx, 1);
        updateRoom(socket, currentRoomData);
        console.log(`👑 [Admin Update] Member #${targetId} removed from Room Admins by Admin #${senderId} (${senderName}).`);
        sendWhisper(
            socket,
            senderId,
            `✅ Sukses! Member #${targetId} (${getCharacterName(targetId)}) telah dihapus dari Administrator ruangan.`
        );
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
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah! Contoh: !whitelist 254143`);
            return;
        }

        if (currentRoomData.Whitelist.includes(targetId)) {
            sendWhisper(socket, senderId, `ℹ️ Member #${targetId} (${getCharacterName(targetId)}) sudah ada di Whitelist ruangan.`);
            return;
        }

        currentRoomData.Whitelist.push(targetId);
        // Also ensure they are not banned
        const banIdx = currentRoomData.Ban.indexOf(targetId);
        if (banIdx >= 0) currentRoomData.Ban.splice(banIdx, 1);

        updateRoom(socket, currentRoomData);
        console.log(`📜 [Whitelist Update] Member #${targetId} added to Whitelist by Admin #${senderId} (${senderName}).`);
        sendWhisper(
            socket,
            senderId,
            `✅ Sukses! Member #${targetId} (${getCharacterName(targetId)}) telah ditambahkan ke Whitelist ruangan.`
        );
        return;
    }

    if (cmd === "!delwhitelist" || cmd === "!delwl" || cmd === "!removewhitelist" || cmd === "!unwhitelist") {
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah! Contoh: !delwhitelist 254143`);
            return;
        }

        const idx = currentRoomData.Whitelist.indexOf(targetId);
        if (idx < 0) {
            sendWhisper(socket, senderId, `ℹ️ Member #${targetId} tidak ditemukan di Whitelist ruangan.`);
            return;
        }

        currentRoomData.Whitelist.splice(idx, 1);
        updateRoom(socket, currentRoomData);
        console.log(`📜 [Whitelist Update] Member #${targetId} removed from Whitelist by Admin #${senderId} (${senderName}).`);
        sendWhisper(
            socket,
            senderId,
            `✅ Sukses! Member #${targetId} (${getCharacterName(targetId)}) telah dihapus dari Whitelist ruangan.`
        );
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
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah! Contoh: !ban 254143`);
            return;
        }

        if (botPlayer && targetId === botPlayer.MemberNumber) {
            sendWhisper(socket, senderId, `⚠️ Tidak dapat memasukkan bot ${myName} ke daftar ban.`);
            return;
        }

        if (MASTER_ADMINS.has(targetId)) {
            sendWhisper(socket, senderId, `⛔ Master Admin tidak dapat di-ban.`);
            return;
        }

        if (currentRoomData.Ban.includes(targetId)) {
            sendWhisper(socket, senderId, `ℹ️ Member #${targetId} (${getCharacterName(targetId)}) sudah ada di Banlist ruangan.`);
            return;
        }

        currentRoomData.Ban.push(targetId);

        // Auto remove from Admin and Whitelist if banned
        const adminIdx = currentRoomData.Admin.indexOf(targetId);
        if (adminIdx >= 0) currentRoomData.Admin.splice(adminIdx, 1);

        const wlIdx = currentRoomData.Whitelist.indexOf(targetId);
        if (wlIdx >= 0) currentRoomData.Whitelist.splice(wlIdx, 1);

        updateRoom(socket, currentRoomData);
        console.log(`🚫 [Banlist Update] Member #${targetId} BANNED by Admin #${senderId} (${senderName}).`);
        sendWhisper(
            socket,
            senderId,
            `🚫 Sukses! Member #${targetId} (${getCharacterName(targetId)}) telah ditambahkan ke Banlist ruangan.`
        );
        return;
    }

    if (cmd === "!unban" || cmd === "!delban" || cmd === "!removeban") {
        const targetId = parseMemberId(arg);
        if (!targetId) {
            sendWhisper(socket, senderId, `⚠️ Format salah! Contoh: !unban 254143`);
            return;
        }

        const idx = currentRoomData.Ban.indexOf(targetId);
        if (idx < 0) {
            sendWhisper(socket, senderId, `ℹ️ Member #${targetId} tidak ada di Banlist ruangan.`);
            return;
        }

        currentRoomData.Ban.splice(idx, 1);
        updateRoom(socket, currentRoomData);
        console.log(`🚫 [Banlist Update] Member #${targetId} UNBANNED by Admin #${senderId} (${senderName}).`);
        sendWhisper(
            socket,
            senderId,
            `✅ Sukses! Member #${targetId} (${getCharacterName(targetId)}) telah dihapus dari Banlist ruangan.`
        );
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
};
