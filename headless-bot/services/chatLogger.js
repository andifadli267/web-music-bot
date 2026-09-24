/**
 * Room Chat Logger Service
 * Captures room conversations and stores them with a 15-minute TTL.
 * Messages older than 15 minutes are automatically pruned.
 */

const MESSAGE_TTL_MS = 15 * 60 * 1000;
const PRUNE_INTERVAL_MS = 30 * 1000;

const chatHistory = [];
let messageIdCounter = 0;
let pruneTimer = null;
let notifyCallback = null;

function isInternalNoise(content, type) {
    if (!content || typeof content !== "string") return true;
    const str = content.trim();
    if (!str) return true;

    if (type === "Hidden" || type === "Status") return true;

    // Exact internal engine signals, audio/mouth movements, or null strings
    if (/^(null|undefined|Talk|ChatRoomChat|Action|Activity)$/i.test(str)) return true;

    // Known mod/addon protocol prefixes or abbreviations
    const modPattern = /^(AFC::|BCP(\b|::|_|Msg)|MPA(\b|::|_|Msg)|LSCG|bctMsg|BCT(\b|::|_|Msg)|BCX|BCE|ECHO_|PCM_|CG_|KIKILINK|Liko|FUSA|WA_|UT_|HQ_|KB_|BB_|BF_)/i;
    if (modPattern.test(str)) return true;

    // Raw JSON / dictionary objects used by addons
    if ((str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[{") && str.endsWith("}]"))) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {}
    }

    // Raw untranslated BC internal localization keys (e.g. ActionUseItem, ActivityTie, PoseStand, etc.)
    if (/^(Action|Activity|Pose|Expression)[A-Za-z0-9_]+$/.test(str)) {
        return true;
    }

    return false;
}

function setNotifyCallback(fn) {
    notifyCallback = fn;
}

function addChatMessage({ sender, senderName, content, type, isBot }) {
    if (!content || typeof content !== "string") return;
    if (isInternalNoise(content, type)) return;

    messageIdCounter += 1;
    chatHistory.push({
        id: messageIdCounter,
        timestamp: Date.now(),
        sender: sender || 0,
        senderName: senderName || "Unknown",
        content: content.substring(0, 500),
        type: type || "Chat",
        isBot: Boolean(isBot),
    });

    pruneExpired();

    if (typeof notifyCallback === "function") {
        notifyCallback();
    }
}

function pruneExpired() {
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    let removed = 0;
    while (chatHistory.length > 0 && chatHistory[0].timestamp < cutoff) {
        chatHistory.shift();
        removed++;
    }
    return removed;
}

function getRecentMessages() {
    pruneExpired();
    return chatHistory.slice();
}

function startAutoPrune() {
    if (pruneTimer) return;
    pruneTimer = setInterval(() => {
        const removed = pruneExpired();
        if (removed > 0 && typeof notifyCallback === "function") {
            notifyCallback();
        }
    }, PRUNE_INTERVAL_MS);
}

function stopAutoPrune() {
    if (pruneTimer) {
        clearInterval(pruneTimer);
        pruneTimer = null;
    }
}

startAutoPrune();

module.exports = {
    addChatMessage,
    getRecentMessages,
    setNotifyCallback,
    startAutoPrune,
    stopAutoPrune,
    isInternalNoise,
};

