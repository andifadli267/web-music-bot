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
        if (botIndicator) botIndicator.style.backgroundColor = "var(--success)";
        if (botText) botText.textContent = "Online";
        if (headerLiveDot) headerLiveDot.style.backgroundColor = "var(--success)";

        interactiveElements.forEach(el => {
            el.disabled = false;
        });
    } else {
        if (overlay) overlay.classList.remove("hidden");
        if (botIndicator) botIndicator.style.backgroundColor = "var(--danger)";
        if (botText) botText.textContent = isOnline ? "Outside Room" : "Offline";
        if (headerLiveDot) headerLiveDot.style.backgroundColor = "var(--danger)";

        if (overlayBotStatus) {
            overlayBotStatus.textContent = isOnline ? "Connected to Game" : "Disconnected / Offline";
            overlayBotStatus.className = `step-val ${isOnline ? "text-success" : "text-danger"}`;
        }
        if (overlayRoomStatus) {
            overlayRoomStatus.textContent = isInRoom ? "Inside Room" : (customMsg || "Not Joined to Room");
            overlayRoomStatus.className = `step-val ${isInRoom ? "text-success" : "text-warning"}`;
        }

        interactiveElements.forEach(el => {
            el.disabled = true;
        });
    }
}

/**
 * Theme Toggle Manager (R-21 & R-34)
 * Allows users to toggle between Light & Dark themes with localStorage persistence.
 */
function initThemeToggle() {
    const toggleBtn = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon");
    if (!toggleBtn) return;

    // Check saved preference or default to dark
    const savedTheme = localStorage.getItem("nava_theme") || "dark";
    applyTheme(savedTheme);

    toggleBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        localStorage.setItem("nava_theme", nextTheme);
        showToast(`Theme switched to ${nextTheme === "dark" ? "Dark Mode" : "Light Mode"}`, "info");
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        if (themeIcon) {
            themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
        }
    }
}

