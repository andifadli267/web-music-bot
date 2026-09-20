/**
 * Frontend Client Application for Nava Music Bot Dashboard
 * Handles real-time polling from /api/status, offline detection, and interactive
 * bot remote controls (Music playback, queue, chat/emotes, expressions, room admin).
 */

const API_STATUS_URL = "/api/status";
const API_ACTION_URL = "/api/action";
const POLL_INTERVAL = 2000;

let currentPlaybackData = null;
let localAudioPlaying = false;
let isBotActiveState = false;

// Format seconds into mm:ss
function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Escape HTML utility to prevent XSS
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show Toast notification
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "⚠️";

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-msg">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(50px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Send action to bot backend API
async function sendBotAction(action, payload = {}) {
    if (!isBotActiveState) {
        showToast("Bot sedang offline atau tidak di dalam ruangan. Aksi dibatalkan.", "error");
        return { success: false, error: "Bot offline" };
    }

    try {
        const res = await fetch(API_ACTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, ...payload }),
        });

        const data = await res.json();
        if (!res.ok || data.success === false) {
            const errText = data.error || data.message || "Aksi gagal dijalankan.";
            showToast(errText, "error");
            return data;
        }

        showToast(data.message || "Aksi berhasil dikirim ke bot!", "success");
        // Trigger immediate status refresh
        fetchStatus();
        return data;
    } catch (err) {
        console.error("Action error:", err);
        showToast(`Gagal menghubungi server: ${err.message}`, "error");
        return { success: false, error: err.message };
    }
}

// Fetch live status from backend
async function fetchStatus() {
    try {
        const res = await fetch(API_STATUS_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        updateDashboard(data);
    } catch (err) {
        console.warn("[Dashboard Error] Failed to fetch bot status:", err.message);
        setOfflineState(false, false, "Gagal menghubungi Web Server");
    }
}

// Update offline overlay & control disabled states
function setOfflineState(isOnline, isInRoom, customMsg = "") {
    const overlay = document.getElementById("bot-offline-overlay");
    const overlayBotStatus = document.getElementById("overlay-bot-status");
    const overlayRoomStatus = document.getElementById("overlay-room-status");
    const botIndicator = document.getElementById("bot-status-indicator");
    const botText = document.getElementById("bot-status-text");
    const headerLiveDot = document.getElementById("header-live-dot");

    isBotActiveState = Boolean(isOnline && isInRoom);

    // Toggle interactive inputs & buttons
    const interactiveElements = document.querySelectorAll(
        ".control-body button, .control-body input, .chat-body button, .chat-body input, .chat-body select, .admin-card button, .admin-card input"
    );

    if (isBotActiveState) {
        overlay.classList.add("hidden");
        botIndicator.style.backgroundColor = "#10b981";
        botText.textContent = "Online";
        if (headerLiveDot) headerLiveDot.style.backgroundColor = "#10b981";

        interactiveElements.forEach(el => {
            el.disabled = false;
        });
    } else {
        overlay.classList.remove("hidden");
        botIndicator.style.backgroundColor = "#ef4444";
        botText.textContent = isOnline ? "Di Luar Room" : "Offline";
        if (headerLiveDot) headerLiveDot.style.backgroundColor = "#ef4444";

        if (overlayBotStatus) {
            overlayBotStatus.textContent = isOnline ? "Terhubung ke Game" : "Terputus / Offline";
            overlayBotStatus.className = `step-val ${isOnline ? "text-success" : "text-danger"}`;
        }
        if (overlayRoomStatus) {
            overlayRoomStatus.textContent = isInRoom ? "Di Dalam Room" : (customMsg || "Belum Bergabung ke Ruangan");
            overlayRoomStatus.className = `step-val ${isInRoom ? "text-success" : "text-warning"}`;
        }

        interactiveElements.forEach(el => {
            el.disabled = true;
        });
    }
}

// Update all UI elements with new data
function updateDashboard(data) {
    if (!data) return;

    const isOnline = data.bot && data.bot.isOnline;
    const isInRoom = data.room && data.room.isInRoom;

    // 1. Enforce active / offline state
    setOfflineState(isOnline, isInRoom);

    // 2. Update Room Information
    const roomName = (data.room && data.room.name) ? data.room.name : (data.bot ? data.bot.targetRoom : "Belum Masuk Room");
    const headerRoomEl = document.getElementById("header-room-name");
    const metaRoomEl = document.getElementById("meta-room-name");
    const metaBotNameEl = document.getElementById("meta-bot-name");
    const metaFriendsEl = document.getElementById("meta-friends-count");
    const memberCountBadge = document.getElementById("member-count-badge");

    headerRoomEl.textContent = roomName;
    metaRoomEl.textContent = roomName + (data.room?.space ? ` (${data.room.space})` : "");

    if (data.bot) {
        metaBotNameEl.textContent = `${data.bot.name || "Nava"} (#${data.bot.memberNumber || "258115"})`;
        metaFriendsEl.textContent = `${data.bot.friendsCount || 0} Teman`;
    }

    // Room Players List
    const playersListEl = document.getElementById("players-list");
    const players = (data.room && Array.isArray(data.room.players)) ? data.room.players : [];
    const admins = (data.room && Array.isArray(data.room.admins)) ? data.room.admins : [];

    memberCountBadge.textContent = `${players.length} Pemain`;

    if (players.length > 0) {
        playersListEl.innerHTML = players.map(p => {
            const isAdmin = admins.includes(p.memberNumber);
            const isBot = data.bot && p.memberNumber === data.bot.memberNumber;
            let badgeClass = "player-tag";
            let roleIcon = "👤";

            if (isBot) {
                badgeClass += " tag-bot";
                roleIcon = "🎧";
            } else if (isAdmin) {
                badgeClass += " tag-admin";
                roleIcon = "👑";
            }

            return `<span class="${badgeClass}">
                <i>${roleIcon}</i>
                <strong>${escapeHtml(p.name)}</strong>
                <small>(#${p.memberNumber})</small>
            </span>`;
        }).join("");
    } else {
        playersListEl.innerHTML = `<span class="player-tag empty-tag">Bot sedang menunggu di room atau belum ada pemain lain.</span>`;
    }

    // 3. Update Now Playing (Playback)
    const playback = data.playback || {};
    const trackTitleEl = document.getElementById("track-title");
    const trackSubEl = document.getElementById("track-subtitle");
    const sourceBadgeEl = document.getElementById("source-badge");
    const requesterBoxEl = document.getElementById("requester-box");
    const requesterNameEl = document.getElementById("requester-name");
    const vinylDiscEl = document.getElementById("vinyl-disc");
    const vinylIconEl = document.getElementById("vinyl-icon");
    const progressBarFill = document.getElementById("progress-bar-fill");
    const timeCurrentEl = document.getElementById("time-current");
    const timeTotalEl = document.getElementById("time-total");
    const webAudio = document.getElementById("web-audio");

    currentPlaybackData = playback;

    if (playback.currentTrack) {
        const track = playback.currentTrack;
        trackTitleEl.textContent = track.title || "Unknown Track";
        trackSubEl.textContent = "Sedang diputar tersinkronisasi untuk semua pemain di room";
        sourceBadgeEl.textContent = "YouTube Audio";
        sourceBadgeEl.style.display = "inline-block";

        // Requester Info
        requesterBoxEl.style.display = "inline-flex";
        const reqName = track.requesterName || (track.requestedBy ? `Member #${track.requestedBy}` : "DJ");
        requesterNameEl.textContent = reqName;

        // Vinyl Animation
        vinylDiscEl.classList.add("spinning");
        vinylIconEl.textContent = "🎶";

        // Duration & Progress Calculation
        const startedAt = track.startedAt || Date.now();
        const duration = track.duration || 0;
        const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

        if (duration > 0) {
            const pct = Math.min(100, Math.max(0, (elapsed / duration) * 100));
            progressBarFill.style.width = `${pct}%`;
            timeCurrentEl.textContent = formatTime(elapsed);
            timeTotalEl.textContent = formatTime(duration);
        } else {
            progressBarFill.style.width = "100%";
            timeCurrentEl.textContent = formatTime(elapsed);
            timeTotalEl.textContent = "Live";
        }

        // Sync Audio Source if user requested local listen
        if (track.directUrl && webAudio.src !== track.directUrl) {
            webAudio.src = track.directUrl;
            if (localAudioPlaying) {
                if (duration > 0 && elapsed < duration) {
                    webAudio.currentTime = elapsed;
                }
                webAudio.play().catch(e => console.warn("Audio play prevented:", e));
            }
        }
    } else if (playback.currentStation) {
        const st = playback.currentStation;
        trackTitleEl.textContent = st.name || "Live Radio";
        trackSubEl.textContent = "Stasiun Radio Komersial 24/7 (Online Stream)";
        sourceBadgeEl.textContent = "24/7 Radio";
        sourceBadgeEl.style.display = "inline-block";

        requesterBoxEl.style.display = "inline-flex";
        requesterNameEl.textContent = "Bot Radio";

        vinylDiscEl.classList.add("spinning");
        vinylIconEl.textContent = "📻";

        progressBarFill.style.width = "100%";
        timeCurrentEl.textContent = "LIVE";
        timeTotalEl.textContent = "24/7";

        if (st.url && webAudio.src !== st.url) {
            webAudio.src = st.url;
            if (localAudioPlaying) {
                webAudio.play().catch(e => console.warn("Audio play prevented:", e));
            }
        }
    } else {
        // Idle
        trackTitleEl.textContent = "Tidak ada musik yang diputar";
        trackSubEl.textContent = "Gunakan form pemutar di bawah atau ketik !play di room chat";
        sourceBadgeEl.style.display = "none";
        requesterBoxEl.style.display = "none";

        vinylDiscEl.classList.remove("spinning");
        vinylIconEl.textContent = "🎵";

        progressBarFill.style.width = "0%";
        timeCurrentEl.textContent = "0:00";
        timeTotalEl.textContent = "0:00";

        if (webAudio.src) {
            webAudio.pause();
            webAudio.src = "";
        }
    }

    // 4. Update Queue List
    const queueListEl = document.getElementById("queue-list");
    const queueCounterEl = document.getElementById("queue-counter");
    const queue = Array.isArray(data.queue) ? data.queue : [];

    queueCounterEl.textContent = `${queue.length} / 20`;

    if (queue.length > 0) {
        queueListEl.innerHTML = queue.map((item, idx) => {
            const req = item.requesterName || (item.requestedBy ? `Member #${item.requestedBy}` : "DJ");
            const dur = item.duration ? formatTime(item.duration) : "Audio";

            return `
                <div class="queue-item">
                    <span class="queue-num">#${idx + 1}</span>
                    <div class="queue-track-info">
                        <div class="queue-track-title">${escapeHtml(item.title)}</div>
                        <div class="queue-track-meta">
                            <span>⏱️ ${dur}</span>
                            <span>👤 Req by: <strong>${escapeHtml(req)}</strong></span>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } else {
        queueListEl.innerHTML = `
            <div class="queue-empty">
                <div class="empty-icon">☕</div>
                <h3>Antrean Lagu Kosong</h3>
                <p>Gunakan form pemutar di samping atau ketik <code>!play judul</code> di room chat untuk menambahkan lagu.</p>
            </div>
        `;
    }

    // 5. Update Admin Panels (Admins, Whitelist, Banlist)
    updateAdminPanels(data);

    // 6. Update Authorized Members Panel
    updateAuthorizedMembers(data);
}

// Render Room Administration badges
function updateAdminPanels(data) {
    const room = data.room || {};
    const botMemberNumber = data.bot ? data.bot.memberNumber : 0;

    // A. Room Admins
    const adminsListEl = document.getElementById("room-admins-list");
    const admins = Array.isArray(room.admins) ? room.admins : [];
    if (admins.length > 0) {
        adminsListEl.innerHTML = admins.map(id => {
            const isBot = id === botMemberNumber;
            const removeBtn = isBot
                ? ""
                : `<button class="member-remove-btn" title="Hapus Admin" onclick="handleRemoveAdmin(${id})">✕</button>`;
            return `
                <span class="member-item-badge">
                    <span>👑 #${id}</span>
                    ${removeBtn}
                </span>
            `;
        }).join("");
    } else {
        adminsListEl.innerHTML = `<span class="empty-hint">Tidak ada admin terdaftar.</span>`;
    }

    // B. Whitelist
    const wlListEl = document.getElementById("room-whitelist-list");
    const whitelist = Array.isArray(room.whitelist) ? room.whitelist : [];
    if (whitelist.length > 0) {
        wlListEl.innerHTML = whitelist.map(id => `
            <span class="member-item-badge">
                <span>📜 #${id}</span>
                <button class="member-remove-btn" title="Hapus dari Whitelist" onclick="handleRemoveWhitelist(${id})">✕</button>
            </span>
        `).join("");
    } else {
        wlListEl.innerHTML = `<span class="empty-hint">Whitelist kosong (Akses terbuka).</span>`;
    }

    // C. Banlist
    const banListEl = document.getElementById("room-ban-list");
    const ban = Array.isArray(room.ban) ? room.ban : [];
    if (ban.length > 0) {
        banListEl.innerHTML = ban.map(id => `
            <span class="member-item-badge">
                <span>🚫 #${id}</span>
                <button class="member-remove-btn" title="Unban Member" onclick="handleRemoveBan(${id})">✕</button>
            </span>
        `).join("");
    } else {
        banListEl.innerHTML = `<span class="empty-hint">Tidak ada member yang di-ban.</span>`;
    }
}

// Global removal handlers for room admin elements
window.handleRemoveAdmin = function(memberNumber) {
    if (!confirm(`Hapus Member #${memberNumber} dari Administrator ruangan?`)) return;
    sendBotAction("admin", { subAction: "removeAdmin", memberNumber });
};

window.handleRemoveWhitelist = function(memberNumber) {
    sendBotAction("admin", { subAction: "removeWhitelist", memberNumber });
};

window.handleRemoveBan = function(memberNumber) {
    sendBotAction("admin", { subAction: "removeBan", memberNumber });
};

// Render Authorized Members list
function updateAuthorizedMembers(data) {
    const listEl = document.getElementById("authorized-members-list");
    const countBadge = document.getElementById("auth-count-badge");
    if (!listEl) return;

    const authMembers = Array.isArray(data.authorizedMembers) ? data.authorizedMembers : [];
    if (countBadge) {
        countBadge.textContent = `${authMembers.length} Member`;
    }

    if (authMembers.length > 0) {
        listEl.innerHTML = authMembers.map(m => {
            const isPrimary = Boolean(m.isPrimary);
            const removeBtn = isPrimary
                ? `<span class="auth-pill-tag primary">Primary Owner</span>`
                : `<button class="member-remove-btn" title="Hapus Authorized Member" onclick="handleRemoveAuthMember(${m.memberNumber})">✕</button>`;
            
            return `
                <div class="auth-member-pill ${isPrimary ? 'is-primary' : ''}">
                    <div class="auth-pill-left">
                        <span class="auth-pill-star">⭐</span>
                        <strong class="auth-pill-id">#${m.memberNumber}</strong>
                        <span class="auth-pill-name">(${escapeHtml(m.name || 'Member')})</span>
                    </div>
                    <div class="auth-pill-right">
                        ${removeBtn}
                    </div>
                </div>
            `;
        }).join("");
    } else {
        listEl.innerHTML = `<span class="empty-hint">Tidak ada authorized member terdaftar.</span>`;
    }
}

// Global removal handler for authorized members
window.handleRemoveAuthMember = function(memberNumber) {
    if (!confirm(`Hapus Member #${memberNumber} dari daftar Authorized Member?`)) return;
    sendBotAction("authorizedMember", { subAction: "remove", memberNumber });
};

// Setup DOM Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    // 1. Play Song Form
    const formPlay = document.getElementById("form-play");
    const inputQuery = document.getElementById("input-query");
    const inputRequester = document.getElementById("input-requester");

    formPlay.addEventListener("submit", async (e) => {
        e.preventDefault();
        const query = (inputQuery.value || "").trim();
        const requester = (inputRequester.value || "").trim() || "Web DJ";
        if (!query) return;

        showToast(`Memproses permintaan lagu: "${query}"...`, "info");
        await sendBotAction("play", { query, requester });
        inputQuery.value = "";
    });

    // 2. Quick Control Buttons (Skip, Stop, Clear)
    document.getElementById("btn-action-skip").addEventListener("click", () => {
        sendBotAction("skip", { requester: "Web User" });
    });

    document.getElementById("btn-action-stop").addEventListener("click", () => {
        if (!confirm("Hentikan pemutaran musik di ruangan?")) return;
        sendBotAction("stop", { requester: "Web User" });
    });

    document.getElementById("btn-action-clear").addEventListener("click", () => {
        if (!confirm("Bersihkan seluruh antrean lagu?")) return;
        sendBotAction("clear", { requester: "Web User" });
    });

    // 3. Radio Buttons
    document.querySelectorAll(".btn-radio").forEach(btn => {
        btn.addEventListener("click", () => {
            const genre = btn.getAttribute("data-genre");
            sendBotAction("radio", { genre, requester: "Web DJ" });
        });
    });

    // 4. Send Chat / Emote Form
    const formChat = document.getElementById("form-chat");
    const inputChatMsg = document.getElementById("input-chat-msg");
    const selectChatType = document.getElementById("select-chat-type");

    formChat.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = (inputChatMsg.value || "").trim();
        const isEmote = selectChatType.value === "Emote";
        if (!msg) return;

        await sendBotAction("chat", { message: msg, isEmote });
        inputChatMsg.value = "";
    });

    // 5. Expression Quick Buttons
    document.querySelectorAll(".btn-expr").forEach(btn => {
        btn.addEventListener("click", () => {
            const group = btn.getAttribute("data-group");
            const expression = btn.getAttribute("data-expr");
            sendBotAction("expression", { group, expression });
        });
    });

    // 6. Admin Tabs Navigation
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const tabId = btn.getAttribute("data-tab");
            const targetPane = document.getElementById(tabId);
            if (targetPane) targetPane.classList.add("active");
        });
    });

    // 7. Admin Forms
    // Add Admin
    document.getElementById("form-add-admin").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("input-add-admin-id");
        const memberNumber = parseInt(input.value, 10);
        if (memberNumber) {
            sendBotAction("admin", { subAction: "addAdmin", memberNumber });
            input.value = "";
        }
    });

    // Add Whitelist
    document.getElementById("form-add-wl").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("input-add-wl-id");
        const memberNumber = parseInt(input.value, 10);
        if (memberNumber) {
            sendBotAction("admin", { subAction: "addWhitelist", memberNumber });
            input.value = "";
        }
    });

    // Add Ban
    document.getElementById("form-add-ban").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("input-add-ban-id");
        const memberNumber = parseInt(input.value, 10);
        if (memberNumber) {
            sendBotAction("admin", { subAction: "addBan", memberNumber });
            input.value = "";
        }
    });

    // Kick Member
    document.getElementById("form-kick").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("input-kick-id");
        const memberNumber = parseInt(input.value, 10);
        if (memberNumber) {
            if (!confirm(`Kick Member #${memberNumber} dari ruangan?`)) return;
            sendBotAction("admin", { subAction: "kick", memberNumber });
            input.value = "";
        }
    });

    // 8. Local Web Audio Listen Toggle
    const btnListen = document.getElementById("btn-listen-web");
    const webAudio = document.getElementById("web-audio");
    const listenIcon = document.getElementById("listen-icon");
    const listenText = document.getElementById("listen-text");

    btnListen.addEventListener("click", () => {
        if (!localAudioPlaying) {
            if (webAudio.src) {
                webAudio.play().then(() => {
                    localAudioPlaying = true;
                    btnListen.classList.add("active");
                    listenIcon.textContent = "⏸️";
                    listenText.textContent = "Hentikan Audio";
                }).catch(err => {
                    showToast("Tidak dapat memutar audio: " + err.message, "error");
                });
            } else {
                showToast("Saat ini belum ada audio yang aktif di ruangan.", "info");
            }
        } else {
            webAudio.pause();
            localAudioPlaying = false;
            btnListen.classList.remove("active");
            listenIcon.textContent = "🔊";
            listenText.textContent = "Dengarkan di Browser";
        }
    });

    // 8b. Authorized Member Management & Quick Switch Room
    const formAddAuth = document.getElementById("form-add-auth");
    if (formAddAuth) {
        formAddAuth.addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = document.getElementById("input-add-auth-id");
            const memberNumber = parseInt(input.value, 10);
            if (memberNumber) {
                await sendBotAction("authorizedMember", { subAction: "add", memberNumber });
                input.value = "";
            }
        });
    }

    const formQuickRoom = document.getElementById("form-quick-switch-room");
    if (formQuickRoom) {
        formQuickRoom.addEventListener("submit", async (e) => {
            e.preventDefault();
            const roomName = (document.getElementById("input-quick-room-name").value || "").trim();
            const password = (document.getElementById("input-quick-room-pass").value || "").trim();
            if (!roomName) return;
            showToast(`Memerintahkan bot untuk bergabung ke "${roomName}"...`, "info");
            await sendBotAction("authorizedMember", { subAction: "switchRoom", roomName, password });
            document.getElementById("input-quick-room-name").value = "";
            document.getElementById("input-quick-room-pass").value = "";
        });
    }

    // 9. Initialize Real-Time Server-Sent Events (SSE) for instant auto-refresh on any bot input
    function initEventStream() {
        if (!window.EventSource) return;

        const eventSource = new EventSource("/api/events");

        eventSource.onmessage = (event) => {
            if (!event.data) return;
            try {
                const data = JSON.parse(event.data);
                updateDashboard(data);
            } catch (err) {
                console.warn("[SSE Warning] Failed to parse stream data:", err);
            }
        };

        eventSource.onerror = () => {
            // EventSource automatically handles reconnection
            console.warn("[SSE Info] Connection interrupted, retrying automatically...");
        };
    }

    initEventStream();

    // Initial fetch & fallback polling
    fetchStatus();
    setInterval(fetchStatus, 3000);
});
