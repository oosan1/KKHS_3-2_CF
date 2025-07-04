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
app.use('/camera', express.static(path.join(__dirname, 'public/client_camera')));
app.use('/control', express.static(path.join(__dirname, 'public/client_mainControl')));
app.use('/navi', express.static(path.join(__dirname, 'public/client_navi2')));

// ルーティング
app.get('/camera', (req, res) => {
    res.sendFile(path.join(__dirname, 'client_camera', 'index.html'));
});

app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, 'client_mainControl', 'index.html'));
});
app.get('/navi', (req, res) => {
    res.sendFile(path.join(__dirname, 'client_navi2', 'index.html'));
});

// 接続しているクライアントAを管理
let clientsA = {}; // { socketId: number }
let controlSocket = null;
let naviSocket = null;

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // カメラクライアントの登録
    socket.on('register-client-a', (number) => {
        clientsA[socket.id] = number;
        console.log(`Client A registered: Socket ${socket.id} is Number ${number}`);
        // 制御クライアントに接続状況を通知
        if (controlSocket) {
            controlSocket.emit('update-client-list', Object.values(clientsA));
        }
    });

    // コントロールクライアントの登録
    socket.on('register-control-client', () => {
        controlSocket = socket;
        console.log(`Control Client registered: ${socket.id}`);
    });

    // ナビクライアントの登録
    socket.on('register-client-navi', () => {
        naviSocket = socket;
        console.log(`Client Navi registered: ${socket.id}`);
    });

    // 進行管理
    // ナビの案内
    socket.on('control-start-navi', (data) => {
        console.log(data);
        io.emit('command-start-navi', data);
    });

    // 正誤判定を開始
    socket.on('control-TrueOrFalse', () => {
        console.log("TF");
        io.emit('command-TrueOrFalse');
    })

    // 
    socket.on('control-sound', (data) => {
        io.emit('command-sound', data);
    })

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
                photoData: data.photoData,
                pictureCount: data.pictureCount
            });
            console.log("写真を受信");
        }
    });

    socket.on('control-showImages', (data) => {
        io.emit('command-showImages', {photos: data.photoData})
    })

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
    console.log(`Access Client camera via: http://${localIpAddress}:${PORT}/camera?serverUrl=http://${localIpAddress}:${PORT}`);
    console.log(`Access Client navi via: http://${localIpAddress}:${PORT}/navi?serverUrl=http://${localIpAddress}:${PORT}`);
    console.log(`Access Client control via: http://${localIpAddress}:${PORT}/control?serverUrl=http://${localIpAddress}:${PORT}`);
    console.log("========HTTPS========");
    console.log(`Server is running on https://${localIpAddress}:${PORT}`);
    console.log(`Access Client camera via: https://${localIpAddress}:${PORT}/camera?serverUrl=https://${localIpAddress}:${PORT}`);
    console.log(`Access Client navi via: https://${localIpAddress}:${PORT}/navi?serverUrl=https://${localIpAddress}:${PORT}`);
    console.log(`Access Client control via: https://${localIpAddress}:${PORT}/control?serverUrl=https://${localIpAddress}:${PORT}`);
});