/**
 * Friends Management Service
 * Handles automatic acceptance of friend requests in Bondage Club,
 * syncs relations to server via AccountUpdate, and sends mutual handshake packets.
 */

const { CONFIG } = require("../config");

/**
 * Automatically accepts a friend request, adds player to FriendList,
 * syncs with BC server via AccountUpdate, and sends mutual handshake.
 *
 * @param {Object} params
 * @param {Object} params.socket - Socket.io instance
 * @param {Object} params.botPlayer - Current bot player object from LoginResponse
 * @param {boolean} params.isInRoom - Whether bot is currently inside a room
 * @param {number|string} params.senderNumber - Member number of the friend requester
 * @param {string} [params.senderName] - Optional name of the sender
 * @param {Function} params.getCharacterName - Helper to look up character name
 * @param {Function} params.sendRoomEmote - Helper to send emote in room
 * @param {Function} params.changeFaceExpression - Helper to update facial expression
 */
function acceptFriendRequest({
    socket,
    botPlayer,
    isInRoom,
    senderNumber,
    senderName = null,
    getCharacterName,
    sendRoomEmote,
    changeFaceExpression,
}) {
    if (!botPlayer || !socket || !senderNumber) return;
    const targetId = Number(senderNumber);
    if (!targetId || isNaN(targetId) || targetId === botPlayer.MemberNumber) return;

    if (!Array.isArray(botPlayer.FriendList)) {
        botPlayer.FriendList = [];
    }

    const name = senderName || (typeof getCharacterName === "function" ? getCharacterName(targetId) : `Member #${targetId}`);
    const wasAlreadyFriend = botPlayer.FriendList.includes(targetId);

    if (!wasAlreadyFriend) {
        botPlayer.FriendList.push(targetId);
        console.log(`🤝 [Friend Request] Added Member #${targetId} (${name}) to FriendList. Total friends: ${botPlayer.FriendList.length}`);
    } else {
        console.log(`🤝 [Friend Request] Member #${targetId} (${name}) is already in FriendList. Sending confirmation handshake.`);
    }

    // 1. Sync updated FriendList to the game server
    try {
        socket.emit("AccountUpdate", { FriendList: botPlayer.FriendList });
        console.log(`📤 [AccountUpdate] Synced FriendList to server (${botPlayer.FriendList.length} friend(s)).`);
    } catch (err) {
        console.error("❌ Failed to emit AccountUpdate for FriendList:", err.message);
    }

    // 2. Send official Hidden BC friend handshake packet targeted to sender
    try {
        socket.emit("ChatRoomChat", {
            Content: "ChatRoomFriendRequestAdd",
            Type: "Hidden",
            Target: targetId,
        });
    } catch (err) {
        console.warn("Failed to send ChatRoomFriendRequestAdd hidden packet:", err.message);
    }

    // 3. Announce in room chat and show happy expression if bot is in room
    if (isInRoom) {
        const botName = botPlayer.Name || CONFIG.accountName;
        if (typeof changeFaceExpression === "function") {
            changeFaceExpression(socket, "Eyes", "Happy");
            changeFaceExpression(socket, "Mouth", "Smile");
        }
        if (typeof sendRoomEmote === "function") {
            sendRoomEmote(
                socket,
                `* 🤝 [${botName} Music] Accepted friend request from ${name} (#${targetId})! We are now friends ✨`
            );
        }
    }
}

module.exports = {
    acceptFriendRequest,
};

