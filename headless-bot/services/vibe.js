/**
 * Vibe & Expression Service
 * Manages character facial expressions, idle animations (vibing to the beat),
 * and utility methods for sending room emotes and private whispers.
 */

let vibeTimer = null;

function sendRoomEmote(socket, msg) {
    if (!socket || !msg) return;
    socket.emit("ChatRoomChat", {
        Content: msg,
        Type: "Emote",
        Dictionary: [{ Tag: "MsgId", MsgId: Date.now().toString() }],
    });
}

function sendWhisper(socket, targetMemberNumber, msg) {
    if (!socket || !targetMemberNumber || !msg) return;
    socket.emit("ChatRoomChat", {
        Content: msg,
        Type: "Whisper",
        Target: Number(targetMemberNumber),
    });
}

function changeFaceExpression(socket, group, expression) {
    if (!socket || !group || !expression) return;
    socket.emit("ChatRoomCharacterExpressionUpdate", {
        Group: group,
        Name: expression,
    });
}

function startVibeAnimation(socket, getIsInRoom) {
    stopVibeAnimation();
    const eyes = ["Happy", "Wink", "Normal", "Closed"];
    const mouths = ["Smile", "Sing", "Normal"];

    vibeTimer = setInterval(() => {
        const inRoom = typeof getIsInRoom === "function" ? getIsInRoom() : true;
        if (!inRoom || !socket || !socket.connected) return;

        const randomEye = eyes[Math.floor(Math.random() * eyes.length)];
        const randomMouth = mouths[Math.floor(Math.random() * mouths.length)];
        changeFaceExpression(socket, "Eyes", randomEye);
        changeFaceExpression(socket, "Mouth", randomMouth);
    }, 12000);
}

function stopVibeAnimation() {
    if (vibeTimer) {
        clearInterval(vibeTimer);
        vibeTimer = null;
    }
}

module.exports = {
    sendRoomEmote,
    sendWhisper,
    changeFaceExpression,
    startVibeAnimation,
    stopVibeAnimation,
};

