/**
 * Web Dashboard Actions & Status Handler
 * Assembles unified live status JSON for dashboard / SSE stream
 * and dispatches remote control actions from the web UI.
 */

const { CONFIG, MASTER_ADMINS, STATIONS, addAuthorizedMember, removeAuthorizedMember } = require("../config");
const {
    getQueueState,
    playSong,
    skipSong,
    stopSong,
    clearQueue,
    playRadio,
    isBotAdmin,
} = require("../services/music");
const {
    addRoomAdmin,
    removeRoomAdmin,
    addRoomWhitelist,
    removeRoomWhitelist,
    addRoomBan,
    removeRoomBan,
    kickRoomMember,
} = require("./admin");
const { switchRoom } = require("../services/room");

function getBotStatus(state, botStartTime) {
    const { botPlayer, currentSocket, currentRoomData, isInRoom, getCharacterName } = state;
    const queueState = getQueueState();

    const characters = (currentRoomData && Array.isArray(currentRoomData.Character))
        ? currentRoomData.Character.map(c => ({
            memberNumber: c.MemberNumber,
            name: c.Name || (getCharacterName ? getCharacterName(c.MemberNumber) : `Member #${c.MemberNumber}`),
        }))
        : [];

    const stationList = Object.keys(STATIONS).map(key => ({
        id: key,
        name: STATIONS[key].name,
    }));

    const authMembers = Array.from(MASTER_ADMINS).map(id => ({
        memberNumber: id,
        name: getCharacterName ? getCharacterName(id) : `Member #${id}`,
    }));

    return {
        bot: {
            name: botPlayer ? (botPlayer.Name || CONFIG.accountName) : CONFIG.accountName,
            accountName: CONFIG.accountName,
            memberNumber: botPlayer ? botPlayer.MemberNumber : null,
            targetRoom: CONFIG.targetRoom,
            isOnline: Boolean(botPlayer) && Boolean(currentSocket && currentSocket.connected),
            friendsCount: botPlayer && Array.isArray(botPlayer.FriendList) ? botPlayer.FriendList.length : 0,
            uptime: Math.floor((Date.now() - (botStartTime || Date.now())) / 1000),
        },
        room: {
            name: currentRoomData ? currentRoomData.Name : CONFIG.targetRoom,
            space: currentRoomData ? (currentRoomData.Space || CONFIG.targetSpace || "") : "",
            isInRoom: Boolean(isInRoom && currentRoomData),
            players: characters,
            playerCount: characters.length,
            admins: currentRoomData && Array.isArray(currentRoomData.Admin) ? currentRoomData.Admin : [],
            whitelist: currentRoomData && Array.isArray(currentRoomData.Whitelist) ? currentRoomData.Whitelist : [],
            ban: currentRoomData && Array.isArray(currentRoomData.Ban) ? currentRoomData.Ban : [],
            musicUrl: currentRoomData && currentRoomData.Custom ? (currentRoomData.Custom.MusicURL || "") : "",
        },
        playback: {
            currentTrack: queueState.currentTrack,
            currentStation: queueState.currentStation,
            isConverting: queueState.isConverting,
        },
        queue: queueState.songQueue || [],
        stations: stationList,
        authorizedMembers: authMembers,
    };
}

async function handleWebAction(context, state, data) {
    if (!data || typeof data !== "object") {
        return { success: false, message: "Invalid payload." };
    }

    const { currentSocket, isInRoom, currentRoomData, botPlayer } = state;
    if (!currentSocket || !currentSocket.connected || !isInRoom || !currentRoomData) {
        return { success: false, message: "Bot is offline or not currently inside a room." };
    }

    const { action } = data;
    const { sendRoomEmote, changeFaceExpression, notifyWebRefresh } = context;

    switch (action) {
        case "play":
            return await playSong(context, data.query, "Web", 0, data.requester || "Web DJ");
        case "skip":
            return skipSong(context, data.requester || "Web DJ");
        case "stop":
            return stopSong(context, data.requester || "Web DJ");
        case "clear":
            return clearQueue(context, data.requester || "Web DJ");
        case "radio":
            return playRadio(context, data.genre, data.requester || "Web DJ");
        case "chat": {
            const msg = (data.message || "").trim();
            if (!msg) return { success: false, message: "Message cannot be empty." };
            if (data.isEmote) {
                if (typeof sendRoomEmote === "function") {
                    sendRoomEmote(currentSocket, msg.startsWith("*") ? msg : `* ${msg}`);
                }
            } else {
                currentSocket.emit("ChatRoomChat", {
                    Content: msg,
                    Type: "Chat",
                });
            }
            return { success: true, message: "Message successfully sent to the room." };
        }
        case "expression": {
            const { group, expression } = data;
            if (!group || !expression) return { success: false, message: "Group and expression are required." };
            if (typeof changeFaceExpression === "function") {
                changeFaceExpression(currentSocket, group, expression);
            }
            return { success: true, message: `Expression for ${group} changed to ${expression}.` };
        }
        case "admin": {
            const { subAction, memberNumber, operatorNumber } = data;
            const op = operatorNumber || (botPlayer ? botPlayer.MemberNumber : 0);
            switch (subAction) {
                case "addAdmin":
                    return addRoomAdmin(context, memberNumber, op);
                case "removeAdmin":
                    return removeRoomAdmin(context, memberNumber, op);
                case "addWhitelist":
                    return addRoomWhitelist(context, memberNumber, op);
                case "removeWhitelist":
                    return removeRoomWhitelist(context, memberNumber, op);
                case "addBan":
                    return addRoomBan(context, memberNumber, op);
                case "removeBan":
                    return removeRoomBan(context, memberNumber, op);
                case "kick":
                    return kickRoomMember(context, memberNumber, op);
                default:
                    return { success: false, message: `Unknown admin sub-action '${subAction}'.` };
            }
        }
        case "authorizedMember": {
            const { subAction, memberNumber, roomName, space, password } = data;
            if (subAction === "add") {
                const res = addAuthorizedMember(memberNumber);
                if (res.success) {
                    const num = parseInt(memberNumber, 10);
                    if (num && isInRoom && currentRoomData && isBotAdmin(botPlayer, currentRoomData)) {
                        addRoomAdmin(context, num, botPlayer.MemberNumber);
                    }
                }
                if (typeof notifyWebRefresh === "function") notifyWebRefresh();
                return res;
            }
            if (subAction === "remove") {
                const res = removeAuthorizedMember(memberNumber);
                if (res.success) {
                    const num = parseInt(memberNumber, 10);
                    if (num && isInRoom && currentRoomData && isBotAdmin(botPlayer, currentRoomData)) {
                        if (Array.isArray(currentRoomData.Admin) && currentRoomData.Admin.includes(num)) {
                            removeRoomAdmin(context, num, botPlayer.MemberNumber);
                        }
                    }
                }
                if (typeof notifyWebRefresh === "function") notifyWebRefresh();
                return res;
            }
            if (subAction === "switchRoom") {
                if (!roomName || !roomName.trim()) {
                    return { success: false, message: "Nama ruangan tidak boleh kosong." };
                }
                const target = roomName.trim();
                switchRoom(currentSocket, target, space || "", password || "", context);
                return { success: true, message: `Memerintahkan bot untuk berpindah ke ruangan "${target}"...` };
            }
            return { success: false, message: `Unknown authorizedMember sub-action '${subAction}'.` };
        }
        default:
            return { success: false, message: `Unknown action '${action}'.` };
    }
}

module.exports = {
    getBotStatus,
    handleWebAction,
};
