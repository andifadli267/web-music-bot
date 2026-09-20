/**
 * Frontend Client Application for Nava Music Bot Dashboard
 * Fetches real-time status from /api/status every 2 seconds and updates
 * playback, queue list, and room information dynamically.
 */

const API_STATUS_URL = "/api/status";
const POLL_INTERVAL = 2000;

let currentPlaybackData = null;
let localAudioPlaying = false;

// Format seconds into mm:ss
function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
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
        document.getElementById("bot-status-indicator").style.backgroundColor = "#ef4444";
        document.getElementById("bot-status-text").textContent = "Reconnecting...";
    }
}

// Update all UI elements with new data
function updateDashboard(data) {
    if (!data) return;

    // 1. Update Bot Status & Connection
    const botIndicator = document.getElementById("bot-status-indicator");
    const botText = document.getElementById("bot-status-text");
    const isOnline = data.bot && data.bot.isOnline;

    if (isOnline) {
        botIndicator.style.backgroundColor = "#10b981";
        botText.textContent = "Online";
    } else {
        botIndicator.style.backgroundColor = "#f59e0b";
        botText.textContent = "Connecting...";
    }

    // 2. Update Room Information
    const roomName = (data.room && data.room.name) ? data.room.name : (data.bot ? data.bot.targetRoom : "Belum Masuk Room");
    const isInRoom = data.room && data.room.isInRoom;

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
            // Live stream / audio without known duration
            progressBarFill.style.width = "100%";
            timeCurrentEl.textContent = formatTime(elapsed);
            timeTotalEl.textContent = "Live";
        }

        // Keep local web audio source in sync
        if (webAudio.dataset.currentUrl !== track.directUrl) {
            webAudio.dataset.currentUrl = track.directUrl;
            webAudio.src = track.directUrl;
            if (localAudioPlaying) {
                webAudio.currentTime = elapsed;
                webAudio.play().catch(() => {});
            }
        }
    } else if (playback.currentStation) {
        const station = playback.currentStation;
        trackTitleEl.textContent = station.name || "24/7 Radio Station";
        trackSubEl.textContent = `Genre: ${station.genre || "Music"}`;
        sourceBadgeEl.textContent = "24/7 Radio";
        sourceBadgeEl.style.display = "inline-block";

        requesterBoxEl.style.display = "inline-flex";
        requesterNameEl.textContent = "Nava Music Radio";

        vinylDiscEl.classList.add("spinning");
        vinylIconEl.textContent = "📻";

        progressBarFill.style.width = "100%";
        timeCurrentEl.textContent = "LIVE";
        timeTotalEl.textContent = "24/7";

        if (webAudio.dataset.currentUrl !== station.url) {
            webAudio.dataset.currentUrl = station.url;
            webAudio.src = station.url;
            if (localAudioPlaying) {
                webAudio.play().catch(() => {});
            }
        }
    } else {
        // Nothing playing
        trackTitleEl.textContent = "Tidak ada musik yang diputar";
        trackSubEl.textContent = "Gunakan perintah !play <judul/link> di dalam room";
        sourceBadgeEl.style.display = "none";
        requesterBoxEl.style.display = "none";

        vinylDiscEl.classList.remove("spinning");
        vinylIconEl.textContent = "🎵";

        progressBarFill.style.width = "0%";
        timeCurrentEl.textContent = "0:00";
        timeTotalEl.textContent = "0:00";

        if (localAudioPlaying) {
            webAudio.pause();
        }
        webAudio.dataset.currentUrl = "";
        webAudio.src = "";
    }

    // 4. Update Song Queue
    const queue = Array.isArray(data.queue) ? data.queue : [];
    const queueListEl = document.getElementById("queue-list");
    const queueCounterEl = document.getElementById("queue-counter");

    queueCounterEl.textContent = `${queue.length} / 10`;

    if (queue.length > 0) {
        queueListEl.innerHTML = queue.map((item, idx) => {
            const req = item.requesterName || (item.requestedBy ? `Member #${item.requestedBy}` : "DJ");
            const dur = item.duration ? formatTime(item.duration) : "Audio";

            return `<div class="queue-item">
                <div class="queue-idx">#${idx + 1}</div>
                <div class="queue-info">
                    <div class="queue-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                    <div class="queue-meta">
                        <span class="queue-req">👤 ${escapeHtml(req)}</span>
                        <span class="queue-dur">⏱️ ${dur}</span>
                    </div>
                </div>
            </div>`;
        }).join("");
    } else {
        queueListEl.innerHTML = `
            <div class="queue-empty">
                <div class="empty-icon">☕</div>
                <h3>Antrean Lagu Kosong</h3>
                <p>Ketik <code>!play judul lagu</code> atau <code>!play link youtube</code> di room chat untuk menambahkan lagu ke antrean.</p>
            </div>
        `;
    }
}

// Local browser audio toggle button
const btnListenWeb = document.getElementById("btn-listen-web");
const webAudio = document.getElementById("web-audio");
const listenIcon = document.getElementById("listen-icon");
const listenText = document.getElementById("listen-text");

btnListenWeb.addEventListener("click", () => {
    if (!webAudio.src || !webAudio.dataset.currentUrl) {
        alert("Saat ini belum ada musik yang sedang diputar oleh bot.");
        return;
    }

    if (localAudioPlaying) {
        webAudio.pause();
        localAudioPlaying = false;
        btnListenWeb.classList.remove("playing");
        listenIcon.textContent = "🔊";
        listenText.textContent = "Dengarkan di Browser";
    } else {
        webAudio.play()
            .then(() => {
                localAudioPlaying = true;
                btnListenWeb.classList.add("playing");
                listenIcon.textContent = "⏸️";
                listenText.textContent = "Matikan Audio Browser";
            })
            .catch(err => {
                alert("Browser memblokir pemutaran otomatis: " + err.message);
            });
    }
});

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initial fetch and recurring poll
fetchStatus();
setInterval(fetchStatus, POLL_INTERVAL);
