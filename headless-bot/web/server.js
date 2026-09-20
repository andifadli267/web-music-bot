/**
 * Embedded Web Server & REST API for Nava Music Bot
 * Serves real-time dashboard displaying current playback, song queue, requester info,
 * and current room location.
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

function startWebServer(port, getStatus) {
    if (serverInstance) return serverInstance;

    const server = http.createServer((req, res) => {
        // Set basic CORS and security headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            return res.end();
        }

        const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const pathname = parsedUrl.pathname;

        // REST API: Live status
        if (pathname === "/api/status") {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" });
            const data = typeof getStatus === "function" ? getStatus() : {};
            return res.end(JSON.stringify(data));
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
                fs.readFile(indexPath, (readErr, content) => {
                    if (readErr) {
                        res.writeHead(404, { "Content-Type": "text/plain" });
                        return res.end("404 Not Found");
                    }
                    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(content);
                });
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";

            fs.readFile(filePath, (readErr, content) => {
                if (readErr) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    return res.end("500 Internal Server Error");
                }
                res.writeHead(200, { "Content-Type": contentType });
                res.end(content);
            });
        });
    });

    server.listen(port, () => {
        console.log(`🌐 [Web Dashboard] Running at: http://localhost:${port}`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.warn(`⚠️ [Web Dashboard] Port ${port} is already in use. Retrying on port ${port + 1}...`);
            startWebServer(port + 1, getStatus);
        } else {
            console.error("❌ [Web Dashboard Error]:", err.message);
        }
    });

    serverInstance = server;
    return server;
}

function stopWebServer() {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
    }
}

module.exports = {
    startWebServer,
    stopWebServer,
};
