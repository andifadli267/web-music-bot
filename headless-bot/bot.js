/**
 * Bondage Club (R132+) - Standalone Headless DJ Character Bot
 * 
 * An autonomous character bot that logs in with its own account,
 * joins the designated private room,
 * and broadcasts room music using native BC Room Customization (Custom.MusicURL).
 * Music is synchronized and audible to EVERYONE in the room without requiring addons!
 */

const { io } = require("socket.io-client");
const { CONFIG, CONVERT_DIR } = require("./config");
const { detectPythonRuntime, cleanLocalFiles } = require("./services/audio");
const {
    sendRoomEmote,
    sendWhisper,
    changeFaceExpression,
    stopVibeAnimation,
} = require("./services/vibe");
const {
    joinTargetRoom,
    scheduleRetryJoin,
    clearRetryJoin,
} = require("./services/room");
const { handleAccountBeep } = require("./handlers/beep");
const { registerRoomEvents } = require("./handlers/events");
const { getBotStatus, handleWebAction } = require("./handlers/webActions");
const { startWebServer, stopWebServer, notifyWebUpdate } = require("./web/server");
const { handleFollowQueryResult } = require("./services/follower");
const { setNotifyCallback: setChatNotify } = require("./services/chatLogger");

const botStartTime = Date.now();

// Shared Bot State
const state = {
    currentSocket: null,
    botPlayer: null,
    currentRoomData: null,
    isInRoom: false,
    isFollowing: false,
    followingTarget: null,
    followingTargetName: null,
    isPaused: false,
    knownCharacters: new Set(),
    characterNames: new Map(),
    getCharacterName(memberNumber) {
        if (!memberNumber) return "Someone";
        if (state.characterNames.has(memberNumber)) {
            return state.characterNames.get(memberNumber);
        }
        if (state.currentRoomData && Array.isArray(state.currentRoomData.Character)) {
            const found = state.currentRoomData.Character.find(c => c.MemberNumber === memberNumber);
            if (found && found.Name) {
                state.characterNames.set(memberNumber, found.Name);
                return found.Name;
            }
        }
        return `Member #${memberNumber}`;
    },
};

function getContext(socket) {
    return {
        socket,
        get botPlayer() { return state.botPlayer; },
        get currentRoomData() { return state.currentRoomData; },
        get isInRoom() { return state.isInRoom; },
        set isInRoom(val) { state.isInRoom = val; },
        set currentRoomData(val) { state.currentRoomData = val; },
        get isFollowing() { return state.isFollowing; },
        set isFollowing(val) { state.isFollowing = val; },
        get followingTarget() { return state.followingTarget; },
        set followingTarget(val) { state.followingTarget = val; },
        get followingTargetName() { return state.followingTargetName; },
        set followingTargetName(val) { state.followingTargetName = val; },
        get isPaused() { return state.isPaused; },
        set isPaused(val) { state.isPaused = val; },
        getCharacterName: state.getCharacterName,
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

    // Start Web Server & Dashboard
    startWebServer(
        CONFIG.webPort,
        () => getBotStatus(state, botStartTime),
        (data) => handleWebAction(getContext(state.currentSocket), state, data)
    );

    setChatNotify(notifyWebUpdate);

    // Establish Socket Connection to Game Server
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

    state.currentSocket = socket;
    const context = getContext(socket);

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
            state.botPlayer = res;
            if (!Array.isArray(state.botPlayer.FriendList)) {
                state.botPlayer.FriendList = [];
            }
            console.log(`🎉 Login Successful!`);
            console.log(`   Character Name : ${res.Name || res.AccountName}`);
            console.log(`   Member Number  : #${res.MemberNumber}`);
            console.log(`   Friends Count  : ${state.botPlayer.FriendList.length}`);
            console.log("----------------------------------------------------------");
            console.log(`🚪 Joining private room "${CONFIG.targetRoom}"...`);
            console.log(`💡 NOTE: Ensure member #${res.MemberNumber} (${res.Name || res.AccountName}) is on the Whitelist/Admin list of the room!`);
            console.log("----------------------------------------------------------");
            
            joinTargetRoom(socket);
        }
    });

    socket.on("ChatRoomSearchResponse", (data) => {
        if (state.isInRoom) return;

        if (data === "CannotFindRoom" || data === "RoomLocked") {
            process.stdout.write(`\r⏳ Waiting to access room "${CONFIG.targetRoom}" (Response: ${data}). Retrying... `);
            scheduleRetryJoin(socket, 5000, () => state.isInRoom);
        } else if (data === "RoomFull") {
            console.warn(`\n⚠️ Room "${CONFIG.targetRoom}" is currently full. Retrying in 8s...`);
            scheduleRetryJoin(socket, 8000, () => state.isInRoom);
        } else if (data === "JoinedRoom") {
            console.log(`\n✅ Server response: Successfully joined room!`);
        } else {
            console.log(`\nℹ️ ChatRoomSearchResponse:`, data);
        }
    });

    // In-game Beep & Invite listener
    socket.on("AccountBeep", (data) => {
        handleAccountBeep(context, data);
    });

    // Account Query listener (tracks friends and mistress room locations for follow mode)
    socket.on("AccountQueryResult", (data) => {
        handleFollowQueryResult(context, state, data);
    });

    // Register all in-room events
    registerRoomEvents(socket, context, state);

    // Auto-rejoin timer if bot gets disconnected or placed out of room
    setInterval(() => {
        if (state.botPlayer && !state.isInRoom) {
            if (state.isFollowing && state.followingTarget) {
                try {
                    socket.emit("AccountQuery", { Query: "OnlineFriends" });
                } catch (e) {}
            } else {
                joinTargetRoom(socket);
            }
        }
    }, 12000);

    socket.on("disconnect", (reason) => {
        state.isInRoom = false;
        state.currentRoomData = null;
        stopVibeAnimation();
        clearRetryJoin();
        notifyWebUpdate();
        console.warn(`\n⚠️ Disconnected from game server (${reason}). Reconnecting...`);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Socket error:", err.message);
    });
}

// Graceful Shutdown
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
