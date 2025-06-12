const DEFAULT_SOCKET_IO_URL = 'http://localhost:3000';
const AUDIO_FILE_COUNT = 4;
let socket;
let maxShot;

const initialSetup = document.getElementById('initial-setup');
const waitingScreen = document.getElementById('waiting-screen');
const numberDisplay = document.getElementById('number-display');
const numberSelect = document.getElementById('number-select');
const connectBtn = document.getElementById('connect-btn');
const audioPlayer = document.getElementById('audio-player');
const socketIoUrlInput = document.getElementById('server-url-input');
const galleryContainer = document.getElementById('gallery-container');
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffers = {}; // 音声ファイルのバッファを格納
let globalGainNode = audioContext.createGain(); // グローバルな音量ノード
globalGainNode.connect(audioContext.destination);
let lastPlayingSource = null; // 再生中止用

// すべての音声ファイルを読み込む
async function loadAudioFiles() {
    const audioFileNames = [];
    for (let i = 1; i <= AUDIO_FILE_COUNT; i++) {
        audioFileNames.push(`${String(i).padStart(3, '0')}.wav`);
    }
    //audioFileNames.push('BGM1.mp3');

    for (const fileName of audioFileNames) {
        const response = await fetch(`audio/${fileName}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers[fileName] = audioBuffer;
    }
}

const urlParams = new URLSearchParams(window.location.search);
const queryUrl = urlParams.get('serverUrl');
if (queryUrl) {
    socketIoUrlInput.value = queryUrl;
} else {
    socketIoUrlInput.value = DEFAULT_SOCKET_IO_URL;
}

// Shooting mode elements
const shootingMode = document.getElementById('shooting-mode');
const video = document.getElementById('video-feed');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const remainingShotsSpan = document.getElementById('remaining-shots');

let myNumber = -1;
let stream = null;
let remainingShots = 0;

// --- 初期設定 ---
// 番号のプルダウンを生成 (1-30)
for (let i = 1; i <= 30; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    numberSelect.appendChild(option);
}

// 接続ボタン
connectBtn.addEventListener('click', async () => {
    myNumber = numberSelect.value;
    const serverUrl = socketIoUrlInput.value;
    // iOS対策：ユーザー操作時に AudioContext を resume
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log("AudioContext resumed successfully.");
        } catch (e) {
            console.error("AudioContext resume failed:", e);
        }
    }
    await loadAudioFiles(); // ここで読み込む
    if (socket) {
        socket.disconnect(); // 既存の接続を切断
    }
    socket = io.connect(serverUrl);
    initializeSocketEvents(); // ソケットイベントリスナーを再初期化
    initialSetup.classList.add('hidden');
    showWaitingScreen();
});

function playAudioBuffer(fileName, when = 0, volume = 1.0) {
    const buffer = audioBuffers[fileName];
    if (!buffer) {
        console.warn(`音声バッファが見つかりません: ${fileName}`);
        return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    source.connect(globalGainNode);
    console.log(audioContext.currentTime + when);
    source.start(audioContext.currentTime + when);

    // 停止時に参照するため保持（複数同時再生も考慮するなら配列で管理）
    lastPlayingSource = source;
}

async function playAudio(fileName) {
    try {
        const audioBuffer = audioBuffers[fileName];
        return new Promise(resolve => {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = resolve; // 再生終了でPromiseを解決
            source.start();
        });
    } catch (error) {
        console.error('音声ファイルの読み込みまたは再生に失敗しました:', error);
        // エラーが発生してもPromiseを解決して処理を続行させる
        return Promise.resolve();
    }
}


// --- 画面表示制御 ---
function hideAllScreens() {
    waitingScreen.classList.add('hidden');
    numberDisplay.classList.add('hidden');
    shootingMode.classList.add('hidden');
    galleryContainer.classList.add('hidden');
    document.body.style.backgroundColor = '#000'; // Reset background
}

function showWaitingScreen() {
    hideAllScreens();
    waitingScreen.classList.remove('hidden');
    document.body.innerHTML = ''; // 他の要素をクリア
    document.body.appendChild(waitingScreen);
}

function showImagesScreen(photos) {
    console.log(photos);
    hideAllScreens();
    galleryContainer.classList.remove('hidden');
    document.body.appendChild(galleryContainer);
    galleryContainer.innerHTML = '';
    photos.forEach((src) => {
        const img = document.createElement('img');
        img.src = src;
        galleryContainer.appendChild(img);
    });
}


// --- Socketイベントリスナー ---
function initializeSocketEvents() {
    // 接続処理
    socket.on('connect', () => {
        socket.emit('register-client-a', myNumber);
    });
    
    // 撮影モード
    socket.on('command-start-navi', async (data) => {
        if (data.mode == "4th") {
            playAudio('001.wav');
            const msg = document.getElementById('waiting_message');
            msg.innerText = 'お取りください';
            /*
            hideAllScreens();
            shootingMode.classList.remove('hidden');
            document.body.appendChild(shootingMode); // body直下に追加

            remainingShots = data.count;
            remainingShotsSpan.textContent = remainingShots;
            captureBtn.disabled = false;

            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } } });
                video.srcObject = stream;
            } catch (err) {
                console.error("Error accessing camera: ", err);
                alert('カメラにアクセスできませんでした。');
            }*/
        }
        if (data.mode == "6th") {
            playAudioBuffer('002.wav', 0);
            hideAllScreens();
            shootingMode.classList.remove('hidden');
            document.body.appendChild(shootingMode); // body直下に追加

            remainingShots = data.count;
            maxShot = data.count
            remainingShotsSpan.textContent = remainingShots;
            captureBtn.disabled = false;

            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } } });
                video.srcObject = stream;
            } catch (err) {
                console.error("Error accessing camera: ", err);
                alert('カメラにアクセスできませんでした。');
            }
            await playAudio('003.wav');
        }
        if (data.mode == "7th") {
            showWaitingScreen();
            const msg = document.getElementById('waiting_message');
            msg.innerText = '';
        }


        if (data.mode == "search") {
            hideAllScreens();
            shootingMode.classList.remove('hidden');
            document.body.appendChild(shootingMode); // body直下に追加
            remainingShots = data.count;
            maxShot = data.count
            remainingShotsSpan.textContent = remainingShots;
            captureBtn.disabled = false;
            const lockMessage = document.getElementById('lockMessage');
            lockMessage.innerHTML = '';

            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } } });
                video.srcObject = stream;
            } catch (err) {
                console.error("Error accessing camera: ", err);
                alert('カメラにアクセスできませんでした。');
            }
        }
    });

    socket.on('command-sound', (data) => {
        console.log(data);
        if (data.mode == "check") {
            playAudio('004.wav');
        }
    })

    socket.on('command-stop-shooting', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        showWaitingScreen();
    });

    socket.on('command-showImages', (data) => {
        console.log(data);
        showImagesScreen(data.photos);
    })
};

// 撮影ボタンの処理
captureBtn.addEventListener('click', () => {
    if (remainingShots <= 0) return;

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoData = canvas.toDataURL('image/jpeg');
    socket.emit('photo-to-server', { photoData: photoData, pictureCount: maxShot - remainingShots + 1});

    remainingShots--;
    remainingShotsSpan.textContent = remainingShots;

    if (remainingShots <= 0) {
        captureBtn.disabled = true;
        const lockMessage = document.createElement('div');
        lockMessage.textContent = '撮影枚数の上限に達しました。';
        lockMessage.style.fontSize = '2em';
        lockMessage.style.color = 'yellow';
        lockMessage.style.marginTop = '20px';
        lockMessage.id = 'lockMessage'
        captureBtn.parentElement.appendChild(lockMessage);
    }
});