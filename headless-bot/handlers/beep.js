/**
 * In-Game Beep Event Handler
 * Processes incoming beeps (friend requests, room navigation, invite links)
 * sent by players or authorized master admins.
 */

const { CONFIG, MASTER_ADMINS } = require("../config");
const { acceptFriendRequest } = require("../services/friends");
const { switchRoom } = require("../services/room");

function handleAccountBeep(context, data) {
    if (!data || typeof data !== "object") return;

    const { socket, botPlayer, isInRoom, getCharacterName, sendRoomEmote, changeFaceExpression } = context;

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

    // Auto-accept Beep Friend Request
    if (
        data.BeepType === "FriendRequest" ||
        /(?:add\s*friend|friend\s*request|teman|jadi\s*teman|terima\s*teman)/i.test(msg)
    ) {
        console.log(`🤝 [Beep Friend Request] Member #${senderId} (${senderName}) requested friendship via Beep! Auto-accepting...`);
        acceptFriendRequest({
            socket,
            botPlayer,
            isInRoom,
            senderNumber: senderId,
            senderName,
            getCharacterName,
            sendRoomEmote,
            changeFaceExpression,
        });
        try {
            socket.emit("AccountBeep", {
                MemberNumber: senderId,
                Message: `[${botPlayer ? botPlayer.Name : CONFIG.accountName} Music] Accepted your friend request! 🤝✨`,
            });
        } catch (err) {}
        return;
    }

    const space = data.ChatRoomSpace || "";

    // Clean invisible unicode characters and addon prefixes
    let cleanMsg = msg.replace(/[\u200B-\u200D\uFEFF\u2060-\u2064]/g, '').trim();
    cleanMsg = cleanMsg.replace(/LikoMAT:[a-zA-Z0-9_-]+/gi, '').trim();

    // Check for join commands: "join <room>", "!join <room>", "join here", "join sini", "masuk <room>", etc.
    const isJoinCommand = /^(?:!|\/)?(?:join\s+here|join\s+sini|masuk\s+sini|join|masuk)(?:\s+|$)/i.test(cleanMsg);

    if (isJoinCommand) {
        if (!isMaster) {
            console.warn(`⛔ [Unauthorized Beep Command] Member #${senderId} (${senderName}) attempted to command room join: "${msg}"`);
            try {
                socket.emit("AccountBeep", {
                    MemberNumber: senderId,
                    Message: `⛔ [${botPlayer ? botPlayer.Name : CONFIG.accountName} Music] Access denied! Only authorized bot owners can command the bot to switch rooms.`
                });
            } catch (err) {}
            return;
        }

        // Master Admin ordering bot to join a room
        const joinMatch = cleanMsg.match(/^(?:!|\/)?(?:join\s+here|join\s+sini|masuk\s+sini|join|masuk)(?:\s*[:\-]?\s*(.+))?$/i);
        let rawRoom = joinMatch && joinMatch[1] ? joinMatch[1].trim() : "";

        let targetRoomToJoin = null;
        let roomPassword = "";

        if (rawRoom) {
            let candidate = rawRoom.replace(/^["'(\[<]+|["')\]>]+$/g, '').trim();
            // Support optional password via pipe or colon (e.g. RoomName|password or RoomName:password)
            if (candidate.includes("|")) {
                const parts = candidate.split("|");
                candidate = parts[0].trim();
                roomPassword = parts[1].trim();
            } else if (candidate.includes(":") && !candidate.includes("://")) {
                const parts = candidate.split(":");
                candidate = parts[0].trim();
                roomPassword = parts[1].trim();
            }

            if (candidate && !candidate.includes("{") && !candidate.includes("}")) {
                targetRoomToJoin = candidate;
            }
        }

        // Priority 2: Fallback to attached ChatRoomName in beep packet (from "join here" or client invite)
        if (!targetRoomToJoin && data.ChatRoomName) {
            targetRoomToJoin = data.ChatRoomName;
        }

        if (targetRoomToJoin) {
            console.log(`🎯 [Master Command] Member #${senderId} (${senderName}) ordered bot to join "${targetRoomToJoin}" (Space: "${space || 'Default'}")!`);
            try {
                socket.emit("AccountBeep", {
                    MemberNumber: senderId,
                    Message: `Understood! Joining "${targetRoomToJoin}" now 🎵`
                });
            } catch (err) {
                console.warn("Failed to send reply beep:", err.message);
            }
            switchRoom(socket, targetRoomToJoin, space, roomPassword, context);
        } else {
            console.warn(`⚠️ Received join command from #${senderId}, but room name could not be identified.`);
            try {
                socket.emit("AccountBeep", {
                    MemberNumber: senderId,
                    Message: `Please specify the room name: "join <RoomName>" or send a room invite beep.`
                });
            } catch (err) {}
        }
        return;
    }

    // Native in-game Room Invite
    if (isMaster && data.BeepType === "ChatRoomInvite" && data.ChatRoomName) {
        const targetRoomToJoin = data.ChatRoomName;
        console.log(`🚪 Native room invite to "${targetRoomToJoin}" received from Member #${senderId}! Navigating bot...`);
        try {
            socket.emit("AccountBeep", {
                MemberNumber: senderId,
                Message: `Joining room "${targetRoomToJoin}"...`
            });
        } catch (err) {}
        switchRoom(socket, targetRoomToJoin, space, "", context);
        return;
    }
}

module.exports = {
    handleAccountBeep,
};

