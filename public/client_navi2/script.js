const TEST_MODE = false;

// ナビゲーターのベースカラー
const CHARACTER_BASE_COLOR = 0x800080;

// LocalStorageに保存する際のキー
const MASK_STORAGE_KEY = "houseMaskShape";

// 字幕の表示間隔(ms)
const DELAY_PER_CHAR = 200;

// ======== PIXIアプリケーションの初期化 ========
let app = new PIXI.Application();
document.body.appendChild(app.view);

// リサイズ処理
function resizeApp() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resizeApp);
resizeApp();

// 描画範囲
const MASK_POINTS = {
    centerX: 690,
    centerY: 355,
    width: 420,
    height: 300,
    roofHeight: 40
}

let mainContainer = new PIXI.Container();
app.stage.addChild(mainContainer);

// ======== Socket.ioの管理 ========
const connectButton = document.getElementById('connect-button');
const serverUrl = document.getElementById('server-url-input');

let socket;
DEFAULT_SOCKET_IO_URL = 'http://localhost:3000';
const urlParams = new URLSearchParams(window.location.search);
const queryUrl = urlParams.get('serverUrl');
if (queryUrl) {
    serverUrl.value = queryUrl;
} else {
    serverUrl.value = DEFAULT_SOCKET_IO_URL;
}

connectButton.addEventListener("click", async () => {
    // iOS対策：ユーザー操作時に AudioContext を resume
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log("AudioContext resumed successfully.");
        } catch (e) {
            console.error("AudioContext resume failed:", e);
        }
    }
    await loadAudioFiles()
    connectButton.style.display = "none";
    serverUrl.style.display = "none";
    await loadAudioFiles(); // ここで読み込む
    if (socket) {
        socket.disconnect(); // 既存の接続を切断
    }
    socket = io.connect(serverUrl.value);
    initializeSocketEvents(); // ソケットイベントリスナーを再初期化
})


// --- Socketイベントリスナー ---
function initializeSocketEvents() {
    // 接続処理
    socket.on('connect', () => {
        socket.emit('register-client-navi');
    });

    socket.on('command-start-navi', (data) => {
        if (data.mode == "start") {
            show1();
        }else if (data.mode == "iPad") {
            show2();
        }
    });
};

let audioBuffers = {}; // 音声ファイルのバッファを格納

// すべての音声ファイルを読み込む
async function loadAudioFiles() {
    const audioFileNames = [];
    for (let i = 1; i <= 3; i++) {
        audioFileNames.push(`${String(i).padStart(3, '0')}.wav`);
    }

    for (const fileName of audioFileNames) {
        const response = await fetch(`audio/navi/${fileName}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers[fileName] = audioBuffer;
    }
}

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

// ======== 字幕の管理 ========
const subtitleElement = document.getElementById('subtitle-container');
subtitleElement.style.bottom        = "300px";    // 画面下からの位置
subtitleElement.style.left          = "690px";    // 画面左からの位置
subtitleElement.style["max-width"]  = "400px";  // 最大横幅
subtitleElement.style["font-size"]  = "20px";   // フォントサイズ
if (TEST_MODE) {
    subtitleElement.innerHTML = "これはテストテキストです。これはテストテキストです。これはテストテキストです。";
}

// ======== 字幕の管理 ========
// ユーザーの操作によって音声再生を許可するためのAudioContext
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

/**
 * 字幕と音声を同期して再生する非同期関数
 * @param {string} text - 表示する字幕のテキスト
 * @param {string} audioPath - 再生する音声ファイルのパス
 */
async function playSubtitleAndAudio(text, audioPath) {
    // AudioContextが停止状態の場合、再開させる (ブラウザの自動再生ポリシー対策)
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    // 音声の再生と字幕の表示を並行して実行
    await Promise.all([
        playAudio(audioPath),
        typeSubtitle(text, audioPath)
    ]);

    console.log('字幕と音声の再生が完了しました。');
}

/**
 * 音声ファイルを再生し、再生終了時に解決されるPromiseを返す
 * @param {string} path - 音声ファイルのパス
 * @returns {Promise<void>}
 */
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

/**
 * 字幕をタイプライター風に表示する
 * @param {string} text - 字幕テキスト
 * @param {string} audioPath - 同期する音声ファイルのパス
 * @returns {Promise<void>}
 */
async function typeSubtitle(text) {
    subtitleElement.innerHTML = '';

    return new Promise(resolve => {
        let index = 0;
        const intervalId = setInterval(() => {
            if (index < text.length) {
                subtitleElement.innerHTML += text.charAt(index);
                index++;
            } else {
                clearInterval(intervalId);
                // 字幕表示完了後、少し待ってから字幕を消去し、Promiseを解決
                setTimeout(() => {
                    subtitleElement.innerHTML = '';
                    resolve();
                }, 1500); // 1.5秒待機
            }
        }, DELAY_PER_CHAR);
    });
}

// ======== キャラクターの実装 ========

function createCharacter(color) {
    const character = new PIXI.Container();

    // 外周の回転する円弧
    const arcs = new PIXI.Container();
    let radius = 50;
    for (let i = 0; i < 6; i++) {
        const startAngle = (Math.PI / 3) * i;
        const endAngle = startAngle + (Math.PI / 3);
        const c = new PIXI.Container();
        const g = new PIXI.Graphics();
        g.lineStyle(4, color, 0.8);
        g.beginFill();
        g.arc(0, 0, radius, startAngle, endAngle);
        g.endFill();
        c.addChild(g);
        c.speed = (Math.random() - 0.5) * 0.2;
        arcs.addChild(c);
        radius += 10;
    }
    character.addChild(arcs);

    // 中央の円
    const centerCircle = new PIXI.Graphics();
    centerCircle.beginFill(color);
    centerCircle.drawCircle(0, 0, 30);
    centerCircle.endFill();
    character.addChild(centerCircle);
    // アニメーション用のプロパティ
    character.animationProps = {
        arcs,
        initialY: 0,
        time: 0
    };

    return character;
}

let character = createCharacter(CHARACTER_BASE_COLOR);
mainContainer.addChild(character);


// ======== 描画範囲 (マスク) の実装 ========
/**
 * 与えられた頂点群から家型のポリゴンを描画する
 * @param {Array<{x: number, y: number}>} points - タップされた点の配列
 */
function createHouseShape() {
    const roofY = MASK_POINTS["centerY"] - MASK_POINTS["height"] / 2 - MASK_POINTS["roofHeight"];
    const maxX = MASK_POINTS["centerX"] + MASK_POINTS["width"] / 2;
    const minX = MASK_POINTS["centerX"] - MASK_POINTS["width"] / 2;
    const maxY = MASK_POINTS["centerY"] + MASK_POINTS["height"] / 2;
    const minY = MASK_POINTS["centerY"] - MASK_POINTS["height"] / 2;

    const housePoints = [
        new PIXI.Point(minX, maxY),     // 左下
        new PIXI.Point(maxX, maxY),     // 右下
        new PIXI.Point(maxX, minY),     // 右上
        new PIXI.Point(MASK_POINTS["centerX"], roofY), // 屋根の頂点
        new PIXI.Point(minX, minY),     // 左上
    ];

    houseMask.clear();
    if (TEST_MODE) {
        houseMask.lineStyle(3, 0xFFFFFF, 1, 1);
    }else {
        houseMask.beginFill(0xFFFFFF);
    }
    houseMask.drawPolygon(housePoints);
    houseMask.endFill();

    return housePoints;
}

let houseMask = new PIXI.Graphics();
app.stage.addChild(houseMask);
if (!TEST_MODE) {
    mainContainer.mask = houseMask;
}
createHouseShape();

// ======== アニメーションループ ========
function floating(delta) {
    character.animationProps.time += delta * 0.05;

    // 上下運動 (Sine波)
    character.y = character.animationProps.initialY + Math.sin(character.animationProps.time) * 10;
    character.y += 0.1;
    // 円弧の回転
    character.animationProps.arcs.rotation += 0.01 * delta;
    for (const arc of character.children[0].children) {
        arc.rotation += arc.speed;
    }
}
app.ticker.add(floating);

// ======== 初期化処理 ========

function init() {
    // 保存されたマスクがなければ全画面表示
    character.x = MASK_POINTS.centerX;
    character.y = MASK_POINTS.centerY - 50;
    character.animationProps.initialY = MASK_POINTS.centerY - 50;
    character.alpha = 0;
}

async function show1() {
    socket.emit('information-navi-status', {status: "出現中"});
    await new Promise(resolve => {
        gsap.to(character, {
            alpha: 1,      // 最終的な透明度
            duration: 4,   // アニメーション時間（秒）
            ease: "power2.out", // アニメーションのイージング（オプション）
            onComplete: () => {
                resolve();
            }
        });
    });
    await playSubtitleAndAudio(
            "こんにちは。あなたがたがここへ来ていることは気づいていました。",
            "001.wav"
    );
    await playSubtitleAndAudio(
            "来れるはずが無い、来てはいけない「ここ」になぜいるのでしょうか。",
            "002.wav"
    );
    await playSubtitleAndAudio(
            "まぁ、悪意は無いようですので今回は”迷い込んだ”ということにしておきましょう。",
            "003.wav"
    );
}

async function show2() {
    await playSubtitleAndAudio(
            "では、台の端末を手に取ってください。",
            "003.wav"
    );
}

init();
