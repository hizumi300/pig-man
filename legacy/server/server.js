// server/server.js - 重複削除版（既存ファイルと置き換え）

const express = require('express');
const app = express();
const http = require('http').createServer(app);

// 🔧 【最適化】Render.com環境専用Socket.io設定
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: false
    },
    
    // Render.com環境専用設定
    transports: ['polling', 'websocket'],     // polling → websocket アップグレード
    allowEIO3: true,
    
    // 接続タイムアウト設定
    pingTimeout: 180000,                      // 3分
    pingInterval: 90000,                      // 1.5分
    connectTimeout: 60000,                    // 1分
    
    // アップグレード設定
    allowUpgrades: true,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e5,
    httpCompression: true,
    
    // セキュリティ設定
    serveClient: false,
    cookie: {
        name: 'io',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    },
    
    // CORS詳細設定
    allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        const allowedOrigins = [
            'http://localhost:3000',
            'https://*.onrender.com',
            process.env.CLIENT_URL
        ].filter(Boolean);
        
        if (process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            const allowed = !origin || allowedOrigins.some(allowed => 
                origin === allowed || origin.endsWith('.onrender.com')
            );
            callback(null, allowed);
        }
    }
});

// 🔧 Render.com環境でのログ設定
io.engine.on('connection_error', (err) => {
    console.log('🔧 Socket.io接続エラー:', {
        code: err.code,
        message: err.message,
        url: err.req?.url,
        origin: err.req?.headers?.origin
    });
});

io.engine.on('initial_headers', (headers, req) => {
    console.log('🔧 新規接続:', {
        url: req.url,
        userAgent: req.headers['user-agent']?.substring(0, 50),
        origin: req.headers.origin
    });
});

// 🔧 【統合】接続監視（重複削除）
setInterval(() => {
    const connectedSockets = io.sockets.sockets.size;
    const engineConnections = io.engine.clientsCount;
    
    console.log(`📊 Socket統計: ${connectedSockets}個接続中`);
    
    if (connectedSockets !== engineConnections) {
        console.warn('⚠️ Socket数不整合検出');
    }
    
    // 非アクティブ接続のクリーンアップ
    io.sockets.sockets.forEach((socket) => {
        if (!socket.connected) {
            console.log(`🧹 非アクティブSocket切断: ${socket.id}`);
            socket.disconnect(true);
        }
    });
}, 60000); // 1分間隔に統合

const path = require('path');
const fs = require('fs');

// エラーハンドリング
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 静的ファイル配信
const publicPath = path.join(__dirname, '../public');
console.log('Static files path:', publicPath);

if (!fs.existsSync(publicPath)) {
    console.error('Public directory does not exist:', publicPath);
    process.exit(1);
}

app.use(express.static(publicPath));

// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sockets: io.sockets.sockets.size
    });
});

// デバッグ情報
app.get('/debug', (req, res) => {
    try {
        const publicFiles = fs.readdirSync(publicPath);
        const cssPath = path.join(publicPath, 'css');
        const jsPath = path.join(publicPath, 'js');
        const imagesPath = path.join(publicPath, 'images');
        
        res.json({
            publicPath,
            publicFiles: publicFiles.slice(0, 10), // 最初の10個のみ
            cssFiles: fs.existsSync(cssPath) ? fs.readdirSync(cssPath) : ['CSS folder not found'],
            jsFiles: fs.existsSync(jsPath) ? fs.readdirSync(jsPath).slice(0, 10) : ['JS folder not found'],
            imageFiles: fs.existsSync(imagesPath) ? fs.readdirSync(imagesPath).slice(0, 10) : ['Images folder not found'],
            workingDirectory: process.cwd(),
            nodeVersion: process.version,
            platform: process.platform,
            environment: process.env.NODE_ENV || 'development',
            socketConnections: io.sockets.sockets.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// メインページ
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(publicPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
            return res.status(404).send('index.html not found');
        }
        res.sendFile(indexPath);
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Server error');
    }
});

// Socket.ioハンドラー設定
try {
    const { setupSocketHandlers } = require('./socketHandlers');
    setupSocketHandlers(io);
    console.log('✅ Socket handlers initialized');
} catch (error) {
    console.error('❌ Socket handlers initialization error:', error);
}

// 404ハンドラー
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// エラーハンドラー
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;

// サーバー起動
const server = http.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ サーバー起動: ポート ${PORT}`);
    console.log(`📁 Static files: ${publicPath}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Render.com最適化: 有効`);
});

// サーバーエラーハンドリング
server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔧 SIGTERM受信 - 正常終了開始');
    io.close(() => {
        server.close(() => {
            console.log('✅ 正常終了完了');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('🔧 SIGINT受信 - 正常終了開始');
    io.close(() => {
        server.close(() => {
            console.log('✅ 正常終了完了');
            process.exit(0);
        });
    });
});

module.exports = { app, server, io };
