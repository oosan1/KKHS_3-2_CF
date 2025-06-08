const express = require('express');
const https = require('https');
//const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const options = {
        key: fs.readFileSync("server-key.pem"),
        cert: fs.readFileSync("server-cert.pem")
};
const server = https.createServer(options, app);
//const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// クライアントAとクライアントBの静的ファイルを提供
app.use('/multiple', express.static(path.join(__dirname, 'public/client_multiple')));
app.use('/control', express.static(path.join(__dirname, 'public/client_control')));

// ルーティング
app.get('/multiple', (req, res) => {
    res.sendFile(path.join(__dirname, 'client_multiple', 'index.html'));
});

app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, 'client_control', 'index.html'));
});

// 接続しているクライアントAを管理
let clientsA = {}; // { socketId: number }
let controlSocket = null;

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // クライアントAの登録
    socket.on('register-client-a', (number) => {
        clientsA[socket.id] = number;
        console.log(`Client A registered: Socket ${socket.id} is Number ${number}`);
        // 制御クライアントに接続状況を通知
        if (controlSocket) {
            controlSocket.emit('update-client-list', Object.values(clientsA));
        }
    });

    // クライアントBの登録
    socket.on('register-control-client', () => {
        controlSocket = socket;
        console.log(`Control Client B registered: ${socket.id}`);
        socket.emit('update-client-list', Object.values(clientsA));
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (clientsA[socket.id]) {
            delete clientsA[socket.id];
            // 制御クライアントに接続状況を通知
            if (controlSocket) {
                controlSocket.emit('update-client-list', Object.values(clientsA));
            }
        }
        if (socket.id === controlSocket?.id) {
            controlSocket = null;
            console.log('Control Client B disconnected.');
        }
    });

    // --- 制御クライアントからのイベント ---

    // 色変更
    socket.on('control-change-color', (data) => {
        if (data.target === 'all') {
            io.emit('command-change-color', data.color);
        } else {
            const targetSocketId = Object.keys(clientsA).find(id => clientsA[id] == data.target);
            if (targetSocketId) {
                io.to(targetSocketId).emit('command-change-color', data.color);
            }
        }
    });

    // 番号確認
    socket.on('control-show-number', () => {
        Object.keys(clientsA).forEach(socketId => {
            io.to(socketId).emit('command-show-number', clientsA[socketId]);
        });
    });

    // 音声再生
    socket.on('control-play-audio', (data) => {
        if (data.target === 'all') {
            io.emit('command-play-audio', { type: 'bgm', time: data.time});
        } else {
             const targetSocketId = Object.keys(clientsA).find(id => clientsA[id] == data.target);
            if (targetSocketId) {
                io.to(targetSocketId).emit('command-play-audio', { type: 'specific', number: data.target });
            }
        }
    });

    // 音量調整
    socket.on('control-set-volume', (data) => {
        io.emit('command-set-volume', data.volume);
    });

    // 音声停止
    socket.on('control-stop-audio', () => {
        io.emit('command-stop-audio');
    });

    // 撮影開始
    socket.on('control-start-shooting', (data) => {
        io.emit('command-start-shooting', { count: data.count });
    });
    
    // 撮影停止
    socket.on('control-stop-shooting', () => {
        io.emit('command-stop-shooting');
    });

    // 写真データをクライアントBへ転送
    socket.on('photo-to-server', (data) => {
        if (controlSocket) {
            const clientNumber = clientsA[socket.id];
            controlSocket.emit('photo-from-client', {
                number: clientNumber,
                photoData: data.photoData
            });
        }
    });

});

// --- IPアドレスを取得する関数 ---
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            // IPv4アドレスで、ループバックアドレスではないものを探す
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost'; // 見つからなかった場合はlocalhostを返す
}

const localIpAddress = getLocalIpAddress();

server.listen(PORT, () => {
    console.log("========HTTP========");
    console.log(`Server is running on http://${localIpAddress}:${PORT}`);
    console.log(`Access Client multiple via: http://${localIpAddress}:${PORT}/multiple?serverUrl=http://${localIpAddress}:${PORT}`);
    console.log(`Access Client control via: http://${localIpAddress}:${PORT}/control?serverUrl=http://${localIpAddress}:${PORT}`);
    console.log("========HTTPS========");
    console.log(`Server is running on https://${localIpAddress}:${PORT}`);
    console.log(`Access Client multiple via: https://${localIpAddress}:${PORT}/multiple?serverUrl=https://${localIpAddress}:${PORT}`);
    console.log(`Access Client control via: https://${localIpAddress}:${PORT}/control?serverUrl=https://${localIpAddress}:${PORT}`);
});