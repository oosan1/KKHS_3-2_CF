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
let ipad_photos = {};
let photo_count = 0;

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

// 進行管理
const naviStartBtn = document.getElementById('navi-start-button');
const navi_2thBtn = document.getElementById('navi-2-button');
const navi_ringBtn = document.getElementById('navi-ring-button');
const navi_3thBtn = document.getElementById('navi-3-button');
const navi_4thBtn = document.getElementById('navi-4-button');
const navi_5thBtn = document.getElementById('navi-5-button');
const navi_6thBtn = document.getElementById('navi-6-button');
const navi_7thBtn = document.getElementById('navi-7-button');
const navi_8thBtn = document.getElementById('navi-8-button');
const navi_9thBtn = document.getElementById('navi-9-button');
const navi_10thBtn = document.getElementById('navi-10-button');
//const navi1thBtn = document.getElementById('navi-1th-button');
const shotCountInput = document.getElementById('shot-count');

let pictureTF = {};

naviStartBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: 'start'});
})
navi_2thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '2th'});
})
navi_ringBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: 'ring'});
})
navi_3thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '3th'});
});
navi_4thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '4th'});
});
navi_5thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '5th'});
});
navi_6thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '6th', count: 1});
    // ギャラリーを初期化
    photoGallery.innerHTML = '';
    connectedClients.forEach(num => {
        const container = document.createElement('div');
        container.id = `photo-container-${num}`;
        container.classList.add('photo-container');
        container.innerHTML = `<h3>iPad ${num}</h3>`;
        photoGallery.appendChild(container);
    });
});
navi_7thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '7th'});
})
navi_8thBtn.addEventListener('click', () => {
    const shutter_count = parseInt(shotCountInput.value, 10);
    socket.emit('control-start-navi', {mode: 'search', count: shutter_count});
    // ギャラリーを初期化
    ipad_photos = {};
    photoGallery.innerHTML = '';
    connectedClients.forEach(num => {
        const container = document.createElement('div');
        container.id = `photo-container-${num}`;
        container.classList.add('photo-container');
        container.innerHTML = `<h3>iPad ${num}</h3>`;
        photoGallery.appendChild(container);
    });
})
navi_9thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: 'ring'});
})
navi_10thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '8th'});
})
navi_11thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '9th', count: photo_count});
    photo_count = 0;
})
navi_12thBtn.addEventListener('click', () => {
    socket.emit('control-start-navi', {mode: '10th'});
})
/*navi1thBtn.addEventListener('click', () => {
    const count = parseInt(shotCountInput.value, 10);
    socket.emit('control-start-navi', {mode: '1th', count: count});
})*/


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
    const currentTime = new Date().getTime(); // 現在時刻をミリ秒で取得
    const oneSecondLater = currentTime + 1000; // 1秒後を計算
    socket.emit('control-play-audio', { target: 'all', time: oneSecondLater});
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
//const shotCountInput = document.getElementById('shot-count');
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
            img.dataset.photonumber = data.number;
            img.dataset.count = data.pictureCount;
            const dynamicKey = String(data.pictureCount)
            if (!pictureTF[data.number]) {
                pictureTF[data.number] = {}
            }
            if (!ipad_photos[data.number]) {
                ipad_photos[data.number] = {}
            }
            pictureTF[data.number][dynamicKey] = true;
            ipad_photos[data.number][dynamicKey] = data.photoData;
            container.appendChild(img);

            const status_p = document.createElement('p');
            status_p.innerText = "NaN";
            container.appendChild(status_p);

            img.addEventListener('click', {pict_status: status_p, pict: img, handleEvent: function (e) {
                const img_bool = pictureTF[this.pict.dataset.photonumber][this.pict.dataset.count];
                if (img_bool) {
                    this.pict_status.innerText = "✖";
                    pictureTF[this.pict.dataset.photonumber][this.pict.dataset.count] = false;
                }else {
                    this.pict_status.innerText = "〇";
                    pictureTF[this.pict.dataset.photonumber][this.pict.dataset.count] = true;
                }
            }})
        }
    });

    socket.on('command-TrueOrFalse', () => {
        let photos = []
        for (let number in ipad_photos) {
            for (let count in ipad_photos[number]) {
                if (pictureTF[number][count]) {
                    photos.push(ipad_photos[number][count]);
                    photo_count++;
                }
            }
        }
        socket.emit('control-showImages', {photoData: photos})
        console.log(photos);
    });
}

// --- 初期化処理 ---
createClientButtons();
document.querySelector('#mode-selector button').click(); // 最初のモードをアクティブにする