/**
 * Follower & Companion Service for Authorized Members
 * Manages "Nava, follow me" and "Nava, stay here" commands,
 * automatic cross-room following of authorized mistress/master,
 * and temporary suspension of public bot features (music, !help) while following.
 */

const { MASTER_ADMINS } = require("../config");
const { switchRoom } = require("./room");
const { stopSong, resetQueue } = require("./music");
const {
    sendRoomChat,
    changeFaceExpression,
    startVibeAnimation,
    stopVibeAnimation,
} = require("./vibe");

let followPollTimer = null;
let isSwitchingRoom = false;

function cleanCommandString(content) {
    if (!content || typeof content !== "string") return "";
    return content
        .trim()
        .replace(/^[\(\[\{\*_\s]+|[\)\]\}\*_\s]+$/g, "")
        .trim();
}

function isFollowMeCommand(content) {
    const clean = cleanCommandString(content);
    return /^nava,?\s*follow\s+me[\.!]?$/i.test(clean);
}

function isStayHereCommand(content) {
    const clean = cleanCommandString(content);
    return /^nava,?\s*stay\s+here[\.!]?$/i.test(clean);
}

function clearFollowTimer() {
    if (followPollTimer) {
        clearInterval(followPollTimer);
        followPollTimer = null;
    }
}

/**
 * Initiates following mode when authorized member chats "Nava, follow me"
 */
function startFollowing(context, state, targetMemberNumber, targetName = "Mistress") {
    const { socket, changeFaceExpression, notifyWebRefresh } = context;
    const targetId = Number(targetMemberNumber);

    state.isFollowing = true;
    state.followingTarget = targetId;
    state.followingTargetName = targetName;
    state.isPaused = true;

    console.log(`\n👑 [Follow Mode Activated] Member #${targetId} (${targetName}) commanded: "Nava, follow me"`);
    console.log(`   Bot functions (!help, music commands) are now PAUSED.`);

    // 1. Reply in normal room chat
    sendRoomChat(socket, "Yes Mistress");

    // 2. Submissive, obedient facial expression
    if (typeof changeFaceExpression === "function") {
        changeFaceExpression(socket, "Eyes", "Closed");
        changeFaceExpression(socket, "Blush", "Low");
        changeFaceExpression(socket, "Mouth", "Smile");
    }

    // 3. Stop current room music & clear queue while following
    try {
        stopSong(context, "Following Mistress", targetId, targetName);
        resetQueue();
        stopVibeAnimation();
    } catch (err) {
        console.warn("⚠️ Error stopping music on follow me:", err.message);
    }

    // 4. Ensure mistress is on bot's FriendList for AccountQuery tracking
    if (state.botPlayer) {
        if (!Array.isArray(state.botPlayer.FriendList)) {
            state.botPlayer.FriendList = [];
        }
        if (!state.botPlayer.FriendList.includes(targetId)) {
            state.botPlayer.FriendList.push(targetId);
            try {
                socket.emit("AccountUpdate", { FriendList: state.botPlayer.FriendList });
                console.log(`🤝 [Follow Mode] Added mistress #${targetId} to FriendList for room tracking.`);
            } catch (err) {}
        }
    }

    // 5. Start periodic tracking timer to detect if mistress moves to another room
    clearFollowTimer();
    followPollTimer = setInterval(() => {
        if (!state.isFollowing || !state.followingTarget || !socket || !socket.connected) {
            clearFollowTimer();
            return;
        }

        // Check if mistress is in the current room
        const inRoomWithTarget = state.currentRoomData && Array.isArray(state.currentRoomData.Character)
            ? state.currentRoomData.Character.some(c => c.MemberNumber === state.followingTarget)
            : false;

        if (!inRoomWithTarget && !isSwitchingRoom) {
            // Mistress is not in current room, query where she is
            try {
                socket.emit("AccountQuery", { Query: "OnlineFriends" });
            } catch (err) {}
        }
    }, 2500);

    if (typeof notifyWebRefresh === "function") notifyWebRefresh();
}

/**
 * Disengages following mode when authorized member chats "Nava, stay here"
 */
function stopFollowing(context, state) {
    const { socket, changeFaceExpression, notifyWebRefresh } = context;

    state.isFollowing = false;
    const prevTarget = state.followingTarget;
    const prevName = state.followingTargetName || "Mistress";
    state.followingTarget = null;
    state.followingTargetName = null;
    state.isPaused = false;

    clearFollowTimer();
    isSwitchingRoom = false;

    console.log(`\n👑 [Follow Mode Deactivated] Member #${prevTarget} (${prevName}) commanded: "Nava, stay here"`);
    console.log(`   Bot functions (!help, music commands) are now RESTORED.`);

    // 1. Reply in normal room chat
    sendRoomChat(socket, "Yes Mistress");

    // 2. Happy, active facial expression
    if (typeof changeFaceExpression === "function") {
        changeFaceExpression(socket, "Eyes", "Happy");
        changeFaceExpression(socket, "Blush", "None");
        changeFaceExpression(socket, "Mouth", "Smile");
    }

    // 3. Resume idle animation
    startVibeAnimation(socket, () => state.isInRoom);

    if (typeof notifyWebRefresh === "function") notifyWebRefresh();
}

/**
 * Handles AccountQueryResult from game server to detect mistress room transitions
 */
function handleFollowQueryResult(context, state, data) {
    if (!state.isFollowing || !state.followingTarget) return;
    if (!data || data.Query !== "OnlineFriends" || !Array.isArray(data.Result)) return;

    const { socket } = context;
    const mistress = data.Result.find(f => f.MemberNumber === state.followingTarget);
    if (!mistress) return;

    const targetRoom = mistress.ChatRoomName;
    const targetSpace = mistress.ChatRoomSpace || "";
    const currentRoom = state.currentRoomData ? state.currentRoomData.Name : "";

    if (targetRoom && targetRoom !== currentRoom && !isSwitchingRoom) {
        console.log(`\n🚀 [Follow Mode] Detected Mistress #${mistress.MemberNumber} in room "${targetRoom}" (Space: "${targetSpace || 'Default'}").`);
        console.log(`   Switching room to follow mistress...`);

        isSwitchingRoom = true;
        switchRoom(socket, targetRoom, targetSpace, "", context);

        setTimeout(() => {
            isSwitchingRoom = false;
        }, 3000);
    }
}

/**
 * Immediate trigger when mistress leaves current room
 */
function handleFollowMemberLeave(context, state, leftMemberNumber) {
    if (!state.isFollowing || !state.followingTarget) return;
    if (Number(leftMemberNumber) === state.followingTarget) {
        console.log(`\n👑 [Follow Mode] Mistress #${leftMemberNumber} left the current room. Searching for her new room...`);
        if (context.socket && context.socket.connected) {
            try {
                context.socket.emit("AccountQuery", { Query: "OnlineFriends" });
            } catch (err) {}
        }
    }
}

module.exports = {
    isFollowMeCommand,
    isStayHereCommand,
    startFollowing,
    stopFollowing,
    handleFollowQueryResult,
    handleFollowMemberLeave,
};
