/**
 * Bondage Club (R132+) - Standalone Headless DJ Character Bot
 * 
 * An autonomous character bot that logs in with its own account,
 * joins the designated private room ("V Main Hall"),
 * and broadcasts room music using native BC Room Customization (Custom.MusicURL).
 * Music is synchronized and audible to EVERYONE in the room without requiring addons!
 */

const { io } = require("socket.io-client");
const { CONFIG, MASTER_ADMINS, CONVERT_DIR, STATIONS } = require("./config");
const { detectPythonRuntime, cleanLocalFiles } = require("./services/audio");
const { acceptFriendRequest } = require("./services/friends");
const {
    extractCommand,
    handleRoomCommand,
    resetQueue,
    getQueueState,
    playSong,
    skipSong,
    stopSong,
    clearQueue,
    playRadio,
} = require("./handlers/commands");
const {
    handleAdminWhisper,
    addRoomAdmin,
    removeRoomAdmin,
    addRoomWhitelist,
    removeRoomWhitelist,
    addRoomBan,
    removeRoomBan,
    kickRoomMember,
} = require("./handlers/admin");
const { startWebServer, stopWebServer, notifyWebUpdate } = require("./web/server");

const botStartTime = Date.now();
let currentSocket = null;
let botPlayer = null;
let currentRoomData = null;
let isInRoom = false;
let knownCharacters = new Set();
const characterNames = new Map();
let vibeTimer = null;
let retryJoinTimer = null;

function getBotStatus() {
    const queueState = getQueueState();
    const characters = (currentRoomData && Array.isArray(currentRoomData.Character))
        ? currentRoomData.Character.map(c => ({
            memberNumber: c.MemberNumber,
            name: c.Name || getCharacterName(c.MemberNumber),
        }))
        : [];

    const stationList = Object.keys(STATIONS).map(key => ({
        id: key,
        name: STATIONS[key].name,
    }));

    return {
        bot: {
            name: botPlayer ? (botPlayer.Name || CONFIG.accountName) : CONFIG.accountName,
            accountName: CONFIG.accountName,
            memberNumber: botPlayer ? botPlayer.MemberNumber : null,
            targetRoom: CONFIG.targetRoom,
            isOnline: Boolean(botPlayer) && Boolean(currentSocket && currentSocket.connected),
            friendsCount: botPlayer && Array.isArray(botPlayer.FriendList) ? botPlayer.FriendList.length : 0,
            uptime: Math.floor((Date.now() - botStartTime) / 1000),
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
    };
}

async function handleWebAction(data) {
    if (!data || typeof data !== "object") {
        return { success: false, message: "Payload tidak valid." };
    }
    if (!currentSocket || !currentSocket.connected || !isInRoom || !currentRoomData) {
        return { success: false, message: "Bot sedang offline atau belum berada di dalam ruangan." };
    }

    const context = getContext(currentSocket);
    const { action } = data;

    switch (action) {
        case "play":
            return await playSong(context, data.query, "Web", data.requester || "Web DJ");
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
            if (!msg) return { success: false, message: "Pesan tidak boleh kosong." };
            if (data.isEmote) {
                sendRoomEmote(currentSocket, msg.startsWith("*") ? msg : `* ${msg}`);
            } else {
                currentSocket.emit("ChatRoomChat", {
                    Content: msg,
                    Type: "Chat",
                });
            }
            return { success: true, message: "Pesan berhasil dikirim ke ruangan." };
        }
        case "expression": {
            const { group, expression } = data;
            if (!group || !expression) return { success: false, message: "Group dan expression wajib diisi." };
            changeFaceExpression(currentSocket, group, expression);
            return { success: true, message: `Ekspresi ${group} diubah menjadi ${expression}.` };
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
                    return { success: false, message: `Sub-aksi admin '${subAction}' tidak dikenal.` };
            }
        }
        default:
            return { success: false, message: `Aksi '${action}' tidak dikenal.` };
    }
}

function getCharacterName(memberNumber) {
    if (!memberNumber) return "Someone";
    if (characterNames.has(memberNumber)) {
        return characterNames.get(memberNumber);
    }
    if (currentRoomData && Array.isArray(currentRoomData.Character)) {
        const found = currentRoomData.Character.find(c => c.MemberNumber === memberNumber);
        if (found && found.Name) {
            characterNames.set(memberNumber, found.Name);
            return found.Name;
        }
    }
    return `Member #${memberNumber}`;
}

function sendRoomEmote(socket, msg) {
    socket.emit("ChatRoomChat", {
        Content: msg,
        Type: "Emote",
        Dictionary: [{ Tag: "MsgId", MsgId: Date.now().toString() }],
    });
}

function sendWhisper(socket, targetMemberNumber, msg) {
    if (!socket || !targetMemberNumber) return;
    socket.emit("ChatRoomChat", {
        Content: msg,
        Type: "Whisper",
        Target: Number(targetMemberNumber),
    });
}

function changeFaceExpression(socket, group, expression) {
    socket.emit("ChatRoomCharacterExpressionUpdate", {
        Group: group,
        Name: expression,
    });
}

function getContext(socket) {
    return {
        socket,
        botPlayer,
        currentRoomData,
        isInRoom,
        getCharacterName,
        sendRoomEmote,
        sendWhisper,
        changeFaceExpression,
        notifyWebRefresh: notifyWebUpdate,
    };
}

async function startBot() {
    cleanLocalFiles();
    const pyVersion = detectPythonRuntime();
    console.log("==========================================================");
    console.log("🤖 Bondage Club - Standalone Music DJ Character Bot");
    console.log("   Broadcasting synchronized room audio for EVERYONE");
    console.log("==========================================================");
    console.log(`⚡ Node.js Runtime: ${process.version} (${process.execPath})`);
    console.log(`🐍 Python Runtime : ${pyVersion}`);
    console.log(`🌐 Game Web URL   : ${CONFIG.webUrl}`);
    console.log(`👤 Bot Account    : ${CONFIG.accountName}`);
    console.log(`🚪 Target Room    : "${CONFIG.targetRoom}" (Private Room)`);
    console.log(`📁 Local Storage  : ${CONVERT_DIR}`);
    console.log(`📊 Web Dashboard  : http://localhost:${CONFIG.webPort}`);
    console.log("----------------------------------------------------------");

    startWebServer(CONFIG.webPort, getBotStatus, handleWebAction);

    const socket = io(CONFIG.serverUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 50,
        reconnectionDelay: 3000,
        extraHeaders: {
            Origin: "https://www.bondage-asia.com",
            Referer: "https://www.bondage-asia.com/club/R132/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    currentSocket = socket;

    socket.on("connect", () => {
        console.log("✅ Connected to BC socket server! (Socket ID: " + socket.id + ")");
        console.log(`🔑 Sending login request for "${CONFIG.accountName}"...`);

        socket.emit("AccountLogin", {
            AccountName: CONFIG.accountName,
            Password: CONFIG.password,
        });
    });

    socket.on("LoginResponse", (res) => {
        if (typeof res === "string") {
            console.error("❌ Login failed. Server response:", res);
            return;
        }

        if (res && res.AccountName) {
            botPlayer = res;
            if (!Array.isArray(botPlayer.FriendList)) {
                botPlayer.FriendList = [];
            }
            console.log(`🎉 Login Successful!`);
            console.log(`   Character Name : ${res.Name || res.AccountName}`);
            console.log(`   Member Number  : #${res.MemberNumber}`);
            console.log(`   Friends Count  : ${botPlayer.FriendList.length}`);
            console.log("----------------------------------------------------------");
            console.log(`🚪 Joining private room "${CONFIG.targetRoom}"...`);
            console.log(`💡 NOTE: Ensure member #${res.MemberNumber} (${res.Name || res.AccountName}) is on the Whitelist/Admin list of the room!`);
            console.log("----------------------------------------------------------");
            
            joinTargetRoom(socket);
        }
    });

    socket.on("ChatRoomSearchResponse", (data) => {
        if (isInRoom) return;

        if (data === "CannotFindRoom" || data === "RoomLocked") {
            process.stdout.write(`\r⏳ Waiting to access room "${CONFIG.targetRoom}" (Response: ${data}). Retrying... `);
            scheduleRetryJoin(socket, 5000);
        } else if (data === "RoomFull") {
            console.warn(`\n⚠️ Room "${CONFIG.targetRoom}" is currently full. Retrying in 8s...`);
            scheduleRetryJoin(socket, 8000);
        } else if (data === "JoinedRoom") {
            console.log(`\n✅ Server response: Successfully joined room!`);
        } else {
            console.log(`\nℹ️ ChatRoomSearchResponse:`, data);
        }
    });

    // Beep / Invite Listener: If owner (#245253) sends "join here" or room invite, bot navigates to that room
    socket.on("AccountBeep", (data) => {
        if (!data || typeof data !== "object") return;

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
        const isJoinHere = /(?:join\s+here|join\s+sini|masuk\s+sini)/i.test(msg);
        const joinMatch = msg.match(/(?:join\s+here|join\s+sini|masuk\s+sini)(?:\s*[:\-]?\s*(.+))?/i);

        let targetRoomToJoin = null;

        if (isMaster && isJoinHere) {
            // Priority 1: Official ChatRoomName attached to the beep by the game client
            if (data.ChatRoomName) {
                targetRoomToJoin = data.ChatRoomName;
            } 
            // Priority 2: Room name manually typed after "join here"
            else if (joinMatch && joinMatch[1] && joinMatch[1].trim()) {
                let cleaned = joinMatch[1].replace(/[\u200B-\u200D\uFEFF\u2060-\u2064]/g, '');
                cleaned = cleaned.replace(/LikoMAT:[a-zA-Z0-9_-]+/gi, '').trim();
                const roomNameCandidate = cleaned.replace(/^["'(\[]+|["')\]]+$/g, '').trim();
                if (roomNameCandidate && !roomNameCandidate.includes("{") && !roomNameCandidate.includes("}")) {
                    targetRoomToJoin = roomNameCandidate;
                }
            }

            if (targetRoomToJoin) {
                console.log(`🎯 [Master Command] Member #${senderId} ordered bot to join "${targetRoomToJoin}" (Space: "${space || 'Default'}")!`);
                try {
                    socket.emit("AccountBeep", {
                        MemberNumber: senderId,
                        Message: `Understood! Joining "${targetRoomToJoin}" now 🎵`
                    });
                } catch (err) {
                    console.warn("Failed to send reply beep:", err.message);
                }
                switchRoom(socket, targetRoomToJoin, space);
            } else {
                console.warn(`⚠️ Received "join here" from #${senderId}, but room name could not be identified.`);
                try {
                    socket.emit("AccountBeep", {
                        MemberNumber: senderId,
                        Message: `Received "join here", but room name is missing. Please send a room invite beep or specify: "join here <RoomName>"`
                    });
                } catch (err) {}
            }
            return;
        }

        // Native in-game Room Invite
        if (isMaster && data.BeepType === "ChatRoomInvite" && data.ChatRoomName) {
            targetRoomToJoin = data.ChatRoomName;
            console.log(`🚪 Native room invite to "${targetRoomToJoin}" received from Member #${senderId}! Navigating bot...`);
            try {
                socket.emit("AccountBeep", {
                    MemberNumber: senderId,
                    Message: `Joining room "${targetRoomToJoin}"...`
                });
            } catch (err) {}
            switchRoom(socket, targetRoomToJoin, space);
        }
    });

    socket.on("ChatRoomSync", (data) => {
        if (!data || !data.Name) return;

        isInRoom = true;
        currentRoomData = data;
        if (retryJoinTimer) {
            clearTimeout(retryJoinTimer);
            retryJoinTimer = null;
        }

        const charList = Array.isArray(data.Character) ? data.Character : [];
        console.log(`\n==========================================================`);
        console.log(`📍 Bot character IS NOW IN ROOM: "${data.Name}"!`);
        console.log(`👥 Players in room (${charList.length}): ${charList.map(c => c.Name).join(", ") || "Only bot"}`);
        console.log(`👑 Room Admins: ${Array.isArray(data.Admin) ? data.Admin.join(", ") : "None"}`);
        
        const activeMusic = data.Custom && data.Custom.MusicURL;
        console.log(`🎵 Current Room Music: ${activeMusic ? activeMusic : "None active"}`);
        console.log(`==========================================================\n`);

        setTimeout(() => {
            sendRoomEmote(
                socket,
                `* 🎵 [${botPlayer.Name || CONFIG.accountName} Music] Ready to play synced music in ${data.Name}! Type !help to see commands & radio genres 🎧`
            );
        }, 1500);

        charList.forEach(c => {
            if (c.MemberNumber && c.Name) {
                characterNames.set(c.MemberNumber, c.Name);
            }
            if (c.MemberNumber !== botPlayer.MemberNumber && !knownCharacters.has(c.MemberNumber)) {
                knownCharacters.add(c.MemberNumber);
            }
        });

        notifyWebUpdate();
        startVibeAnimation(socket);
    });

    // Greet new players when they join
    socket.on("ChatRoomSyncMemberJoin", (data) => {
        if (!data || !data.Character) return;
        const newChar = data.Character;
        if (newChar && newChar.MemberNumber && newChar.Name) {
            characterNames.set(newChar.MemberNumber, newChar.Name);
        }
        notifyWebUpdate();
        if (botPlayer && newChar.MemberNumber === botPlayer.MemberNumber) return;
        if (!knownCharacters.has(newChar.MemberNumber)) {
            knownCharacters.add(newChar.MemberNumber);
            setTimeout(() => {
                sendRoomEmote(
                    socket,
                    `* 👋 [${botPlayer.Name || CONFIG.accountName} Music] Welcome to the room, ${newChar.Name || 'friend'}! Feel free to request music using !play <song or youtube url> 🎶`
                );
            }, 2000);
        }
    });

    // When a player leaves the room
    socket.on("ChatRoomSyncMemberLeave", (data) => {
        notifyWebUpdate();
    });

    socket.on("ChatRoomUpdateResponse", (res) => {
        if (res === "Updated") {
            console.log("✅ [Server] Room administration update (Music/Settings) ACCEPTED by server!");
            notifyWebUpdate();
        } else {
            console.warn("⚠️ [Server] Room update response:", res);
        }
    });

    socket.on("ChatRoomSyncRoomProperties", (data) => {
        if (data && currentRoomData) {
            Object.assign(currentRoomData, data);
            console.log(`🔄 [Room Sync] Room properties synced to all players! MusicURL: "${data.Custom?.MusicURL || 'None'}"`);
            notifyWebUpdate();
        }
    });

    socket.on("ChatRoomMessage", (data) => {
        if (!data || !data.Content || typeof data.Content !== "string") return;

        const content = data.Content.trim();
        const sender = data.Sender;

        if (botPlayer && sender === botPlayer.MemberNumber) return;

        if (sender && !knownCharacters.has(sender)) {
            knownCharacters.add(sender);
        }

        // Native Bondage Club Friend Request received in room
        if (content === "ChatRoomFriendRequestAdd") {
            const isForMe = !data.Target || (botPlayer && data.Target === botPlayer.MemberNumber);
            if (isForMe) {
                console.log(`🤝 [Friend Request Received] Member #${sender} (${getCharacterName(sender)}) sent a friend request in room! Auto-accepting...`);
                acceptFriendRequest({
                    socket,
                    botPlayer,
                    isInRoom,
                    senderNumber: sender,
                    getCharacterName,
                    sendRoomEmote,
                    changeFaceExpression,
                });
                notifyWebUpdate();
                return;
            }
        }

        // Private Whisper (/w) to the bot - specifically handles Room Admin commands
        if (data.Type === "Whisper") {
            const isForMe = !data.Target || (botPlayer && data.Target === botPlayer.MemberNumber);
            if (isForMe) {
                console.log(`🔒 [Whisper from ${getCharacterName(sender)} (#${sender})]: "${content}"`);
                handleAdminWhisper(getContext(socket), content, sender);
                notifyWebUpdate();
                return;
            }
        }

        const isInternalAddon = /^(ECHO_|PCM_|CG_|BCEMsg|BCXMsg|KIKILINK|Liko)/.test(content);
        if (!isInternalAddon) {
            console.log(`💬 [${getCharacterName(sender)} (#${sender})]: "${content}"`);
        }

        const cmdText = extractCommand(content);
        if (!cmdText) return;

        handleRoomCommand(getContext(socket), cmdText, sender);
        notifyWebUpdate();
    });

    // Auto-rejoin timer if disconnected from room
    setInterval(() => {
        if (botPlayer && !isInRoom) {
            joinTargetRoom(socket);
        }
    }, 12000);

    socket.on("disconnect", (reason) => {
        isInRoom = false;
        currentRoomData = null;
        stopVibeAnimation();
        notifyWebUpdate();
        console.warn(`\n⚠️ Disconnected from game server (${reason}). Reconnecting...`);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Socket error:", err.message);
    });
}

function scheduleRetryJoin(socket, delayMs) {
    if (retryJoinTimer) clearTimeout(retryJoinTimer);
    retryJoinTimer = setTimeout(() => {
        if (!isInRoom) {
            joinTargetRoom(socket);
        }
    }, delayMs);
}

function joinTargetRoom(socket, roomName = CONFIG.targetRoom, space = (CONFIG.targetSpace || "")) {
    const packet = { Name: roomName };
    if (space) packet.Space = space;
    socket.emit("ChatRoomJoin", packet);
}

function switchRoom(socket, roomName, space = "") {
    if (!roomName) return;
    CONFIG.targetRoom = roomName;
    CONFIG.targetSpace = space || "";

    if (isInRoom) {
        if (currentRoomData && currentRoomData.Name && currentRoomData.Name.toLowerCase() === roomName.toLowerCase()) {
            console.log(`📍 Bot is already inside room "${roomName}".`);
            sendRoomEmote(
                socket,
                `* 🎵 [${botPlayer ? botPlayer.Name : CONFIG.accountName} Music] I am already here in ${roomName}! Ready for music requests 🎧`
            );
            return;
        }

        console.log(`🚪 Leaving current room "${currentRoomData ? currentRoomData.Name : 'Room'}"...`);
        socket.emit("ChatRoomLeave", "");
        isInRoom = false;
        currentRoomData = null;
        resetQueue();
        stopVibeAnimation();

        setTimeout(() => {
            console.log(`🚪 Joining new room: "${roomName}"...`);
            joinTargetRoom(socket, roomName, space);
        }, 600);
    } else {
        console.log(`🚪 Joining room: "${roomName}"...`);
        joinTargetRoom(socket, roomName, space);
    }
}

function startVibeAnimation(socket) {
    stopVibeAnimation();
    const eyes = ["Happy", "Wink", "Normal", "Closed"];
    const mouths = ["Smile", "Sing", "Normal"];

    vibeTimer = setInterval(() => {
        if (!isInRoom) return;
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

process.on("SIGINT", () => {
    console.log("\n🛑 Stopping bot & cleaning local storage...");
    stopWebServer();
    cleanLocalFiles();
    process.exit(0);
});

process.on("SIGTERM", () => {
    stopWebServer();
    cleanLocalFiles();
    process.exit(0);
});

startBot().catch((err) => console.error("Fatal Error:", err));
