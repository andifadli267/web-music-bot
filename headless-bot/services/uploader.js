/**
 * Multi-Provider Audio File Uploader
 * Uploads audio buffers to high-speed public file hosts that provide
 * direct .mp3 streaming links compatible with Bondage Club Room Customization.
 */

/**
 * Uploads converted MP3 to tmpfile.link (https://tmpfile.link/index-id)
 * Generates direct high-speed Cloudflare R2 links ending in .mp3
 */
async function uploadToTmpfileLink(buffer, filename = "track.mp3") {
    console.log(`[Upload tmpfile.link] Uploading ${filename} (${buffer.length} bytes)...`);
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch("https://tmpfile.link/api/upload", {
        method: "POST",
        body: formData,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://tmpfile.link/index-id",
            "Origin": "https://tmpfile.link"
        }
    });

    if (!res.ok) {
        throw new Error(`tmpfile.link upload HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data || !data.downloadLink) {
        throw new Error("Invalid response from tmpfile.link: " + JSON.stringify(data));
    }

    return data.downloadLink;
}

/**
 * Fallback uploader to tmpfiles.org if tmpfile.link is unavailable
 */
async function uploadToTmpfilesOrg(buffer, filename = "track.mp3") {
    console.log(`[Upload tmpfiles.org] Uploading fallback ${filename} (${buffer.length} bytes)...`);
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body: formData,
    });
    const data = await res.json();
    if (data && data.data && data.data.url) {
        return data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
    throw new Error("Failed to upload fallback to tmpfiles.org");
}

/**
 * Main audio upload function with automatic multi-provider fallback
 */
async function uploadAudio(buffer, filename) {
    try {
        return await uploadToTmpfileLink(buffer, filename);
    } catch (err) {
        console.warn("[Upload Warning] tmpfile.link failed (" + err.message + "), trying fallback tmpfiles.org...");
        return await uploadToTmpfilesOrg(buffer, filename);
    }
}

module.exports = {
    uploadAudio,
    uploadToTmpfileLink,
    uploadToTmpfilesOrg,
};

