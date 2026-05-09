
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

// ========================================
// START SESSION MANAGER
// ========================================

import './session-manager.js';

// ========================================
// IMPORT API ROUTES
// ========================================

import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

import startSession from './api/start-session.js';
import beginBilling from './api/begin-billing.js';
import endSession from './api/end-session.js';
import heartbeat from './api/heartbeat.js';

// ========================================
// PUBLIC FOLDER
// ========================================

const __dirname =
    path.dirname(
        url.fileURLToPath(import.meta.url)
    );

const publicDir =
    path.join(__dirname, 'public');

// ========================================
// SERVER
// ========================================

const server = http.createServer(
    async (req, res) => {
        // ====================================
        // CORS
        // ====================================

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

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // ====================================
        // BODY PARSER
        // ====================================

        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                req.body =
                    body
                        ? JSON.parse(body)
                        : {};

                // ================================
                // API ROUTES
                // ================================

                if (
                    req.url === '/api/start-session'
                ) {
                    return startSession(req, res);
                }

                if (
                    req.url === '/api/begin-billing'
                ) {
                    return beginBilling(req, res);
                }

                if (
                    req.url === '/api/end-session'
                ) {
                    return endSession(req, res);
                }

                if (
                    req.url === '/api/heartbeat'
                ) {
                    return heartbeat(req, res);
                }

                // ================================
                // STATIC WEBSITE
                // ================================

                let filePath =
                    path.join(
                        publicDir,
                        req.url === '/'
                            ? 'index.html'
                            : req.url
                    );

                // prevent escape
                if (!filePath.startsWith(publicDir)) {
                    res.writeHead(403);
                    res.end('Forbidden');
                    return;
                }

                fs.readFile(
                    filePath,
                    (err, content) => {
                        if (err) {
                            res.writeHead(404);
                            res.end('Not found');
                            return;
                        }

                        let contentType =
                            'text/html';

                        if (filePath.endsWith('.css'))
                            contentType = 'text/css';

                        if (filePath.endsWith('.js'))
                            contentType =
                                'application/javascript';

                        if (filePath.endsWith('.png'))
                            contentType = 'image/png';

                        if (filePath.endsWith('.jpg'))
                            contentType = 'image/jpeg';

                        res.writeHead(200, {
                            'Content-Type':
                                contentType
                        });

                        res.end(content);
                    });
            }
            catch (err) {
                console.error(err);

                res.writeHead(500);

                res.end(
                    JSON.stringify({
                        error: err.message
                    })
                );
            }
        });
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