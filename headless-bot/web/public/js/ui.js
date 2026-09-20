/**
 * UI Utilities & Notifications Module
 * Provides time formatting, HTML escaping, cyber toast notifications,
 * and offline/online status overlay control.
 */

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

// Show Cyber Toast notification
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

// Update offline overlay & disable/enable control inputs
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
        if (overlay) overlay.classList.add("hidden");
        if (botIndicator) botIndicator.style.backgroundColor = "#00ff9d";
        if (botText) botText.textContent = "Online";
        if (headerLiveDot) headerLiveDot.style.backgroundColor = "#00ff9d";

        interactiveElements.forEach(el => {
            el.disabled = false;
        });
    } else {
        if (overlay) overlay.classList.remove("hidden");
        if (botIndicator) botIndicator.style.backgroundColor = "#ff007a";
        if (botText) botText.textContent = isOnline ? "Di Luar Room" : "Offline";
        if (headerLiveDot) headerLiveDot.style.backgroundColor = "#ff007a";

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
