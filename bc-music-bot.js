// ==UserScript==
// @name         Bondage Club - Music Bot & Character DJ
// @namespace    https://github.com/BondageProjects/Bondage-College
// @version      1.1.1
// @description  Interactive In-Game Music DJ Character Bot, 24/7 Radio & YouTube Audio Player for Bondage Club (R132+) & BC-Desktop
// @author       Antigravity
// @match        https://*.bondageprojects.elementfx.com/R*/*
// @match        https://*.bondage-europe.com/R*/*
// @match        https://*.bondageeurope.com/R*/*
// @match        https://*.bondageprojects.com/R*/*
// @match        https://*.bondage-asia.com/club/R*
// @match        https://*.bondage-asia.com/club/R*/*
// @match        http://localhost:*/*
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    if (window !== window.top) return;
    if (window.__BC_MUSIC_BOT_LOADED__) return;
    window.__BC_MUSIC_BOT_LOADED__ = true;

    console.log("[BC-MusicBot] Initializing In-Game Music DJ Character Bot...");

    // ==========================================
    // 1. Curated 24/7 Radio Stations
    // ==========================================
    const RADIO_STATIONS = [
        {
            id: "lofi",
            name: "Lo-Fi Chill Beats",
            genre: "Chill / Study",
            icon: "☕",
            url: "https://streams.ilovemusic.de/iloveradio17.mp3",
        },
        {
            id: "synth",
            name: "Nightride FM (Synthwave)",
            genre: "Synthwave / Cyberpunk",
            icon: "🕹️",
            url: "https://stream.nightride.fm/synthwave.mp3",
        },
        {
            id: "chillsynth",
            name: "Chillsynth FM",
            genre: "Ambient / Retrowave",
            icon: "🌌",
            url: "https://stream.nightride.fm/chillsynth.mp3",
        },
        {
            id: "anime",
            name: "LISTEN.moe (Anime / J-Pop)",
            genre: "Anime / J-Pop",
            icon: "🌸",
            url: "https://listen.moe/stream",
        },
        {
            id: "kpop",
            name: "LISTEN.moe (K-Pop)",
            genre: "K-Pop",
            icon: "✨",
            url: "https://listen.moe/kpop/stream",
        },
        {
            id: "jazz",
            name: "Swiss Jazz & Lounge Cafe",
            genre: "Jazz / Lounge",
            icon: "🎷",
            url: "https://jazz-wr01.ice.infomaniak.ch/jazz-wr01-128.mp3",
        },
        {
            id: "pop",
            name: "I Love Radio - Top Hits",
            genre: "Pop / Hits",
            icon: "🎧",
            url: "https://streams.ilovemusic.de/iloveradio1.mp3",
        },
        {
            id: "classical",
            name: "Radio Swiss Classic",
            genre: "Classical / Relaxing Piano",
            icon: "🎻",
            url: "https://stream.srg-ssr.ch/m/rsc_de/mp3_128",
        },
    ];

    // ==========================================
    // 2. Configuration & State
    // ==========================================
    const DEFAULT_CONFIG = {
        volume: 60,
        permission: "everyone", // "owner", "admin", "everyone"
        announceInChat: true,
        currentStationId: "lofi",
        isMinimized: false,
        posTop: 80,
        posLeft: 20,
        // Character Bot Persona Settings
        characterBotEnabled: true,  // Runs as in-game character DJ
        botName: "Nava Music",
        autoVibeAnimation: true,    // Character dances / changes expressions to beat
        autoWelcomeUsers: true,     // Welcomes new players entering room
    };

    function getBotName() {
        const charName = typeof Player !== "undefined" && Player && Player.Name ? Player.Name : "Nava";
        return `${charName} Music`;
    }

    let config = Object.assign({}, DEFAULT_CONFIG);
    try {
        const saved = localStorage.getItem("BC_MusicBot_Config");
        if (saved) {
            config = Object.assign(config, JSON.parse(saved));
        }
    } catch (e) {
        console.warn("[BC-MusicBot] Failed to load saved config:", e);
    }

    function saveConfig() {
        try {
            localStorage.setItem("BC_MusicBot_Config", JSON.stringify(config));
        } catch (e) {}
    }

    let audioPlayer = null;
    let ytPlayer = null;
    let ytPlayerReady = false;
    let currentMode = "radio"; // "radio", "custom", "youtube"
    let currentTitle = "Tidak ada lagu diputar";
    let isPlaying = false;
    let vibeInterval = null;
    let knownRoomMembers = new Set();

    // ==========================================
    // 3. Audio Engine & YouTube API Initialization
    // ==========================================
    function initAudio() {
        if (!audioPlayer) {
            audioPlayer = new Audio();
            audioPlayer.volume = config.volume / 100;
            audioPlayer.preload = "none";

            audioPlayer.addEventListener("play", () => {
                isPlaying = true;
                startCharacterVibing();
                updateUI();
            });
            audioPlayer.addEventListener("pause", () => {
                isPlaying = false;
                stopCharacterVibing();
                updateUI();
            });
            audioPlayer.addEventListener("error", (e) => {
                console.error("[BC-MusicBot] Audio Player Error:", e);
                isPlaying = false;
                stopCharacterVibing();
                currentTitle = "Error memutar audio stream";
                updateUI();
            });
        }
    }

    function loadYouTubeAPI() {
        if (window.YT && window.YT.Player) {
            setupYouTubePlayer();
            return;
        }
        if (!document.getElementById("yt-iframe-api")) {
            const tag = document.createElement("script");
            tag.id = "yt-iframe-api";
            tag.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(tag);
        }
        window.onYouTubeIframeAPIReady = function () {
            setupYouTubePlayer();
        };
    }

    function setupYouTubePlayer() {
        if (ytPlayer) return;
        const ytDiv = document.createElement("div");
        ytDiv.id = "bc-musicbot-yt-player";
        ytDiv.style.cssText = "position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0.01;pointer-events:none;";
        document.body.appendChild(ytDiv);

        try {
            ytPlayer = new window.YT.Player("bc-musicbot-yt-player", {
                height: "1",
                width: "1",
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => {
                        ytPlayerReady = true;
                        ytPlayer.setVolume(config.volume);
                    },
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            isPlaying = true;
                            startCharacterVibing();
                            if (currentMode === "youtube" && ytPlayer.getVideoData) {
                                const data = ytPlayer.getVideoData();
                                if (data && data.title) {
                                    currentTitle = data.title;
                                }
                            }
                            updateUI();
                        } else if (
                            event.data === window.YT.PlayerState.PAUSED ||
                            event.data === window.YT.PlayerState.ENDED
                        ) {
                            isPlaying = false;
                            stopCharacterVibing();
                            updateUI();
                        }
                    },
                },
            });
        } catch (err) {
            console.warn("[BC-MusicBot] YouTube player init error:", err);
        }
    }

    // ==========================================
    // 4. Character Expression & Animation Engine
    // ==========================================
    function setCharacterFace(group, expression, timer = 5) {
        if (!config.characterBotEnabled) return;
        try {
            if (typeof Player !== "undefined" && Player && typeof CharacterSetFacialExpression === "function") {
                CharacterSetFacialExpression(Player, group, expression, timer);
                if (typeof CharacterRefresh === "function") {
                    CharacterRefresh(Player);
                }
            }
        } catch (err) {
            console.warn("[BC-MusicBot] Expression error:", err);
        }
    }

    function triggerDJReaction(type) {
        if (!config.characterBotEnabled) return;
        if (type === "happy" || type === "play") {
            setCharacterFace("Eyes", "Happy", 6);
            setCharacterFace("Mouth", "Smile", 6);
        } else if (type === "wink") {
            setCharacterFace("Eyes", "Wink", 4);
            setCharacterFace("Mouth", "Smile", 4);
        } else if (type === "chill") {
            setCharacterFace("Eyes", "Daydream", 8);
            setCharacterFace("Mouth", "HalfSmile", 8);
        } else if (type === "sing") {
            setCharacterFace("Eyes", "Happy", 5);
            setCharacterFace("Mouth", "Sing", 5);
            setCharacterFace("Emoticon", "Music", 5);
        } else if (type === "dance") {
            setCharacterFace("Eyes", "Happy", 6);
            setCharacterFace("Emoticon", "Music", 6);
        }
    }

    function startCharacterVibing() {
        if (!config.autoVibeAnimation || vibeInterval) return;

        const vibeEmotes = [
            { eyes: "Happy", mouth: "Smile", emo: "Music" },
            { eyes: "Daydream", mouth: "HalfSmile", emo: null },
            { eyes: "Wink", mouth: "Smile", emo: "Music" },
            { eyes: "ShylyHappy", mouth: "Smile", emo: null },
        ];
        let idx = 0;

        vibeInterval = setInterval(() => {
            if (!isPlaying || !config.autoVibeAnimation || !config.characterBotEnabled) {
                stopCharacterVibing();
                return;
            }
            const cur = vibeEmotes[idx % vibeEmotes.length];
            idx++;
            setCharacterFace("Eyes", cur.eyes, 4);
            setCharacterFace("Mouth", cur.mouth, 4);
            if (cur.emo) setCharacterFace("Emoticon", cur.emo, 4);
        }, 8000);
    }

    function stopCharacterVibing() {
        if (vibeInterval) {
            clearInterval(vibeInterval);
            vibeInterval = null;
        }
    }

    // ==========================================
    // 5. Playback Controls
    // ==========================================
    function playRadio(stationId, senderName = null) {
        initAudio();
        const station = RADIO_STATIONS.find((s) => s.id === stationId.toLowerCase()) || RADIO_STATIONS[0];
        config.currentStationId = station.id;
        saveConfig();

        currentMode = "radio";
        currentTitle = `${station.icon} ${station.name}`;

        if (ytPlayer && ytPlayerReady && typeof ytPlayer.stopVideo === "function") {
            try { ytPlayer.stopVideo(); } catch (e) {}
        }

        audioPlayer.src = station.url;
        audioPlayer.load();
        audioPlayer.play().catch((err) => {
            console.warn("[BC-MusicBot] Autoplay prevented or stream error:", err);
        });

        triggerDJReaction("play");

        const requester = senderName ? ` atas permintaan ${senderName}` : "";
        const notifyText = `* 🎵 [${getBotName()}] Memutar stasiun ${station.icon} ${station.name} (${station.genre})${requester}! 🎧`;
        announceChat(notifyText);
        updateUI();
    }

    function playCustomUrl(url, senderName = null) {
        initAudio();
        if (!url || typeof url !== "string") return;
        url = url.replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();

        const ytMatch = url.match(/(?:youtu\.be\/|(?:m\.|music\.|www\.)?youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
        if (ytMatch) {
            playYouTube(ytMatch[1], senderName);
            return;
        }

        // Direct YouTube video ID (11 chars)
        if (/^[\w-]{11}$/.test(url)) {
            playYouTube(url, senderName);
            return;
        }

        currentMode = "custom";
        currentTitle = `🔗 Stream: ${url.length > 35 ? url.substring(0, 32) + "..." : url}`;

        if (ytPlayer && ytPlayerReady && typeof ytPlayer.stopVideo === "function") {
            try { ytPlayer.stopVideo(); } catch (e) {}
        }

        audioPlayer.src = url;
        audioPlayer.load();
        audioPlayer.play().catch((err) => {
            console.warn("[BC-MusicBot] Error playing custom URL:", err);
        });

        triggerDJReaction("play");
        const requester = senderName ? ` [req: ${senderName}]` : "";
        announceChat(`* 🎵 [${getBotName()}] Memutar audio stream dari ${url}${requester} 🎧`);
        updateUI();
    }

    function playYouTube(videoId, senderName = null) {
        currentMode = "youtube";
        currentTitle = `🎥 YouTube Audio [ID: ${videoId}]`;

        if (audioPlayer) {
            audioPlayer.pause();
        }

        if (ytPlayer && ytPlayerReady) {
            try {
                ytPlayer.loadVideoById(videoId);
                ytPlayer.setVolume(config.volume);
                ytPlayer.playVideo();
            } catch (e) {
                console.error("[BC-MusicBot] Error playing YouTube video:", e);
            }
        }

        triggerDJReaction("play");
        const requester = senderName ? ` [req: ${senderName}]` : "";
        announceChat(`* 🎵 [${getBotName()}] Memutar musik YouTube: https://youtu.be/${videoId}${requester} 🎧`);
        updateUI();
    }

    function pauseMusic() {
        if (currentMode === "youtube" && ytPlayer && ytPlayerReady) {
            try { ytPlayer.pauseVideo(); } catch (e) {}
        } else if (audioPlayer) {
            audioPlayer.pause();
        }
        isPlaying = false;
        stopCharacterVibing();
        announceChat(`* ⏸️ [${getBotName()}] Musik dijeda (Paused).`);
        updateUI();
    }

    function resumeMusic() {
        if (currentMode === "youtube" && ytPlayer && ytPlayerReady) {
            try { ytPlayer.playVideo(); } catch (e) {}
        } else if (audioPlayer) {
            audioPlayer.play().catch((e) => {});
        }
        isPlaying = true;
        startCharacterVibing();
        triggerDJReaction("play");
        announceChat(`* ▶️ [${getBotName()}] Musik dilanjutkan (Resumed).`);
        updateUI();
    }

    function stopMusic() {
        if (currentMode === "youtube" && ytPlayer && ytPlayerReady) {
            try { ytPlayer.stopVideo(); } catch (e) {}
        }
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = "";
        }
        isPlaying = false;
        stopCharacterVibing();
        currentTitle = "Tidak ada musik diputar";
        announceChat(`* ⏹️ [${getBotName()}] Musik dihentikan.`);
        updateUI();
    }

    function setVolume(vol) {
        const val = Math.max(0, Math.min(100, parseInt(vol, 10) || 0));
        config.volume = val;
        saveConfig();

        if (audioPlayer) {
            audioPlayer.volume = val / 100;
        }
        if (ytPlayer && ytPlayerReady) {
            try { ytPlayer.setVolume(val); } catch (e) {}
        }

        updateUI();
    }

    // ==========================================
    // 6. In-Game Chat Handling & Character Persona
    // ==========================================
    function announceChat(text) {
        if (!config.announceInChat) return;
        try {
            if (
                typeof ServerSend === "function" &&
                typeof CurrentScreen !== "undefined" &&
                CurrentScreen === "ChatRoom"
            ) {
                // Character speaks or emotes in the room
                ServerSend("ChatRoomChat", { Content: text, Type: "Emote" });
            }
        } catch (e) {
            console.warn("[BC-MusicBot] Announce error:", e);
        }
    }

    function hasPermission(senderMemberNumber) {
        if (typeof Player === "undefined" || !Player) return true;
        const myNumber = Player.MemberNumber;
        if (senderMemberNumber === myNumber) return true;

        if (config.permission === "owner") {
            return false;
        }

        if (config.permission === "admin") {
            if (
                typeof ChatRoomData !== "undefined" &&
                ChatRoomData &&
                Array.isArray(ChatRoomData.Admin)
            ) {
                return ChatRoomData.Admin.includes(senderMemberNumber);
            }
            return false;
        }

        return true; // "everyone"
    }

    function extractCommand(msg) {
        if (!msg || typeof msg !== "string") return null;
        let text = msg.trim();
        if (!text) return null;

        // If starts with command prefix directly
        if (text.startsWith("!") || text.startsWith("/music")) {
            return text;
        }

        // Repeatedly unwrap outer matching brackets: ( ... ), [ ... ], { ... }
        // Handles nested parentheses like: ((!play url)) or (((!radio pop)))
        let prev = "";
        while (text !== prev) {
            prev = text;
            if (
                (text.startsWith("(") && text.endsWith(")")) ||
                (text.startsWith("[") && text.endsWith("]")) ||
                (text.startsWith("{") && text.endsWith("}"))
            ) {
                text = text.slice(1, -1).trim();
            }
        }

        if (text.startsWith("!") || text.startsWith("/music")) {
            return text;
        }

        // Handles unclosed opening brackets e.g. "(!play url" or "((!play url"
        const openOnlyMatch = text.match(/^[\(\[\{\s]+((?:!|\/music)\b.+)$/i);
        if (openOnlyMatch) {
            return openOnlyMatch[1].trim();
        }

        // Handles bracketed command anywhere within message: e.g. "DJ play this (!play url) please"
        const inlineMatch = text.match(/[\(\[\{]+(\s*(?:!|\/music)\b[^\)\]\}]+)[\)\]\}]*/i);
        if (inlineMatch) {
            return inlineMatch[1].trim();
        }

        return null;
    }

    function handleCommand(msg, senderMemberNumber, senderName) {
        if (!msg || typeof msg !== "string") return;
        const text = extractCommand(msg);
        if (!text) return;

        const parts = text.split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (cmd === "!help" || cmd === "!music") {
            triggerDJReaction("wink");
            const helpMsg = `* 🎵 [${getBotName()}]: !radio <genre> | !play <url> | !yt <id> | !pause | !resume | !stop | !volume <0-100> | !np | Stasiun: lofi, synth, chillsynth, anime, kpop, jazz, pop, classical (Bisa diketik dalam kurung: (!play ...))`;
            announceChat(helpMsg);
            return;
        }

        if (!hasPermission(senderMemberNumber)) {
            announceChat(`* ⚠️ [${getBotName()}] Maaf ${senderName}, hanya Host/Admin yang diizinkan mengontrol musik.`);
            return;
        }

        if (cmd === "!radio") {
            let stationKey = parts[1] ? parts[1].toLowerCase() : "lofi";
            stationKey = stationKey.replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();
            playRadio(stationKey, senderName);
        } else if (cmd === "!play") {
            let target = parts.slice(1).join(" ").trim();
            target = target.replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();
            if (!target) {
                resumeMusic();
            } else {
                playCustomUrl(target, senderName);
            }
        } else if (cmd === "!yt" || cmd === "!youtube") {
            let target = parts[1];
            if (target) {
                target = target.replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();
                const ytMatch = target.match(/(?:youtu\.be\/|(?:m\.|music\.|www\.)?youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
                const videoId = ytMatch ? ytMatch[1] : target;
                playYouTube(videoId, senderName);
            }
        } else if (cmd === "!pause") {
            pauseMusic();
        } else if (cmd === "!resume") {
            resumeMusic();
        } else if (cmd === "!stop") {
            stopMusic();
        } else if (cmd === "!volume" || cmd === "!vol") {
            let vol = parts[1];
            if (vol !== undefined) {
                vol = String(vol).replace(/^[\(<\[\{"']+|[\)>\]\}"']+$/g, "").trim();
                setVolume(vol);
                announceChat(`* 🔊 [${getBotName()}] Volume musik diatur ke: ${config.volume}%`);
            }
        } else if (cmd === "!np" || cmd === "!nowplaying") {
            triggerDJReaction("happy");
            announceChat(`* 🎵 [${getBotName()}] Sedang memutar: ${currentTitle} [Volume: ${config.volume}%] 🎧`);
        } else if (cmd === "!friend" || cmd === "!addfriend" || cmd === "!teman") {
            if (typeof Player !== "undefined" && Player && Array.isArray(Player.FriendList)) {
                if (!Player.FriendList.includes(senderMemberNumber)) {
                    if (typeof ChatRoomListUpdate === "function") {
                        ChatRoomListUpdate(Player.FriendList, true, senderMemberNumber, "FriendRequest");
                    }
                }
                triggerDJReaction("happy");
                announceChat(`* 🤝 [${getBotName()}] Menerima pertemanan dari ${senderName} (#${senderMemberNumber})! Kita sekarang berteman ✨`);
            }
        }
    }

    // Check for players entering room to auto-welcome
    function checkRoomMembers() {
        if (!config.characterBotEnabled || !config.autoWelcomeUsers) return;
        if (typeof CurrentScreen === "undefined" || CurrentScreen !== "ChatRoom") {
            knownRoomMembers.clear();
            return;
        }
        if (typeof ChatRoomCharacter === "undefined" || !Array.isArray(ChatRoomCharacter)) return;

        const myNum = typeof Player !== "undefined" && Player ? Player.MemberNumber : null;
        ChatRoomCharacter.forEach((char) => {
            if (char && char.MemberNumber && char.MemberNumber !== myNum) {
                if (!knownRoomMembers.has(char.MemberNumber)) {
                    knownRoomMembers.add(char.MemberNumber);
                    // Welcoming emote after brief pause
                    setTimeout(() => {
                        if (knownRoomMembers.has(char.MemberNumber) && CurrentScreen === "ChatRoom") {
                            triggerDJReaction("wink");
                            announceChat(`* 🎵 [${getBotName()}] Halo ${char.Name || "teman"}! Selamat datang di room! Ketik !help untuk request lagu atau stasiun radio 🎧`);
                        }
                    }, 3000);
                }
            }
        });

        // Cleanup left members
        const currentMemberNums = new Set(ChatRoomCharacter.map((c) => c.MemberNumber));
        knownRoomMembers.forEach((num) => {
            if (!currentMemberNums.has(num)) knownRoomMembers.delete(num);
        });
    }

    // Hook into Bondage Club message receivers
    function installHooks() {
        if (typeof window.ChatRoomMessage === "function" && !window.ChatRoomMessage._musicBotHooked) {
            const originalChatRoomMessage = window.ChatRoomMessage;
            window.ChatRoomMessage = function (data) {
                try {
                    if (data && data.Content && typeof data.Content === "string") {
                        const sender = data.Sender;
                        let senderName = "Player";
                        if (typeof ChatRoomCharacter !== "undefined" && Array.isArray(ChatRoomCharacter)) {
                            const char = ChatRoomCharacter.find((c) => c.MemberNumber === sender);
                            if (char && char.Name) senderName = char.Name;
                        }

                        // Auto-accept in-room friend request
                        if (data.Content === "ChatRoomFriendRequestAdd") {
                            const myNum = typeof Player !== "undefined" && Player ? Player.MemberNumber : 0;
                            if (!data.Target || data.Target === myNum) {
                                if (typeof Player !== "undefined" && Player && Array.isArray(Player.FriendList)) {
                                    if (!Player.FriendList.includes(sender)) {
                                        if (typeof ChatRoomListUpdate === "function") {
                                            ChatRoomListUpdate(Player.FriendList, true, sender, "FriendRequest");
                                        }
                                        triggerDJReaction("happy");
                                        announceChat(`* 🤝 [${getBotName()}] Menerima pertemanan dari ${senderName} (#${sender})! Kita sekarang berteman ✨`);
                                        console.log(`[BC-MusicBot] Auto-accepted friend request from #${sender}`);
                                    }
                                }
                            }
                        }

                        handleCommand(data.Content, sender, senderName);
                    }
                } catch (err) {
                    console.error("[BC-MusicBot] ChatRoomMessage hook error:", err);
                }
                return originalChatRoomMessage.apply(this, arguments);
            };
            window.ChatRoomMessage._musicBotHooked = true;
            console.log("[BC-MusicBot] Hooked ChatRoomMessage successfully.");
        }

        if (
            typeof window.ServerSocket !== "undefined" &&
            window.ServerSocket &&
            typeof window.ServerSocket.on === "function" &&
            !window._musicBotSocketHooked
        ) {
            window.ServerSocket.on("ChatRoomMessage", function (data) {
                if (data && data.Content) {
                    handleCommand(data.Content, data.Sender, "Player");
                }
            });
            window._musicBotSocketHooked = true;
            console.log("[BC-MusicBot] Hooked ServerSocket successfully.");
        }

        const chatInput = document.getElementById("InputChat");
        if (chatInput && !chatInput._musicBotInputHooked) {
            chatInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    const val = chatInput.value.trim();
                    if (extractCommand(val)) {
                        const myNum = typeof Player !== "undefined" && Player ? Player.MemberNumber : 0;
                        handleCommand(val, myNum, "You");
                    }
                }
            });
            chatInput._musicBotInputHooked = true;
        }
    }

    // ==========================================
    // 7. Modern Floating Overlay UI
    // ==========================================
    let uiContainer = null;
    let titleEl = null;
    let playBtn = null;
    let volumeSlider = null;
    let volLabel = null;
    let stationSelect = null;

    function createUI() {
        if (document.getElementById("bc-musicbot-overlay")) return;

        uiContainer = document.createElement("div");
        uiContainer.id = "bc-musicbot-overlay";
        Object.assign(uiContainer.style, {
            position: "fixed",
            top: `${config.posTop}px`,
            left: `${config.posLeft}px`,
            zIndex: "2147483645",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "12px",
            color: "#ffffff",
            userSelect: "none",
        });

        const panel = document.createElement("div");
        panel.id = "bc-musicbot-panel";
        Object.assign(panel.style, {
            width: "290px",
            background: "linear-gradient(135deg, rgba(24, 18, 40, 0.96), rgba(42, 28, 68, 0.96))",
            backdropFilter: "blur(14px)",
            borderRadius: "14px",
            padding: "12px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.2)",
            border: "1px solid rgba(162, 155, 254, 0.3)",
            display: config.isMinimized ? "none" : "flex",
            flexDirection: "column",
            gap: "9px",
            transition: "all 0.2s ease",
        });

        // Minimized floating disc button
        const miniBtn = document.createElement("div");
        miniBtn.id = "bc-musicbot-minibtn";
        miniBtn.innerHTML = "🎧";
        Object.assign(miniBtn.style, {
            width: "46px",
            height: "46px",
            background: "linear-gradient(135deg, #a29bfe, #6c5ce7)",
            borderRadius: "50%",
            display: config.isMinimized ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(108, 92, 231, 0.5)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            transition: "transform 0.2s ease",
        });
        miniBtn.onmouseenter = () => (miniBtn.style.transform = "scale(1.1)");
        miniBtn.onmouseleave = () => (miniBtn.style.transform = "scale(1.0)");
        miniBtn.onclick = () => {
            config.isMinimized = false;
            saveConfig();
            panel.style.display = "flex";
            miniBtn.style.display = "none";
        };

        // Header (Draggable)
        const header = document.createElement("div");
        Object.assign(header.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "move",
            paddingBottom: "6px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        });

        const headerTitle = document.createElement("div");
        headerTitle.innerHTML = `<span style="color:#a29bfe;font-weight:bold;">🎧 BC Character DJ</span> <span style="font-size:10px;opacity:0.6;">v1.1</span>`;

        const headerActions = document.createElement("div");
        headerActions.style.display = "flex";
        headerActions.style.gap = "6px";

        const minIcon = document.createElement("button");
        minIcon.innerHTML = "—";
        minIcon.title = "Minimize";
        styleHeaderButton(minIcon);
        minIcon.onclick = () => {
            config.isMinimized = true;
            saveConfig();
            panel.style.display = "none";
            miniBtn.style.display = "flex";
        };

        headerActions.appendChild(minIcon);
        header.appendChild(headerTitle);
        header.appendChild(headerActions);

        // Track / Station Info
        titleEl = document.createElement("div");
        titleEl.id = "bc-musicbot-title";
        titleEl.textContent = currentTitle;
        Object.assign(titleEl.style, {
            background: "rgba(0, 0, 0, 0.35)",
            padding: "8px 10px",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: "500",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderLeft: "3px solid #a29bfe",
        });

        // Station Picker Dropdown
        stationSelect = document.createElement("select");
        Object.assign(stationSelect.style, {
            background: "#251d38",
            color: "#ffffff",
            border: "1px solid #4834d4",
            borderRadius: "6px",
            padding: "6px 8px",
            fontSize: "11px",
            outline: "none",
            cursor: "pointer",
        });

        RADIO_STATIONS.forEach((st) => {
            const opt = document.createElement("option");
            opt.value = st.id;
            opt.textContent = `${st.icon} ${st.name}`;
            if (st.id === config.currentStationId) opt.selected = true;
            stationSelect.appendChild(opt);
        });

        stationSelect.onchange = (e) => {
            playRadio(e.target.value);
        };

        // Playback Controls Row
        const controlsRow = document.createElement("div");
        Object.assign(controlsRow.style, {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
        });

        playBtn = document.createElement("button");
        playBtn.innerHTML = isPlaying ? "⏸️ Pause" : "▶️ Play";
        styleActionButton(playBtn, "#6c5ce7");
        playBtn.onclick = () => {
            if (isPlaying) pauseMusic();
            else {
                if (currentMode === "radio") playRadio(config.currentStationId);
                else resumeMusic();
            }
        };

        const stopBtn = document.createElement("button");
        stopBtn.innerHTML = "⏹️ Stop";
        styleActionButton(stopBtn, "#4834d4");
        stopBtn.onclick = () => stopMusic();

        controlsRow.appendChild(playBtn);
        controlsRow.appendChild(stopBtn);

        // Volume Row
        const volumeRow = document.createElement("div");
        Object.assign(volumeRow.style, {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(0, 0, 0, 0.2)",
            padding: "6px 8px",
            borderRadius: "6px",
        });

        const volIcon = document.createElement("span");
        volIcon.textContent = "🔊";

        volumeSlider = document.createElement("input");
        volumeSlider.type = "range";
        volumeSlider.min = "0";
        volumeSlider.max = "100";
        volumeSlider.value = config.volume;
        Object.assign(volumeSlider.style, {
            flex: "1",
            cursor: "pointer",
            accentColor: "#a29bfe",
        });
        volumeSlider.oninput = (e) => {
            setVolume(e.target.value);
            volLabel.textContent = `${e.target.value}%`;
        };

        volLabel = document.createElement("span");
        volLabel.textContent = `${config.volume}%`;
        volLabel.style.width = "32px";
        volLabel.style.textAlign = "right";

        volumeRow.appendChild(volIcon);
        volumeRow.appendChild(volumeSlider);
        volumeRow.appendChild(volLabel);

        // URL / YouTube Input Box
        const inputRow = document.createElement("div");
        Object.assign(inputRow.style, {
            display: "flex",
            gap: "6px",
        });

        const customUrlInput = document.createElement("input");
        customUrlInput.type = "text";
        customUrlInput.placeholder = "URL Audio / YouTube link...";
        Object.assign(customUrlInput.style, {
            flex: "1",
            background: "#1e162f",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "11px",
            outline: "none",
        });

        const loadBtn = document.createElement("button");
        loadBtn.textContent = "Play";
        styleActionButton(loadBtn, "#00b894");
        loadBtn.style.padding = "4px 10px";
        loadBtn.onclick = () => {
            const url = customUrlInput.value.trim();
            if (url) {
                playCustomUrl(url);
                customUrlInput.value = "";
            }
        };

        inputRow.appendChild(customUrlInput);
        inputRow.appendChild(loadBtn);

        // Character Bot Persona Section (NEW)
        const botSection = document.createElement("div");
        Object.assign(botSection.style, {
            background: "rgba(162, 155, 254, 0.08)",
            border: "1px solid rgba(162, 155, 254, 0.2)",
            borderRadius: "8px",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "11px",
        });

        const botTitle = document.createElement("div");
        botTitle.innerHTML = `<span style="font-weight:bold;color:#fd79a8;">🤖 Mode Karakter DJ Bot</span>`;
        botSection.appendChild(botTitle);

        // Toggle Bot Mode Checkbox
        const botModeLabel = document.createElement("label");
        botModeLabel.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer;";
        const botModeChk = document.createElement("input");
        botModeChk.type = "checkbox";
        botModeChk.checked = config.characterBotEnabled;
        botModeChk.onchange = (e) => {
            config.characterBotEnabled = e.target.checked;
            saveConfig();
            if (config.characterBotEnabled && isPlaying) startCharacterVibing();
            else stopCharacterVibing();
        };
        botModeLabel.appendChild(botModeChk);
        botModeLabel.appendChild(document.createTextNode("Aktifkan Persona Karakter DJ"));
        botSection.appendChild(botModeLabel);

        // Sub options
        const subOptions = document.createElement("div");
        subOptions.style.cssText = "display:flex;justify-content:space-between;gap:8px;font-size:10px;opacity:0.9;padding-left:18px;";

        const vibeLabel = document.createElement("label");
        vibeLabel.style.cssText = "display:flex;align-items:center;gap:4px;cursor:pointer;";
        const vibeChk = document.createElement("input");
        vibeChk.type = "checkbox";
        vibeChk.checked = config.autoVibeAnimation;
        vibeChk.onchange = (e) => {
            config.autoVibeAnimation = e.target.checked;
            saveConfig();
            if (config.autoVibeAnimation && isPlaying) startCharacterVibing();
            else stopCharacterVibing();
        };
        vibeLabel.appendChild(vibeChk);
        vibeLabel.appendChild(document.createTextNode("Animasi Vibe"));

        const welcomeLabel = document.createElement("label");
        welcomeLabel.style.cssText = "display:flex;align-items:center;gap:4px;cursor:pointer;";
        const welcomeChk = document.createElement("input");
        welcomeChk.type = "checkbox";
        welcomeChk.checked = config.autoWelcomeUsers;
        welcomeChk.onchange = (e) => {
            config.autoWelcomeUsers = e.target.checked;
            saveConfig();
        };
        welcomeLabel.appendChild(welcomeChk);
        welcomeLabel.appendChild(document.createTextNode("Sapa Pengunjung"));

        subOptions.appendChild(vibeLabel);
        subOptions.appendChild(welcomeLabel);
        botSection.appendChild(subOptions);

        // Action Buttons Row (Dance & Sing)
        const actionBtnRow = document.createElement("div");
        actionBtnRow.style.cssText = "display:flex;gap:6px;padding-top:4px;";

        const danceBtn = document.createElement("button");
        danceBtn.textContent = "💃 Menari";
        styleActionButton(danceBtn, "#e84393");
        danceBtn.onclick = () => {
            triggerDJReaction("dance");
            const myName = typeof Player !== "undefined" && Player ? Player.Name : "DJ";
            announceChat(`* 💃 ${myName} menari dan berdisko mengikuti alunan musik! 🎶✨`);
        };

        const singBtn = document.createElement("button");
        singBtn.textContent = "🎤 Bernyanyi";
        styleActionButton(singBtn, "#0984e3");
        singBtn.onclick = () => {
            triggerDJReaction("sing");
            const myName = typeof Player !== "undefined" && Player ? Player.Name : "DJ";
            announceChat(`* 🎤 ${myName} bernyanyi: "La la la~ 🎶 feel the beat!" 🎵`);
        };

        actionBtnRow.appendChild(danceBtn);
        actionBtnRow.appendChild(singBtn);
        botSection.appendChild(actionBtnRow);

        // Permissions Row
        const settingsRow = document.createElement("div");
        Object.assign(settingsRow.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "10px",
            opacity: "0.85",
            paddingTop: "4px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        });

        const announceLabel = document.createElement("label");
        announceLabel.style.cssText = "cursor:pointer;display:flex;align-items:center;gap:4px;";
        const announceChk = document.createElement("input");
        announceChk.type = "checkbox";
        announceChk.checked = config.announceInChat;
        announceChk.onchange = (e) => {
            config.announceInChat = e.target.checked;
            saveConfig();
        };
        announceLabel.appendChild(announceChk);
        announceLabel.appendChild(document.createTextNode("Chat Emotes"));

        const permSelect = document.createElement("select");
        Object.assign(permSelect.style, {
            background: "transparent",
            color: "#a29bfe",
            border: "none",
            fontSize: "10px",
            cursor: "pointer",
            outline: "none",
        });
        const p1 = new Option("Hanya Saya", "owner");
        const p2 = new Option("Room Admin", "admin");
        const p3 = new Option("Semua Orang", "everyone");
        permSelect.add(p1);
        permSelect.add(p2);
        permSelect.add(p3);
        permSelect.value = config.permission;
        permSelect.onchange = (e) => {
            config.permission = e.target.value;
            saveConfig();
        };

        settingsRow.appendChild(announceLabel);
        settingsRow.appendChild(permSelect);

        // Assemble Panel
        panel.appendChild(header);
        panel.appendChild(titleEl);
        panel.appendChild(stationSelect);
        panel.appendChild(controlsRow);
        panel.appendChild(volumeRow);
        panel.appendChild(inputRow);
        panel.appendChild(botSection);
        panel.appendChild(settingsRow);

        uiContainer.appendChild(panel);
        uiContainer.appendChild(miniBtn);
        document.body.appendChild(uiContainer);

        makeDraggable(header, uiContainer);
    }

    function styleActionButton(btn, bgColor) {
        Object.assign(btn.style, {
            flex: "1",
            background: bgColor,
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "5px 8px",
            fontWeight: "600",
            fontSize: "11px",
            cursor: "pointer",
            transition: "opacity 0.2s",
        });
        btn.onmouseenter = () => (btn.style.opacity = "0.85");
        btn.onmouseleave = () => (btn.style.opacity = "1.0");
    }

    function styleHeaderButton(btn) {
        Object.assign(btn.style, {
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#ffffff",
            borderRadius: "4px",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "12px",
        });
    }

    function makeDraggable(handle, container) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        handle.addEventListener("mousedown", (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = container.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newLeft = Math.max(0, Math.min(window.innerWidth - 60, initialLeft + dx));
            const newTop = Math.max(0, Math.min(window.innerHeight - 60, initialTop + dy));
            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
            config.posLeft = newLeft;
            config.posTop = newTop;
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                saveConfig();
            }
        });
    }

    function updateUI() {
        if (titleEl) {
            titleEl.textContent = currentTitle;
        }
        if (playBtn) {
            playBtn.innerHTML = isPlaying ? "⏸️ Pause" : "▶️ Play";
        }
        if (volumeSlider) {
            volumeSlider.value = config.volume;
        }
        if (volLabel) {
            volLabel.textContent = `${config.volume}%`;
        }
        if (stationSelect && currentMode === "radio") {
            stationSelect.value = config.currentStationId;
        }
    }

    // ==========================================
    // 8. Lifecycle & Bootstrap
    // ==========================================
    function bootstrap() {
        initAudio();
        loadYouTubeAPI();
        createUI();
        installHooks();

        setInterval(() => {
            installHooks();
            checkRoomMembers();
        }, 3000);

        console.log("[BC-MusicBot] Character DJ Bot & Player ready!");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
