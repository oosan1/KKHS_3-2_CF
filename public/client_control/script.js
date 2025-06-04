const DEFAULT_SOCKET_IO_URL = 'http://localhost:3000';
let socket;

// --- DOM要素の取得 ---
const modeSelector = document.getElementById('mode-selector');
const modePanels = document.querySelectorAll('.mode-panel');
const clientCountSpan = document.getElementById('client-count');
const photoGallery = document.getElementById('photo-gallery');
const socketIoUrlInput = document.getElementById('socket-io-url');
const connectToServerBtn = document.getElementById('connect-to-server-btn');

// URLクエリパラメータからURLを読み込む
const urlParams = new URLSearchParams(window.location.search);
const queryUrl = urlParams.get('serverUrl');
if (queryUrl) {
    socketIoUrlInput.value = queryUrl;
} else {
    socketIoUrlInput.value = DEFAULT_SOCKET_IO_URL;
}

connectToServerBtn.addEventListener('click', () => {
    const serverUrl = socketIoUrlInput.value;
    if (socket) {
        socket.disconnect(); // 既存の接続を切断
    }
    socket = io.connect(serverUrl);
    initializeSocketEvents(); // ソケットイベントリスナーを再初期化
});

// --- 共通 ---
let connectedClients = [];

// モード切り替え
modeSelector.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        const targetMode = e.target.dataset.mode;
        
        // 全てのパネルを非表示
        modePanels.forEach(panel => panel.classList.add('hidden'));
        // 対象のパネルを表示
        document.getElementById(`${targetMode}-mode`).classList.remove('hidden');

        // ボタンのアクティブ状態を更新
        modeSelector.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
    }
});

// 1-30のボタンを生成して各グリッドに追加
function createClientButtons() {
    const grids = document.querySelectorAll('.client-buttons-grid');
    grids.forEach(grid => {
        grid.innerHTML = ''; // 初期化
        for (let i = 1; i <= 30; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.dataset.number = i;
            btn.classList.add('client-btn');
            grid.appendChild(btn);
        }
    });
}

// ボタンの状態を更新
function updateButtonStates() {
    const allButtons = document.querySelectorAll('.client-btn');
    allButtons.forEach(btn => {
        const num = btn.dataset.number;
        if (connectedClients.includes(parseInt(num))) {
            btn.classList.add('connected');
        } else {
            btn.classList.remove('connected');
        }
    });
    clientCountSpan.textContent = connectedClients.length;
}

// --- 機能①: 画面色変更 ---
const colorPicker = document.getElementById('color-picker');
const colorAllBtn = document.getElementById('color-all-btn');
const colorClientsGrid = document.getElementById('color-clients');

colorAllBtn.addEventListener('click', () => {
    socket.emit('control-change-color', { target: 'all', color: colorPicker.value });
});
colorClientsGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('client-btn')) {
        const number = e.target.dataset.number;
        socket.emit('control-change-color', { target: number, color: colorPicker.value });
    }
});

// --- 機能②: 番号確認 ---
document.getElementById('show-number-btn').addEventListener('click', () => {
    socket.emit('control-show-number');
});

// --- 機能③: 音声再生 ---
const audioClientsGrid = document.getElementById('audio-clients');
document.getElementById('audio-bgm-btn').addEventListener('click', () => {
    socket.emit('control-play-audio', { target: 'all' });
});
document.getElementById('audio-stop-btn').addEventListener('click', () => {
    socket.emit('control-stop-audio');
});
document.getElementById('volume-set-btn').addEventListener('click', () => {
    const volume = document.getElementById('volume-slider').value;
    socket.emit('control-set-volume', { volume: parseFloat(volume) });
});
audioClientsGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('client-btn')) {
        const number = e.target.dataset.number;
        socket.emit('control-play-audio', { target: number });
    }
});

// --- 機能④: 画像撮影 ---
const shotCountInput = document.getElementById('shot-count');
document.getElementById('start-shooting-btn').addEventListener('click', () => {
    const count = parseInt(shotCountInput.value, 10);
    if (count > 0) {
        socket.emit('control-start-shooting', { count });
        // ギャラリーを初期化
        photoGallery.innerHTML = '';
        connectedClients.forEach(num => {
            const container = document.createElement('div');
            container.id = `photo-container-${num}`;
            container.classList.add('photo-container');
            container.innerHTML = `<h3>Client ${num}</h3>`;
            photoGallery.appendChild(container);
        });
    }
});
document.getElementById('stop-shooting-btn').addEventListener('click', () => {
    socket.emit('control-stop-shooting');
});


// --- Socketイベントリスナー ---
function initializeSocketEvents() {
    socket.on('connect', () => {
        socket.emit('register-control-client');
        console.log("connected");
    });

    socket.on('update-client-list', (clients) => {
        connectedClients = clients;
        updateButtonStates();
    });

    socket.on('photo-from-client', (data) => {
        const container = document.getElementById(`photo-container-${data.number}`);
        if (container) {
            const img = document.createElement('img');
            img.src = data.photoData;
            container.appendChild(img);
        }
    });
}

// --- 初期化処理 ---
createClientButtons();
document.querySelector('#mode-selector button').click(); // 最初のモードをアクティブにする