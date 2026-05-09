import 'dotenv/config';

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

// ========================================
// START SESSION MANAGER
// ========================================

import './session-manager.js';

// ========================================
// API ROUTES
// ========================================

import startSession from './api/start-session.js';
import beginBilling from './api/begin-billing.js';
import endSession from './api/end-session.js';
import heartbeat from './api/heartbeat.js';

// ========================================
// PATHS
// ========================================

const __dirname =
    path.dirname(
        url.fileURLToPath(import.meta.url)
    );

const publicDir =
    path.join(__dirname, 'public');

// ========================================
// MIME TYPES
// ========================================

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// ========================================
// HELPERS
// ========================================

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(JSON.stringify(data));
}

function applyCors(res) {
    res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
    );

    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();

            // safety limit
            if (body.length > 10e6) {
                reject(
                    new Error('Body too large')
                );
            }
        });

        req.on('end', () => {
            try {
                resolve(
                    body
                        ? JSON.parse(body)
                        : {}
                );
            }
            catch {
                resolve({});
            }
        });

        req.on('error', reject);
    });
}

// ========================================
// SERVER
// ========================================

const server = http.createServer(
    async (req, res) => {
        try {
            applyCors(res);

            // ====================================
            // PREFLIGHT
            // ====================================

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // ====================================
            // PARSE BODY
            // ====================================

            req.body = await parseBody(req);

            // ====================================
            // API ROUTES
            // ====================================

            if (
                req.method === 'POST' &&
                req.url === '/api/start-session'
            ) {
                return startSession(req, res);
            }

            if (
                req.method === 'POST' &&
                req.url === '/api/begin-billing'
            ) {
                return beginBilling(req, res);
            }

            if (
                req.method === 'POST' &&
                req.url === '/api/end-session'
            ) {
                return endSession(req, res);
            }

            if (
                req.method === 'POST' &&
                req.url === '/api/heartbeat'
            ) {
                return heartbeat(req, res);
            }

            // ====================================
            // HEALTH CHECK
            // ====================================

            if (req.url === '/health') {
                return sendJson(res, 200, {
                    success: true,
                    server: 'online'
                });
            }

            // ====================================
            // STATIC FILES
            // ====================================

            let requestPath =
                req.url === '/'
                    ? '/index.html'
                    : req.url;

            let filePath =
                path.normalize(
                    path.join(
                        publicDir,
                        requestPath
                    )
                );

            // prevent path escape
            if (!filePath.startsWith(publicDir)) {
                return sendJson(res, 403, {
                    error: 'Forbidden'
                });
            }

            fs.readFile(
                filePath,
                (err, content) => {
                    if (err) {
                        console.error(
                            'STATIC FILE ERROR:',
                            err.message
                        );

                        return sendJson(res, 404, {
                            error: 'Not found'
                        });
                    }

                    const ext =
                        path.extname(filePath);

                    const contentType =
                        mimeTypes[ext] ||
                        'application/octet-stream';

                    res.writeHead(200, {
                        'Content-Type': contentType
                    });

                    res.end(content);
                });
        }
        catch (err) {
            console.error(
                'SERVER ERROR:',
                err
            );

            sendJson(res, 500, {
                error: err.message
            });
        }
    });

// ========================================
// START SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(
        `SERVER RUNNING ON PORT ${PORT}`
    );
});