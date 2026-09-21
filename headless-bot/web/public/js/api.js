/**
 * Backend API & Real-Time SSE Communication Module
 * Handles REST requests to /api/status, /api/action, and SSE stream from /api/events.
 */

const API_STATUS_URL = "/api/status";
const API_ACTION_URL = "/api/action";

async function sendBotAction(action, payload = {}) {
    if (typeof isBotActiveState !== "undefined" && !isBotActiveState) {
        showToast("Bot is offline or not currently inside a room. Action cancelled.", "error");
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
            const errText = data.error || data.message || "Failed to execute action.";
            showToast(errText, "error");
            return data;
        }

        showToast(data.message || "Action sent to bot successfully.", "success");
        if (typeof fetchStatus === "function") {
            fetchStatus();
        }
        return data;
    } catch (err) {
        console.error("Action error:", err);
        showToast(`Failed to reach server: ${err.message}`, "error");
        return { success: false, error: err.message };
    }
}

async function fetchStatus(onSuccess, onError) {
    try {
        const res = await fetch(API_STATUS_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (typeof onSuccess === "function") {
            onSuccess(data);
        } else if (typeof updateDashboard === "function") {
            updateDashboard(data);
        }
    } catch (err) {
        console.warn("[Dashboard Error] Failed to fetch bot status:", err.message);
        if (typeof onError === "function") {
            onError(err);
        } else if (typeof setOfflineState === "function") {
            setOfflineState(false, false, "Failed to reach Web Server");
        }
    }
}

function initEventStream(onUpdate) {
    if (!window.EventSource) return;

    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
        if (!event.data) return;
        try {
            const data = JSON.parse(event.data);
            if (typeof onUpdate === "function") {
                onUpdate(data);
            } else if (typeof updateDashboard === "function") {
                updateDashboard(data);
            }
        } catch (err) {
            console.warn("[SSE Warning] Failed to parse stream data:", err);
        }
    };

    eventSource.onerror = () => {
        console.warn("[SSE Info] Connection interrupted, reconnecting automatically...");
    };

    return eventSource;
}

