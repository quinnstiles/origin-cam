import 'dotenv/config';

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

// ========================================
// SESSION MANAGER
// ========================================

import {
    restoreSessions
} from './session-manager.js';

// ========================================
// API ROUTES
// ========================================

import auth from './api/auth.js';
import profile from './api/profile.js';

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

    '.html':
        'text/html',

    '.css':
        'text/css',

    '.js':
        'application/javascript',

    '.json':
        'application/json',

    '.png':
        'image/png',

    '.jpg':
        'image/jpeg',

    '.jpeg':
        'image/jpeg',

    '.svg':
        'image/svg+xml',

    '.ico':
        'image/x-icon'
};

// ========================================
// HELPERS
// ========================================

function sendJson(res, status, data) {

    if (res.headersSent) {
        return;
    }

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(
        JSON.stringify(data)
    );
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

    return new Promise(
        (resolve, reject) => {

            let body = '';

            req.on(
                'data',
                chunk => {

                    body +=
                        chunk.toString();

                    // safety limit
                    if (
                        body.length >
                        10e6
                    ) {
                        reject(
                            new Error(
                                'Body too large'
                            )
                        );
                    }
                }
            );

            req.on(
                'end',
                () => {

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
                }
            );

            req.on(
                'error',
                reject
            );
        }
    );
}

// ========================================
// SERVER
// ========================================

const server =
    http.createServer(
        async (req, res) => {

            try {

                applyCors(res);

                // ====================================
                // OPTIONS
                // ====================================

                if (
                    req.method === 'OPTIONS'
                ) {

                    res.writeHead(200);

                    res.end();

                    return;
                }

                // ====================================
                // PARSE BODY
                // ====================================

                req.body =
                    await parseBody(req);

                // ====================================
                // API ROUTES
                // ====================================

                // AUTH
                if (
                    req.method === 'POST' &&
                    req.url === '/api/auth'
                ) {

                    await auth(req, res);

                    return;
                }

                // PROFILE
                if (
                    req.method === 'POST' &&
                    req.url === '/api/profile'
                ) {

                    await profile(req, res);

                    return;
                }

                // START SESSION
                if (
                    req.method === 'POST' &&
                    req.url === '/api/start-session'
                ) {

                    await startSession(req, res);

                    return;
                }

                // BEGIN BILLING
                if (
                    req.method === 'POST' &&
                    req.url === '/api/begin-billing'
                ) {

                    await beginBilling(req, res);

                    return;
                }

                // END SESSION
                if (
                    req.method === 'POST' &&
                    req.url === '/api/end-session'
                ) {

                    await endSession(req, res);

                    return;
                }

                // HEARTBEAT
                if (
                    req.method === 'POST' &&
                    req.url === '/api/heartbeat'
                ) {

                    await heartbeat(req, res);

                    return;
                }

                // ====================================
                // HEALTH CHECK
                // ====================================

                if (
                    req.url === '/health'
                ) {

                    sendJson(res, 200, {
                        success: true,
                        server: 'online'
                    });

                    return;
                }

                // ====================================
                // STATIC WEBSITE
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

                // ====================================
                // SECURITY
                // ====================================

                if (
                    !filePath.startsWith(
                        publicDir
                    )
                ) {

                    sendJson(res, 403, {
                        error: 'Forbidden'
                    });

                    return;
                }

                // ====================================
                // STATIC FILE
                // ====================================

                fs.readFile(
                    filePath,
                    (err, content) => {

                        if (err) {

                            console.error(
                                'STATIC FILE ERROR:',
                                err.message
                            );

                            sendJson(res, 404, {
                                error: 'Not found'
                            });

                            return;
                        }

                        const ext =
                            path.extname(
                                filePath
                            );

                        const contentType =
                            mimeTypes[ext]
                            || 'application/octet-stream';

                        if (
                            res.headersSent
                        ) {
                            return;
                        }

                        res.writeHead(200, {
                            'Content-Type':
                                contentType
                        });

                        res.end(content);
                    }
                );

            }
            catch (err) {

                console.error(
                    'SERVER ERROR:',
                    err
                );

                sendJson(res, 500, {
                    error: err.message
                });

                return;
            }
        }
    );

// ========================================
// START SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;

server.listen(PORT, async () => {

    console.log(
        `SERVER RUNNING ON PORT ${PORT}`
    );

    // restore active sessions after restart
    await restoreSessions();
});