const express = require('express');
const app = express();
const http = require('http').createServer(app);
const https = require('https');
const net = require('net');
const url = require('url');
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const cors = require('cors');
const httpProxy = require('http-proxy');
const { v4: uuidv4 } = require('uuid');
const ca = require('./ca'); // Import CA module
const fs = require('fs');

// Initialize CA
ca.initCA();

// Dashboard / API Server
app.use(cors());
app.use(express.json());

// Serve CA Cert
app.get('/cert', (req, res) => {
    res.download(ca.getRootCertPath(), 'CyberProxy_CA.crt');
});

const DASHBOARD_PORT = 3000;
const PROXY_PORT = 8080;
const MITM_PORT = 8081; // Internal port for HTTPS interception

app.get('/', (req, res) => {
    res.send('Proxy Dashboard API Running. Download CA at <a href="/cert">/cert</a>');
});

// Store connected clients
io.on('connection', (socket) => {
    console.log('Dashboard client connected');
});

http.listen(DASHBOARD_PORT, () => {
    // Listen on 0.0.0.0 for mobile access
    console.log(`Dashboard API running on port ${DASHBOARD_PORT}`);
});

// ==========================================
// MITM HTTPS Server (The "Man in the Middle")
// ==========================================
// This server receives the decrypted traffic effectively (after we handle the handshake)
// actually, the TLS server handles the handshake, then emits 'request'.

const mitmProxy = httpProxy.createProxyServer({});

const mitmServer = https.createServer({
    SNICallback: (hostname, cb) => {
        // Generate cert for this hostname on the fly
        console.log(`[MITM] Generating cert for ${hostname}`);
        const { key, cert } = ca.generateServerCert(hostname);

        // Return SecureContext
        const ctx = require('tls').createSecureContext({
            key: key,
            cert: cert,
            ca: fs.readFileSync(ca.getRootCertPath()) // Optional chain
        });
        cb(null, ctx);
    },
    // Default cert (needed for initial start, though SNI usually takes over)
    // We can use a dummy cert or the root cert (not ideal but works for placeholder)
    ...ca.generateServerCert('localhost')
}, (req, res) => {
    const requestId = uuidv4();
    const startTime = Date.now();

    const requestData = {
        id: requestId,
        method: req.method,
        url: `https://${req.headers.host}${req.url}`, // Reconstruct full URL
        headers: req.headers,
        timestamp: startTime,
        protocol: 'https'
    };

    console.log(`[MITM] Request: ${requestData.method} ${requestData.url}`);
    io.emit('request', requestData);

    // Forward to actual destination
    // req.url is just the path (e.g., /foo), we need to proxy to https://host/foo
    mitmProxy.web(req, res, {
        target: `https://${req.headers.host}`,
        secure: false
    }, (e) => {
        console.error('[MITM] Proxy error:', e.message);
        io.emit('error', { id: requestId, error: e.message });
    });
});

mitmServer.listen(MITM_PORT, () => {
    console.log(`MITM Server listening on port ${MITM_PORT}`);
});

// Capture Responses from MITM
mitmProxy.on('proxyRes', function (proxyRes, req, res) {
    // emitted similar to http proxy
    // Simplified logging for now
    // We need to match requestId. We can attach it to req in the callback above.
    // For now just basic logging
});


// ==========================================
// Main Proxy Server (Entry Point)
// ==========================================
const proxy = httpProxy.createProxyServer({});
const proxyServer = require('http').createServer((req, res) => {
    // Handle Standard HTTP
    const requestId = uuidv4();
    const startTime = Date.now();
    console.log(`[HTTP] Request: ${req.method} ${req.url}`);

    io.emit('request', {
        id: requestId,
        method: req.method,
        url: req.url,
        headers: req.headers,
        timestamp: startTime,
        protocol: 'http'
    });

    proxy.web(req, res, { target: req.url, secure: false }, (e) => {
        console.error('Proxy error:', e);
    });
});

// Handle CONNECT (HTTPS Tunnels)
proxyServer.on('connect', (req, clientSocket, head) => {
    console.log(`[Proxy] CONNECT request for ${req.url}`);

    // Connect to our internal MITM server
    const proxySocket = net.connect(MITM_PORT, 'localhost', () => {
        // Acknowledge the CONNECT to the client
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        // Pipe data between client and MITM server
        // The client thinks it's talking to the target, but it's talking to our MITM server
        // Our MITM server will perform the TLS handshake.
        proxySocket.write(head);
        proxySocket.pipe(clientSocket);
        clientSocket.pipe(proxySocket);
    });

    proxySocket.on('error', (e) => {
        console.error('[Proxy] Socket error:', e);
        clientSocket.end();
    });

    clientSocket.on('error', (e) => {
        console.error('[Client] Socket error:', e);
        proxySocket.end();
    });
});

proxyServer.listen(PROXY_PORT, () => {
    console.log(`Proxy Server running on port ${PROXY_PORT}`);
});
