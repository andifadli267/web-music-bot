/**
 * Socket Room Events Handler
 * Binds and manages all in-game room socket events:
 * ChatRoomSync, Member Join/Leave, Chat Messages, Whispers, Room Updates.
 */

const { CONFIG } = require("../config");
const { clearRetryJoin } = require("../services/room");
const { startVibeAnimation } = require("../services/vibe");
const { acceptFriendRequest } = require("../services/friends");
const { extractCommand, handleRoomCommand } = require("./commands");
const { handleAdminWhisper } = require("./admin");

function registerRoomEvents(socket, context, state) {
    const {
        sendRoomEmote,
        sendWhisper,
        changeFaceExpression,
        getCharacterName,
        notifyWebRefresh,
    } = context;

    // Room Sync when joining or room settings are reloaded
    socket.on("ChatRoomSync", (data) => {
        if (!data || !data.Name) return;

        state.isInRoom = true;
        state.currentRoomData = data;
        clearRetryJoin();

        const charList = Array.isArray(data.Character) ? data.Character : [];
        console.log(`\n==========================================================`);
        console.log(`📍 Bot character IS NOW IN ROOM: "${data.Name}"!`);
        console.log(`👥 Players in room (${charList.length}): ${charList.map(c => c.Name).join(", ") || "Only bot"}`);
        console.log(`👑 Room Admins: ${Array.isArray(data.Admin) ? data.Admin.join(", ") : "None"}`);
        
        const activeMusic = data.Custom && data.Custom.MusicURL;
        console.log(`🎵 Current Room Music: ${activeMusic ? activeMusic : "None active"}`);
        console.log(`==========================================================\n`);

        setTimeout(() => {
            const myName = state.botPlayer ? (state.botPlayer.Name || CONFIG.accountName) : CONFIG.accountName;
            const welcomeMsg = `🎵 [${myName} Music] Ready to play synced music in ${data.Name}! Type !help to see commands & radio genres 🎧`;
            charList.forEach(c => {
                if (c.MemberNumber && state.botPlayer && c.MemberNumber !== state.botPlayer.MemberNumber) {
                    sendWhisper(socket, c.MemberNumber, welcomeMsg);
                }
            });
        }, 1500);

        charList.forEach(c => {
            if (c.MemberNumber && c.Name) {
                state.characterNames.set(c.MemberNumber, c.Name);
            }
            if (state.botPlayer && c.MemberNumber !== state.botPlayer.MemberNumber && !state.knownCharacters.has(c.MemberNumber)) {
                state.knownCharacters.add(c.MemberNumber);
            }
        });

        // Prune members who left from knownCharacters
        const currentMemberNums = new Set(charList.map(c => c.MemberNumber));
        state.knownCharacters.forEach(num => {
            if (!currentMemberNums.has(num)) {
                state.knownCharacters.delete(num);
            }
        });

        if (typeof notifyWebRefresh === "function") notifyWebRefresh();
        startVibeAnimation(socket, () => state.isInRoom);
    });

    // Greet players via whisper when they join or re-join the room
    socket.on("ChatRoomSyncMemberJoin", (data) => {
        if (!data || !data.Character) return;
        const newChar = data.Character;
        const memberNum = Number(newChar.MemberNumber);
        if (newChar && memberNum && newChar.Name) {
            state.characterNames.set(memberNum, newChar.Name);
        }
        if (state.currentRoomData && Array.isArray(state.currentRoomData.Character)) {
            const exists = state.currentRoomData.Character.some(c => c.MemberNumber === memberNum);
            if (!exists) {
                state.currentRoomData.Character.push(newChar);
            }
        }
        if (typeof notifyWebRefresh === "function") notifyWebRefresh();

        if (state.botPlayer && memberNum === state.botPlayer.MemberNumber) return;

        // When a player joins (or rejoins after leaving), send the welcome whisper again
        if (!state.knownCharacters.has(memberNum)) {
            state.knownCharacters.add(memberNum);
            setTimeout(() => {
                const stillInRoom = state.currentRoomData && Array.isArray(state.currentRoomData.Character)
                    ? state.currentRoomData.Character.some(c => c.MemberNumber === memberNum)
                    : true;
                if (!stillInRoom) return;

                const myName = state.botPlayer ? (state.botPlayer.Name || CONFIG.accountName) : CONFIG.accountName;
                const roomName = state.currentRoomData ? state.currentRoomData.Name : CONFIG.targetRoom;
                const welcomeMsg = `🎵 [${myName} Music] Ready to play synced music in ${roomName}! Type !help to see commands & radio genres 🎧`;
                sendWhisper(socket, memberNum, welcomeMsg);
            }, 1500);
        }
    });

    // When a player leaves the room, remove them from knownCharacters so they get greeted on re-joining
    socket.on("ChatRoomSyncMemberLeave", (data) => {
        let leftMemberNumber = null;
        if (typeof data === "number") {
            leftMemberNumber = data;
        } else if (data && typeof data === "object") {
            leftMemberNumber = data.SourceMemberNumber || data.MemberNumber || data.Target || data.Sender;
        }

        if (leftMemberNumber) {
            const num = Number(leftMemberNumber);
            state.knownCharacters.delete(num);
            if (state.currentRoomData && Array.isArray(state.currentRoomData.Character)) {
                state.currentRoomData.Character = state.currentRoomData.Character.filter(c => c.MemberNumber !== num);
            }
            console.log(`👋 [Room Leave] Member #${num} (${state.characterNames.get(num) || "Player"}) left the room.`);
        }
        if (typeof notifyWebRefresh === "function") notifyWebRefresh();
    });

    // Server update response
    socket.on("ChatRoomUpdateResponse", (res) => {
        if (res === "Updated") {
            console.log("✅ [Server] Room administration update (Music/Settings) ACCEPTED by server!");
            if (typeof notifyWebRefresh === "function") notifyWebRefresh();
        } else {
            console.warn("⚠️ [Server] Room update response:", res);
        }
    });

    // Live Room Properties sync
    socket.on("ChatRoomSyncRoomProperties", (data) => {
        if (data && state.currentRoomData) {
            Object.assign(state.currentRoomData, data);
            console.log(`🔄 [Room Sync] Room properties synced to all players! MusicURL: "${data.Custom?.MusicURL || 'None'}"`);
            if (typeof notifyWebRefresh === "function") notifyWebRefresh();
        }
    });

    // General Chat & Message Receiver
    socket.on("ChatRoomMessage", (data) => {
        if (!data || !data.Content || typeof data.Content !== "string") return;

        const content = data.Content.trim();
        const sender = data.Sender;

        // Handle ServerLeave / ServerDisconnect / ServerBan / ServerKick action events
        if (data.Type === "Action" && (content === "ServerLeave" || content === "ServerDisconnect" || content === "ServerBan" || content === "ServerKick")) {
            let leftNum = sender;
            if (Array.isArray(data.Dictionary)) {
                const srcObj = data.Dictionary.find(d => d && (d.SourceMemberNumber || d.MemberNumber || d.TargetMemberNumber));
                if (srcObj) leftNum = srcObj.SourceMemberNumber || srcObj.MemberNumber || srcObj.TargetMemberNumber;
            }
            if (leftNum) {
                const num = Number(leftNum);
                state.knownCharacters.delete(num);
                if (state.currentRoomData && Array.isArray(state.currentRoomData.Character)) {
                    state.currentRoomData.Character = state.currentRoomData.Character.filter(c => c.MemberNumber !== num);
                }
                console.log(`👋 [ServerLeave Action] Member #${num} left the room.`);
            }
            if (typeof notifyWebRefresh === "function") notifyWebRefresh();
            return;
        }

        if (sender && !state.knownCharacters.has(sender)) {
            state.knownCharacters.add(sender);
        }

        // Native BC in-room friend request
        if (content === "ChatRoomFriendRequestAdd") {
            const isForMe = !data.Target || (state.botPlayer && data.Target === state.botPlayer.MemberNumber);
            if (isForMe) {
                console.log(`🤝 [Friend Request Received] Member #${sender} (${getCharacterName(sender)}) sent a friend request in room! Auto-accepting...`);
                acceptFriendRequest({
                    socket,
                    botPlayer: state.botPlayer,
                    isInRoom: state.isInRoom,
                    senderNumber: sender,
                    getCharacterName,
                    sendRoomEmote,
                    changeFaceExpression,
                });
                if (typeof notifyWebRefresh === "function") notifyWebRefresh();
                return;
            }
        }

        // Private Whisper (/w) to the bot - specifically handles Room Admin commands
        if (data.Type === "Whisper") {
            const isForMe = !data.Target || (state.botPlayer && data.Target === state.botPlayer.MemberNumber);
            if (isForMe) {
                console.log(`🔒 [Whisper from ${getCharacterName(sender)} (#${sender})]: "${content}"`);
                handleAdminWhisper(context, content, sender);
                if (typeof notifyWebRefresh === "function") notifyWebRefresh();
                return;
            }
        }

        const isInternalAddon = /^(ECHO_|PCM_|CG_|BCEMsg|BCXMsg|KIKILINK|Liko)/.test(content);
        if (!isInternalAddon) {
            console.log(`💬 [${getCharacterName(sender)} (#${sender})]: "${content}"`);
        }

        const cmdText = extractCommand(content);
        if (!cmdText) return;

        handleRoomCommand(context, cmdText, sender);
        if (typeof notifyWebRefresh === "function") notifyWebRefresh();
    });
}

module.exports = {
    registerRoomEvents,
};
