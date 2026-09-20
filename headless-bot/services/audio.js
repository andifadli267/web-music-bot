/**
 * Audio Conversion Service
 * Handles YouTube video search, audio extraction, conversion to MP3 (via yt-dlp & ffmpeg),
 * and disk space cleanup.
 */

const { execFile, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("ffmpeg-static");
const { CONVERT_DIR } = require("../config");
const { uploadAudio } = require("./uploader");

let pythonExecutable = "python";
let pythonArgsPrefix = ["-m", "yt_dlp"];

function detectPythonRuntime() {
    try {
        const out = execSync("python --version", { encoding: "utf8" }).trim();
        pythonExecutable = "python";
        pythonArgsPrefix = ["-m", "yt_dlp"];
        return out;
    } catch (_) {}

    try {
        const out = execSync("py -3 --version", { encoding: "utf8" }).trim();
        pythonExecutable = "py";
        pythonArgsPrefix = ["-3", "-m", "yt_dlp"];
        return `${out} (via py launcher)`;
    } catch (_) {}

    try {
        const out = execSync("yt-dlp --version", { encoding: "utf8" }).trim();
        pythonExecutable = "yt-dlp";
        pythonArgsPrefix = [];
        return `yt-dlp CLI v${out}`;
    } catch (_) {}

    return "Not detected";
}

/**
 * Automatically cleans up local audio files in converted_tracks/ and temp/
 * to ensure no leftover audio files occupy user's local disk space.
 */
function cleanLocalFiles(fileIdPattern = null) {
    const dirs = [CONVERT_DIR, path.join(__dirname, "..", "temp")];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                if (f === ".gitkeep") continue;
                if (!fileIdPattern || f.includes(fileIdPattern)) {
                    try {
                        const fullPath = path.join(dir, f);
                        if (fs.statSync(fullPath).isFile()) {
                            fs.unlinkSync(fullPath);
                            console.log(`🧹 [Clean-up] Removed local file: ${f}`);
                        }
                    } catch (e) {
                        // Ignore if locked briefly
                    }
                }
            }
        } catch (err) {
            console.warn("[Clean-up Warning]:", err.message);
        }
    }
}

/**
 * Attempts conversion via ytmp3.gg backend (https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo)
 */
async function convertViaYtmp3(youtubeUrl) {
    console.log(`[ytmp3.gg] Attempting API conversion: ${youtubeUrl}`);
    const res = await fetch("https://ytdl.convert1s.com/api/v2/download", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": "https://media.ytmp3.gg",
            "Referer": "https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo"
        },
        body: JSON.stringify({
            url: youtubeUrl,
            output: { type: "audio", format: "mp3" }
        })
    });

    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const job = await res.json();
    if (!job || !job.statusUrl) throw new Error("statusUrl not found");

    const title = job.title || "YouTube Audio";
    const statusUrl = job.statusUrl;

    for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const sRes = await fetch(statusUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://media.ytmp3.gg",
                "Referer": "https://media.ytmp3.gg/tools/youtube-video-downloader/cvswxo"
            }
        });
        if (!sRes.ok) continue;
        const sData = await sRes.json();
        if (sData.downloadUrl) {
            console.log(`[ytmp3.gg] Audio conversion complete! URL: ${sData.downloadUrl}`);
            const aRes = await fetch(sData.downloadUrl);
            const buf = await aRes.arrayBuffer();
            return { title, buffer: Buffer.from(buf), duration: job.duration || 0 };
        }
        if (sData.status === "error") throw new Error("Status error: " + (sData.error || sData.message));
    }
    throw new Error("ytmp3.gg queue took longer than 12 seconds");
}

/**
 * Fast local conversion via yt-dlp + ffmpeg directly in converted_tracks/ folder
 */
function convertViaYtDlp(queryOrUrl) {
    return new Promise((resolve, reject) => {
        const fileId = "track_" + Date.now();
        const outputPath = path.join(CONVERT_DIR, `${fileId}.%(ext)s`);
        const finalMp3Path = path.join(CONVERT_DIR, `${fileId}.mp3`);
        const titleFilePath = path.join(CONVERT_DIR, `${fileId}_title.txt`);
        const durationFilePath = path.join(CONVERT_DIR, `${fileId}_duration.txt`);

        const target = (queryOrUrl.startsWith("http://") || queryOrUrl.startsWith("https://")) 
            ? queryOrUrl 
            : `ytsearch1:${queryOrUrl}`;

        const args = [
            ...pythonArgsPrefix,
            "--no-cache-dir",
            "--ffmpeg-location", ffmpegPath,
            "-x", "--audio-format", "mp3",
            "--audio-quality", "5",
            "--max-filesize", "30M",
            "--no-playlist",
            "--print-to-file", "%(title)s", titleFilePath,
            "--print-to-file", "%(duration)s", durationFilePath,
            "-o", outputPath,
            target
        ];

        console.log(`[yt-dlp] Converting "${queryOrUrl}" using ${pythonExecutable} in folder: ${CONVERT_DIR}...`);
        execFile(pythonExecutable, args, { timeout: 75000 }, (err, stdout, stderr) => {
            let title = queryOrUrl;
            let duration = 0;

            if (fs.existsSync(titleFilePath)) {
                try {
                    title = fs.readFileSync(titleFilePath, "utf8").trim() || queryOrUrl;
                    fs.unlinkSync(titleFilePath);
                } catch(_) {}
            }

            if (fs.existsSync(durationFilePath)) {
                try {
                    const durRaw = fs.readFileSync(durationFilePath, "utf8").trim();
                    duration = parseInt(durRaw, 10) || 0;
                    fs.unlinkSync(durationFilePath);
                } catch(_) {}
            }

            if (err) {
                cleanLocalFiles(fileId);
                return reject(err);
            }

            if (!fs.existsSync(finalMp3Path)) {
                cleanLocalFiles(fileId);
                return reject(new Error("Converted MP3 file was not found."));
            }

            const buffer = fs.readFileSync(finalMp3Path);
            // Immediately clean up temporary local audio file after reading into memory
            cleanLocalFiles(fileId);
            resolve({ title, buffer, duration });
        });
    });
}

/**
 * Main YouTube -> MP3 -> public upload pipeline
 * Ensures converted audio file is deleted from local disk after upload.
 */
async function convertYoutubeToMp3(queryOrUrl) {
    let result = null;
    const isUrl = queryOrUrl.startsWith("http://") || queryOrUrl.startsWith("https://");

    try {
        if (isUrl && (queryOrUrl.includes("youtube.com") || queryOrUrl.includes("youtu.be"))) {
            try {
                result = await convertViaYtmp3(queryOrUrl);
            } catch (e) {
                console.log(`[YouTube] Info ytmp3.gg (${e.message}), switching automatically to fast local extractor...`);
            }
        }

        if (!result) {
            result = await convertViaYtDlp(queryOrUrl);
        }

        const safeTitle = (result.title || "song").replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 30);
        const filename = `${safeTitle}_${Date.now()}.mp3`;
        const directUrl = await uploadAudio(result.buffer, filename);

        // Free buffer memory and guarantee converted_tracks is clear
        result.buffer = null;
        cleanLocalFiles();

        console.log(`[YouTube] Success! Title: "${result.title}", Direct URL: ${directUrl}, Duration: ${result.duration}s`);
        console.log(`🧹 [Storage] Local converted file for "${result.title}" has been deleted from ${CONVERT_DIR}.`);
        return { title: result.title, directUrl, duration: result.duration || 0 };
    } catch (err) {
        cleanLocalFiles();
        throw err;
    }
}

module.exports = {
    detectPythonRuntime,
    cleanLocalFiles,
    convertYoutubeToMp3,
    convertViaYtDlp,
    convertViaYtmp3,
};

