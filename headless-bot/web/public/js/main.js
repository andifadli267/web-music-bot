/**
 * Main Application Orchestrator Module
 * Coordinates UI updates, registers DOM event handlers,
 * and initializes real-time SSE stream.
 */

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

    if (headerRoomEl) headerRoomEl.textContent = roomName;
    if (metaRoomEl) metaRoomEl.textContent = roomName + (data.room?.space ? ` (${data.room.space})` : "");

    if (data.bot) {
        if (metaBotNameEl) metaBotNameEl.textContent = `${data.bot.name || "Nava"} (#${data.bot.memberNumber || "258115"})`;
        if (metaFriendsEl) metaFriendsEl.textContent = `${data.bot.friendsCount || 0} Teman`;
    }

    // Room Players List
    const playersListEl = document.getElementById("players-list");
    const players = (data.room && Array.isArray(data.room.players)) ? data.room.players : [];
    const admins = (data.room && Array.isArray(data.room.admins)) ? data.room.admins : [];

    if (memberCountBadge) memberCountBadge.textContent = `${players.length} Pemain`;

    if (playersListEl) {
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
    }

    // 3. Update Now Playing UI
    updatePlayerUI(data.playback);

    // 4. Update Upcoming Queue List
    const queueListEl = document.getElementById("queue-list");
    const queueCounterEl = document.getElementById("queue-counter");
    const queue = Array.isArray(data.queue) ? data.queue : [];

    if (queueCounterEl) queueCounterEl.textContent = `${queue.length} / 20`;

    if (queueListEl) {
        if (queue.length > 0) {
            queueListEl.innerHTML = queue.map((item, idx) => {
                const req = item.requesterName || (item.requestedBy ? `Member #${item.requestedBy}` : "DJ");
                const dur = item.duration ? formatTime(item.duration) : "Audio";

                return `
                    <div class="queue-item">
                        <span class="queue-idx">#${idx + 1}</span>
                        <div class="queue-info">
                            <div class="queue-title">${escapeHtml(item.title)}</div>
                            <div class="queue-meta">
                                <span class="queue-dur">⏱️ ${dur}</span>
                                <span class="queue-req">👤 Req by: <strong>${escapeHtml(req)}</strong></span>
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
    }

    // 5. Update Admin Panels
    updateAdminPanels(data);

    // 6. Update Authorized Members Panel
    updateAuthorizedMembers(data);
}

// Setup Event Listeners on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
    // 1. Play Song Form
    const formPlay = document.getElementById("form-play");
    const inputQuery = document.getElementById("input-query");
    const inputRequester = document.getElementById("input-requester");

    if (formPlay) {
        formPlay.addEventListener("submit", async (e) => {
            e.preventDefault();
            const query = (inputQuery.value || "").trim();
            const requester = (inputRequester.value || "").trim() || "Web DJ";
            if (!query) return;

            showToast(`Memproses permintaan lagu: "${query}"...`, "info");
            await sendBotAction("play", { query, requester });
            inputQuery.value = "";
        });
    }

    // 2. Quick Control Buttons (Skip, Stop, Clear)
    const btnSkip = document.getElementById("btn-action-skip");
    if (btnSkip) {
        btnSkip.addEventListener("click", () => {
            sendBotAction("skip", { requester: "Web User" });
        });
    }

    const btnStop = document.getElementById("btn-action-stop");
    if (btnStop) {
        btnStop.addEventListener("click", () => {
            if (!confirm("Hentikan pemutaran musik di ruangan?")) return;
            sendBotAction("stop", { requester: "Web User" });
        });
    }

    const btnClear = document.getElementById("btn-action-clear");
    if (btnClear) {
        btnClear.addEventListener("click", () => {
            if (!confirm("Bersihkan seluruh antrean lagu?")) return;
            sendBotAction("clear", { requester: "Web User" });
        });
    }

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

    if (formChat) {
        formChat.addEventListener("submit", async (e) => {
            e.preventDefault();
            const msg = (inputChatMsg.value || "").trim();
            const isEmote = selectChatType.value === "Emote";
            if (!msg) return;

            await sendBotAction("chat", { message: msg, isEmote });
            inputChatMsg.value = "";
        });
    }

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
    const formAddAdmin = document.getElementById("form-add-admin");
    if (formAddAdmin) {
        formAddAdmin.addEventListener("submit", (e) => {
            e.preventDefault();
            const input = document.getElementById("input-add-admin-id");
            const memberNumber = parseInt(input.value, 10);
            if (memberNumber) {
                sendBotAction("admin", { subAction: "addAdmin", memberNumber });
                input.value = "";
            }
        });
    }

    const formAddWl = document.getElementById("form-add-wl");
    if (formAddWl) {
        formAddWl.addEventListener("submit", (e) => {
            e.preventDefault();
            const input = document.getElementById("input-add-wl-id");
            const memberNumber = parseInt(input.value, 10);
            if (memberNumber) {
                sendBotAction("admin", { subAction: "addWhitelist", memberNumber });
                input.value = "";
            }
        });
    }

    const formAddBan = document.getElementById("form-add-ban");
    if (formAddBan) {
        formAddBan.addEventListener("submit", (e) => {
            e.preventDefault();
            const input = document.getElementById("input-add-ban-id");
            const memberNumber = parseInt(input.value, 10);
            if (memberNumber) {
                sendBotAction("admin", { subAction: "addBan", memberNumber });
                input.value = "";
            }
        });
    }

    const formKick = document.getElementById("form-kick");
    if (formKick) {
        formKick.addEventListener("submit", (e) => {
            e.preventDefault();
            const input = document.getElementById("input-kick-id");
            const memberNumber = parseInt(input.value, 10);
            if (memberNumber) {
                if (!confirm(`Kick Member #${memberNumber} dari ruangan?`)) return;
                sendBotAction("admin", { subAction: "kick", memberNumber });
                input.value = "";
            }
        });
    }

    // 8. Local Web Audio Listen Toggle
    const btnListen = document.getElementById("btn-listen-web");
    if (btnListen) {
        btnListen.addEventListener("click", toggleLocalAudioListen);
    }

    // 9. Authorized Member Management & Quick Switch Room
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

    // 10. Start Real-Time SSE Stream & Initial Fetch
    initEventStream(updateDashboard);
    fetchStatus(updateDashboard);
    setInterval(() => fetchStatus(updateDashboard), 3000);
});
