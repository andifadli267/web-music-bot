/**
 * Audio Player & Visualizer Module
 * Manages holographic vinyl disc rotation, track progress calculation,
 * and synchronized local browser audio playback.
 */

let localAudioPlaying = false;

function updatePlayerUI(playback) {
    playback = playback || {};
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

    if (playback.currentTrack) {
        const track = playback.currentTrack;
        if (trackTitleEl) trackTitleEl.textContent = track.title || "Unknown Track";
        if (trackSubEl) trackSubEl.textContent = "Sedang diputar tersinkronisasi untuk semua pemain di room";
        if (sourceBadgeEl) {
            sourceBadgeEl.textContent = "YouTube Audio";
            sourceBadgeEl.style.display = "inline-block";
        }

        // Requester Info
        if (requesterBoxEl) requesterBoxEl.style.display = "inline-flex";
        const reqName = track.requesterName || (track.requestedBy ? `Member #${track.requestedBy}` : "DJ");
        if (requesterNameEl) requesterNameEl.textContent = reqName;

        // Vinyl Animation
        if (vinylDiscEl) vinylDiscEl.classList.add("spinning");
        if (vinylIconEl) vinylIconEl.textContent = "🎶";

        // Duration & Progress Calculation
        const startedAt = track.startedAt || Date.now();
        const duration = track.duration || 0;
        const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

        if (duration > 0) {
            const pct = Math.min(100, Math.max(0, (elapsed / duration) * 100));
            if (progressBarFill) progressBarFill.style.width = `${pct}%`;
            if (timeCurrentEl) timeCurrentEl.textContent = formatTime(elapsed);
            if (timeTotalEl) timeTotalEl.textContent = formatTime(duration);
        } else {
            if (progressBarFill) progressBarFill.style.width = "100%";
            if (timeCurrentEl) timeCurrentEl.textContent = formatTime(elapsed);
            if (timeTotalEl) timeTotalEl.textContent = "Live";
        }

        // Sync Audio Source if user requested local browser listening
        if (webAudio && track.directUrl && webAudio.src !== track.directUrl) {
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
        if (trackTitleEl) trackTitleEl.textContent = st.name || "Live Radio";
        if (trackSubEl) trackSubEl.textContent = "Stasiun Radio Komersial 24/7 (Online Stream)";
        if (sourceBadgeEl) {
            sourceBadgeEl.textContent = "24/7 Radio";
            sourceBadgeEl.style.display = "inline-block";
        }

        if (requesterBoxEl) requesterBoxEl.style.display = "inline-flex";
        if (requesterNameEl) requesterNameEl.textContent = "Bot Radio";

        if (vinylDiscEl) vinylDiscEl.classList.add("spinning");
        if (vinylIconEl) vinylIconEl.textContent = "📻";

        if (progressBarFill) progressBarFill.style.width = "100%";
        if (timeCurrentEl) timeCurrentEl.textContent = "LIVE";
        if (timeTotalEl) timeTotalEl.textContent = "24/7";

        if (webAudio && st.url && webAudio.src !== st.url) {
            webAudio.src = st.url;
            if (localAudioPlaying) {
                webAudio.play().catch(e => console.warn("Audio play prevented:", e));
            }
        }
    } else {
        // Idle
        if (trackTitleEl) trackTitleEl.textContent = "Tidak ada musik yang diputar";
        if (trackSubEl) trackSubEl.textContent = "Gunakan form pemutar di bawah atau ketik !play di room chat";
        if (sourceBadgeEl) sourceBadgeEl.style.display = "none";
        if (requesterBoxEl) requesterBoxEl.style.display = "none";

        if (vinylDiscEl) vinylDiscEl.classList.remove("spinning");
        if (vinylIconEl) vinylIconEl.textContent = "🎵";

        if (progressBarFill) progressBarFill.style.width = "0%";
        if (timeCurrentEl) timeCurrentEl.textContent = "0:00";
        if (timeTotalEl) timeTotalEl.textContent = "0:00";

        if (webAudio && webAudio.src) {
            webAudio.pause();
            webAudio.src = "";
        }
    }
}

function toggleLocalAudioListen() {
    const btnListen = document.getElementById("btn-listen-web");
    const webAudio = document.getElementById("web-audio");
    const listenIcon = document.getElementById("listen-icon");
    const listenText = document.getElementById("listen-text");
    if (!webAudio || !btnListen) return;

    if (!localAudioPlaying) {
        if (webAudio.src) {
            webAudio.play().then(() => {
                localAudioPlaying = true;
                btnListen.classList.add("playing");
                if (listenIcon) listenIcon.textContent = "⏸️";
                if (listenText) listenText.textContent = "Hentikan Audio";
            }).catch(err => {
                showToast("Tidak dapat memutar audio: " + err.message, "error");
            });
        } else {
            showToast("Saat ini belum ada audio yang aktif di ruangan.", "info");
        }
    } else {
        webAudio.pause();
        localAudioPlaying = false;
        btnListen.classList.remove("playing");
        if (listenIcon) listenIcon.textContent = "🔊";
        if (listenText) listenText.textContent = "Dengarkan di Browser";
    }
}
