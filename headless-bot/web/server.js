/**
 * Embedded Web Server & REST API for Nava Music Bot
 * Serves real-time dashboard displaying current playback, song queue, requester info,
 * room status, and handles interactive bot controls (music, chat, expressions, room admin).
 * Features Server-Sent Events (SSE) for instant real-time auto-refresh on any bot input.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

let serverInstance = null;
const sseClients = new Set();
let statusProvider = null;

/**
 * Broadcasts status update instantly to all connected browser dashboards via SSE.
 */
function notifyWebUpdate() {
    if (typeof statusProvider !== "function" || sseClients.size === 0) return;
    try {
        const data = statusProvider();
        const json = JSON.stringify(data);
        for (const client of sseClients) {
            client.write(`data: ${json}\n\n`);
        }
    } catch (err) {
        console.error("❌ [SSE Broadcast Error]:", err.message);
    }
}

function startWebServer(port, getStatus, handleAction) {
    if (serverInstance) return serverInstance;
    statusProvider = getStatus;

    const server = http.createServer(async (req, res) => {
        // Set basic CORS and security headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            return res.end();
        }

        const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const pathname = parsedUrl.pathname;

        // Server-Sent Events (SSE): Real-time push updates for 0ms dashboard refresh
        if (req.method === "GET" && (pathname === "/api/events" || pathname === "/api/stream")) {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            });

            // Send initial state immediately
            const initialData = typeof getStatus === "function" ? getStatus() : {};
            res.write(`data: ${JSON.stringify(initialData)}\n\n`);

            sseClients.add(res);

            req.on("close", () => {
                sseClients.delete(res);
            });
            return;
        }

        // REST API: Live status polling fallback
        if (req.method === "GET" && pathname === "/api/status") {
            res.writeHead(200, {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            });
            const data = typeof getStatus === "function" ? getStatus() : {};
            return res.end(JSON.stringify(data));
        }

        // REST API: Control bot actions (Music, Chat, Expressions, Room Admin)
        if (req.method === "POST" && pathname === "/api/action") {
            // Guard: Website and controls are only active when bot is online & inside a room
            const status = typeof getStatus === "function" ? getStatus() : {};
            const isBotActive = status.bot && status.bot.isOnline && status.room && status.room.isInRoom;

            if (!isBotActive) {
                res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
                return res.end(JSON.stringify({
                    success: false,
                    error: "Bot is offline or not currently inside a room. Controls are disabled.",
                }));
            }

            let body = "";
            req.on("data", (chunk) => {
                body += chunk;
                if (body.length > 1e6) {
                    req.destroy();
                }
            });

            req.on("end", async () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (typeof handleAction !== "function") {
                        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
                        return res.end(JSON.stringify({ success: false, error: "Bot action handler is not configured." }));
                    }

                    const result = await handleAction(parsed);
                    // Broadcast update to all SSE clients immediately after action
                    notifyWebUpdate();

                    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                    return res.end(JSON.stringify(result || { success: true }));
                } catch (err) {
                    console.error("❌ [API Action Error]:", err);
                    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
                    return res.end(JSON.stringify({ success: false, error: err.message || "Failed to process action." }));
                }
            });
            return;
        }

        // Helper to assemble HTML partials/components
        function renderHtmlWithPartials(fileContent) {
            const includeRegex = /<!--\s*include:\s*([a-zA-Z0-9_\-\.\/]+)\s*-->/g;
            return fileContent.replace(includeRegex, (match, relPath) => {
                try {
                    const compPath = path.join(PUBLIC_DIR, relPath);
                    if (fs.existsSync(compPath)) {
                        return fs.readFileSync(compPath, "utf-8");
                    }
                } catch (e) {
                    console.error(`Failed to include component ${relPath}:`, e.message);
                }
                return match;
            });
        }

        // Static file serving
        let reqFile = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
        // Prevent directory traversal
        const safePath = path.normalize(reqFile).replace(/^(\.\.[\/\\])+/, "");
        const filePath = path.join(PUBLIC_DIR, safePath);

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                // Fallback to index.html for SPA if not found
                const indexPath = path.join(PUBLIC_DIR, "index.html");
                fs.readFile(indexPath, "utf-8", (readErr, content) => {
                    if (readErr) {
                        res.writeHead(404, { "Content-Type": "text/plain" });
                        return res.end("404 Not Found");
                    }
                    const rendered = renderHtmlWithPartials(content);
                    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(rendered);
                });
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";

            if (ext === ".html") {
                fs.readFile(filePath, "utf-8", (readErr, content) => {
                    if (readErr) {
                        res.writeHead(500, { "Content-Type": "text/plain" });
                        return res.end("500 Internal Server Error");
                    }
                    const rendered = renderHtmlWithPartials(content);
                    res.writeHead(200, { "Content-Type": contentType });
                    res.end(rendered);
                });
            } else {
                fs.readFile(filePath, (readErr, content) => {
                    if (readErr) {
                        res.writeHead(500, { "Content-Type": "text/plain" });
                        return res.end("500 Internal Server Error");
                    }
                    res.writeHead(200, { "Content-Type": contentType });
                    res.end(content);
                });
            }
        });
    });

    server.listen(port, () => {
        console.log(`🌐 [Web Dashboard] Running at: http://localhost:${port}`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.warn(`⚠️ [Web Dashboard] Port ${port} is already in use. Retrying on port ${port + 1}...`);
            startWebServer(port + 1, getStatus, handleAction);
        } else {
            console.error("❌ [Web Dashboard Error]:", err.message);
        }
    });

    serverInstance = server;
    return server;
}

function stopWebServer() {
    for (const client of sseClients) {
        try { client.end(); } catch (e) {}
    }
    sseClients.clear();

    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
        console.log("🛑 [Web Dashboard] Server stopped.");
    }
}

module.exports = {
    startWebServer,
    stopWebServer,
    notifyWebUpdate,
};
