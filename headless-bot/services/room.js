/**
 * Room Navigation & Join Management Service
 * Handles room joining, automatic retries when locked/full,
 * and switching between rooms commanded by authorized members or dashboard.
 */

const { CONFIG } = require("../config");
const { resetQueue } = require("./music");
const { stopVibeAnimation } = require("./vibe");

let retryJoinTimer = null;

function clearRetryJoin() {
    if (retryJoinTimer) {
        clearTimeout(retryJoinTimer);
        retryJoinTimer = null;
    }
}

function scheduleRetryJoin(socket, delayMs, checkInRoom) {
    clearRetryJoin();
    retryJoinTimer = setTimeout(() => {
        const inRoom = typeof checkInRoom === "function" ? checkInRoom() : false;
        if (!inRoom && socket && socket.connected) {
            joinTargetRoom(socket);
        }
    }, delayMs);
}

function joinTargetRoom(socket, roomName = CONFIG.targetRoom, space = (CONFIG.targetSpace || ""), password = (CONFIG.roomPassword || "")) {
    if (!socket || !socket.connected) return;
    const packet = { Name: roomName };
    if (space) packet.Space = space;
    if (password) packet.Password = password;
    socket.emit("ChatRoomJoin", packet);
}

function switchRoom(socket, roomName, space = "", password = "", context = null) {
    if (!roomName || !socket || !socket.connected) return;
    CONFIG.targetRoom = roomName;
    CONFIG.targetSpace = space || "";
    if (password) CONFIG.roomPassword = password;

    const isInRoom = context ? context.isInRoom : false;
    const currentRoomData = context ? context.currentRoomData : null;
    const botPlayer = context ? context.botPlayer : null;
    const sendRoomEmote = context ? context.sendRoomEmote : null;

    if (isInRoom) {
        if (currentRoomData && currentRoomData.Name && currentRoomData.Name.toLowerCase() === roomName.toLowerCase()) {
            console.log(`📍 Bot is already inside room "${roomName}".`);
            if (typeof sendRoomEmote === "function") {
                sendRoomEmote(
                    socket,
                    `* 🎵 [${botPlayer ? botPlayer.Name : CONFIG.accountName} Music] I am already here in ${roomName}! Ready for music requests 🎧`
                );
            }
            return;
        }

        console.log(`🚪 Leaving current room "${currentRoomData ? currentRoomData.Name : 'Room'}"...`);
        socket.emit("ChatRoomLeave", "");
        if (context) {
            context.isInRoom = false;
            context.currentRoomData = null;
        }
        resetQueue();
        stopVibeAnimation();

        setTimeout(() => {
            console.log(`🚪 Joining new room: "${roomName}"...`);
            joinTargetRoom(socket, roomName, space, password);
        }, 600);
    } else {
        console.log(`🚪 Joining room: "${roomName}"...`);
        joinTargetRoom(socket, roomName, space, password);
    }
}

module.exports = {
    clearRetryJoin,
    scheduleRetryJoin,
    joinTargetRoom,
    switchRoom,
};
