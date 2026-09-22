/**
 * Room Administration & Authorized Members Module
 * Renders badges for room admins, whitelist, banlist,
 * and authorized master members, with removal handlers.
 */

function updateAdminPanels(data) {
    const room = data.room || {};
    const botMemberNumber = data.bot ? data.bot.memberNumber : 0;

    // A. Room Admins
    const adminsListEl = document.getElementById("room-admins-list");
    const admins = Array.isArray(room.admins) ? room.admins : [];
    if (adminsListEl) {
        if (admins.length > 0) {
            adminsListEl.innerHTML = admins.map(id => {
                const isBot = id === botMemberNumber;
                const removeBtn = isBot
                    ? ""
                    : `<button class="member-remove-btn" title="${t('btn_remove')}" onclick="handleRemoveAdmin(${id})">✕</button>`;
                return `
                    <span class="member-item-badge">
                        <span>👑 #${id}</span>
                        ${removeBtn}
                    </span>
                `;
            }).join("");
        } else {
            adminsListEl.innerHTML = `<span class="empty-hint">${t('admin_list_empty')}</span>`;
        }
    }

    // B. Whitelist
    const wlListEl = document.getElementById("room-whitelist-list");
    const whitelist = Array.isArray(room.whitelist) ? room.whitelist : [];
    if (wlListEl) {
        if (whitelist.length > 0) {
            wlListEl.innerHTML = whitelist.map(id => `
                <span class="member-item-badge">
                    <span>📜 #${id}</span>
                    <button class="member-remove-btn" title="${t('btn_remove')}" onclick="handleRemoveWhitelist(${id})">✕</button>
                </span>
            `).join("");
        } else {
            wlListEl.innerHTML = `<span class="empty-hint">${t('wl_list_empty')}</span>`;
        }
    }

    // C. Banlist
    const banListEl = document.getElementById("room-ban-list");
    const ban = Array.isArray(room.ban) ? room.ban : [];
    if (banListEl) {
        if (ban.length > 0) {
            banListEl.innerHTML = ban.map(id => `
                <span class="member-item-badge">
                    <span>🚫 #${id}</span>
                    <button class="member-remove-btn" title="${t('btn_remove')}" onclick="handleRemoveBan(${id})">✕</button>
                </span>
            `).join("");
        } else {
            banListEl.innerHTML = `<span class="empty-hint">${t('ban_list_empty')}</span>`;
        }
    }
}

// Global removal handlers for room admin elements
window.handleRemoveAdmin = function(memberNumber) {
    if (!confirm(t("confirm_remove_admin", { id: memberNumber }))) return;
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
        const suffix = authMembers.length === 1 ? "Member" : "Members";
        countBadge.textContent = `${authMembers.length} ${suffix}`;
    }

    if (authMembers.length > 0) {
        listEl.innerHTML = authMembers.map(m => {
            return `
                <div class="auth-member-pill">
                    <div class="auth-pill-left">
                        <span class="auth-pill-star">⭐</span>
                        <strong class="auth-pill-id">#${m.memberNumber}</strong>
                        <span class="auth-pill-name">(${escapeHtml(m.name || 'Member')})</span>
                    </div>
                    <div class="auth-pill-right">
                        <button class="auth-remove-btn" title="${t('btn_remove')}" onclick="handleRemoveAuthMember(${m.memberNumber})">
                            <span>🗑️</span> ${t('btn_remove')}
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    } else {
        listEl.innerHTML = `<span class="empty-hint">${t('auth_empty_hint')}</span>`;
    }
}

// Global removal handler for authorized members
window.handleRemoveAuthMember = function(memberNumber) {
    if (!confirm(t("confirm_remove_auth", { id: memberNumber }))) return;
    sendBotAction("authorizedMember", { subAction: "remove", memberNumber });
};

