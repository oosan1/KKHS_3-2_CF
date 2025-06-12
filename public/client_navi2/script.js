const TEST_MODE = false;

// ナビゲーターのベースカラー
const CHARACTER_BASE_COLOR = 0x800080;

// LocalStorageに保存する際のキー
const MASK_STORAGE_KEY = "houseMaskShape";

// 字幕の表示間隔(ms)
const DELAY_PER_CHAR = 200;

//音声ファイル数
const AUDIO_FILE_COUNT = 65;

// 「なくしもの」カウント
let nakushimono = 10;

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
    centerX: 660,
    centerY: 550,
    width: 595,
    height: 450,
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
        console.log(data);
        if (data.mode == "start") {
            show1();
        }else if (data.mode == "2th") {
            show2();
        }else if (data.mode == "ring") {
            ring();
        }else if (data.mode == "3th") {
            show3();
        }else if (data.mode == "5th") {
            show5();
        }else if (data.mode == "7th") {
            show7();
        }else if (data.mode == "8th") {
            show8();
        }else if (data.mode == "9th") {
            show9(data.count);
        }else if (data.mode == "10th") {
            show10();
        }else if (data.mode == "end") {
            showEnd();
        }
    });
};

let audioBuffers = {}; // 音声ファイルのバッファを格納

// すべての音声ファイルを読み込む
async function loadAudioFiles() {
    const audioFileNames = [];
    for (let i = 1; i <= AUDIO_FILE_COUNT; i++) {
        audioFileNames.push(`${String(i).padStart(3, '0')}.wav`);
    }
    audioFileNames.push("ring.mp3");

    for (const fileName of audioFileNames) {
        const response = await fetch(`audio/${fileName}`);
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
subtitleElement.style.bottom        = "50px";    // 画面下からの位置
subtitleElement.style.left          = "660px";    // 画面左からの位置
subtitleElement.style["max-width"]  = "560px";  // 最大横幅
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
}

function rotating(delta) {
    character.animationProps.arcs.rotation += 0.01 * delta;
    for (const arc of character.children[0].children) {
        arc.rotation += arc.speed;
    }
}
app.ticker.add(floating);
app.ticker.add(rotating);

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
    character.y = MASK_POINTS.centerY - 50;
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
    );/*
    await playSubtitleAndAudio(
            "来れるはずが無い、来てはいけない「ここ」になぜいるのでしょうか。",
            "002.wav"
    );
    await playSubtitleAndAudio(
            "まぁ、悪意は無いようですので今回は”迷い込んだ”ということにしておきましょう。",
            "003.wav"
    );
    await playSubtitleAndAudio(
            "ここは世界中で忘れられた記憶や思い出などの「なくしもの」が集まる裏世界で、私はここの管理をしています。",
            "004.wav"
    );
    await playSubtitleAndAudio(
            "さて、そこで提案ですが、私の手伝いをしていきませんか？",
            "005.wav"
    );
    await playSubtitleAndAudio(
            "そんなに難しい仕事ではありません。ただの間違い探しです。",
            "006.wav"
    );
    await playSubtitleAndAudio(
            "まず初めに私が作った「なくしもの」の無い世界を見ていただきます。",
            "007.wav"
    );
    await playSubtitleAndAudio(
            "その後、「なくしもの」のある裏世界へ行き、変化した部分を記録してください。",
            "008.wav"
    );
    await playSubtitleAndAudio(
            "記録された「なくしもの」はこちらで浄化して元の世界へ戻します。",
            "009.wav"
    );
    await playSubtitleAndAudio(
            "では私も暇ではありません。さっそく始めましょうか。",
            "010.wav"
    );
    await playSubtitleAndAudio(
            "では、左後ろの通路から裏世界へ進んでください。",
            "011.wav"
    );*/
    setTimeout(async () =>{
        await playSubtitleAndAudio(
                "ただし、裏世界の物は絶対に触らないでくださいね。",
                "012.wav"
        );
    }, 1000);
}

async function show2() {
    await playSubtitleAndAudio(
        "ここは「なくしもの」の無い裏世界です。",
        "013.wav"
    );
    await playSubtitleAndAudio(
        "この世界は一度しか見ることができません。",
        "014.wav"
    );
    await playSubtitleAndAudio(
        "きちんと目に焼き付けてください。",
        "015.wav"
    );
    await playSubtitleAndAudio(
        "私が鐘を鳴らしたら、こちらへ帰ってきてください。",
        "016.wav"
    );
}

async function ring() {
    await playAudio("ring.mp3");
    await playAudio("ring.mp3");
    await playAudio("ring.mp3");
    await playSubtitleAndAudio(
        "では、帰ってきてください。",
        "017.wav"
    );
}

async function show3() {
    await playSubtitleAndAudio(
        "今見ていただいたのが本来の裏世界です。",
        "018.wav"
    );
    await playSubtitleAndAudio(
        "次から見ていただくのは「なくしもの」に浸食された裏世界です。",
        "019.wav"
    );
    await playSubtitleAndAudio(
        "では、こちらをお渡ししましょう。",
        "020.wav"
    );
    app.ticker.remove(floating)
    await new Promise(resolve => {
        gsap.to(character, {
            y: window.innerHeight + 500,      // 最終的な透明度
            duration: 5,   // アニメーション時間（秒）
            ease: "bouns.out", // アニメーションのイージング（オプション）
            onComplete: () => {
                resolve();
            }
        });
    });
}

async function show5() {
    await new Promise(resolve => {
        gsap.to(character, {
            y: MASK_POINTS.centerY - 50,      // 最終的な透明度
            duration: 5,   // アニメーション時間（秒）
            ease: "bouns.out", // アニメーションのイージング（オプション）
            onComplete: () => {
                resolve();
            }
        });
    });
    await playSubtitleAndAudio(
        "では、端末を取って席へ戻ってください。",
        "021.wav"
    );
    await playSubtitleAndAudio(
        "この端末はあなたがたが見つけた「なくしもの」を記録する際に使います。",
        "022.wav"
    );
    await playSubtitleAndAudio(
        "もし、先ほど見た本来の裏世界にはない「なくしもの」を見つけたら写真に撮ってください。",
        "023.wav"
    );
    await playSubtitleAndAudio(
        "では練習してみましょう。",
        "024.wav"
    );
}

async function show7() {
    await playSubtitleAndAudio(
        "では",
        "025.wav"
    );
    socket.emit('control-sound', {mode: "check"});
    await new Promise(resolve => {
        gsap.to(character, {
            y: window.innerHeight + 500,      // 最終的な透明度
            duration: 5,   // アニメーション時間（秒）
            ease: "bouns.out", // アニメーションのイージング（オプション）
            onComplete: () => {
                resolve();
            }
        });
    });
    socket.emit('control-TrueOrFalse');
    await new Promise(resolve => {
        gsap.to(character, {
            y: MASK_POINTS.centerY - 50,      // 最終的な透明度
            duration: 5,   // アニメーション時間（秒）
            ease: "bouns.out", // アニメーションのイージング（オプション）
            onComplete: () => {
                resolve();
            }
        });
    });
    await playSubtitleAndAudio(
        "皆さん正しく撮れているようですね。",
        "026.wav"
    );
    await playSubtitleAndAudio(
        "では本番へ移りましょう。",
        "027.wav"
    );
    await playSubtitleAndAudio(
        "みなさんには裏世界で見つけた変化を撮っていただきます。",
        "028.wav"
    );
    await playSubtitleAndAudio(
        "もし、それが「なくしもの」であれば、私が浄化します。",
        "029.wav"
    );
    await playSubtitleAndAudio(
        "私が浄化しなければいけない「なくしもの」は全部で10個です。",
        "030.wav"
    );
    await playSubtitleAndAudio(
        "指定の枚数を撮り切ったら、この部屋に戻ってきてください。",
        "031.wav"
    );
    await playSubtitleAndAudio(
        "では、左後ろの通路から裏世界へ進んでください。",
        "011.wav"
    );
}

async function show8() {
    await playSubtitleAndAudio(
        "みなさん、「なくしもの」は見つけられましたか？",
        "033.wav"
    );
    await playSubtitleAndAudio(
        "では",
        "025.wav"
    );
    socket.emit('control-sound', {mode: "check"});
    await new Promise(resolve => {
        gsap.to(character, {
            y: window.innerHeight + 500,      // 最終的な透明度
            duration: 5,   // アニメーション時間（秒）
            ease: "bouns.out", // アニメーションのイージング（オプション）
            onComplete: () => {
                resolve();
            }
        });
    });
    socket.emit('control-TrueOrFalse');
    await new Promise(resolve => {
        gsap.to(character, {
            y: MASK_POINTS.centerY - 50,      // 最終的な透明度
            duration: 5,   // アニメーション時間（秒）
            ease: "bouns.out", // アニメーションのイージング（オプション）
            onComplete: () => {
                resolve();
            }
        });
    });
}

async function show9(count) {
    console.log(count);
    if (count < 10) {
        await playSubtitleAndAudio(
            "見つけた「なくしもの」は",
            "034.wav"
        );
    }
    if (count == "1") {
        await playSubtitleAndAudio(
            "1個です。",
            "035.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "2") {
        await playSubtitleAndAudio(
            "2個です。",
            "036.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "3") {
        await playSubtitleAndAudio(
            "3個です。",
            "037.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "4") {
        await playSubtitleAndAudio(
            "4個です。",
            "038.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "5") {
        await playSubtitleAndAudio(
            "5個です。",
            "039.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "6") {
        await playSubtitleAndAudio(
            "6個です。",
            "040.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "7") {
        await playSubtitleAndAudio(
            "7個です。",
            "041.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "8") {
        await playSubtitleAndAudio(
            "8個です。",
            "042.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "9") {
        await playSubtitleAndAudio(
            "9個です。",
            "043.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "10") {
        await playSubtitleAndAudio(
            "全ての「なくしもの」を見つけました。",
            "044.wav"
        );
        nakushimono -= Number(count);
    }else if (count == "0") {
        await playSubtitleAndAudio(
            "ありませんでした。",
            "045.wav"
        );
    }

    if (nakushimono > 0) {
        await playSubtitleAndAudio(
            "残りの「なくしもの」は",
            "046.wav"
        );
    }
    if (nakushimono == 1) {
        await playSubtitleAndAudio(
            "1個です。",
            "035.wav"
        );
    }else if (nakushimono == "2") {
        await playSubtitleAndAudio(
            "2個です。",
            "036.wav"
        );
    }else if (nakushimono == "3") {
        await playSubtitleAndAudio(
            "3個です。",
            "037.wav"
        );
    }else if (nakushimono == "4") {
        await playSubtitleAndAudio(
            "4個です。",
            "038.wav"
        );
    }else if (nakushimono == "5") {
        await playSubtitleAndAudio(
            "5個です。",
            "039.wav"
        );
    }else if (nakushimono == "6") {
        await playSubtitleAndAudio(
            "6個です。",
            "040.wav"
        );
    }else if (nakushimono == "7") {
        await playSubtitleAndAudio(
            "7個です。",
            "041.wav"
        );
    }else if (nakushimono == "8") {
        await playSubtitleAndAudio(
            "8個です。",
            "042.wav"
        );
    }else if (nakushimono == "9") {
        await playSubtitleAndAudio(
            "9個です。",
            "043.wav"
        );
    }else if (nakushimono == "10") {
        await playSubtitleAndAudio(
            "10個です。",
            "047.wav"
        );
        nakushimono -= Number(count);
    }
}

async function show10() {
    await playSubtitleAndAudio(
        "まだ時間はあります。",
        "048.wav"
    );
    await playSubtitleAndAudio(
        "引き続き頑張ってください。",
        "049.wav"
    );
    await playSubtitleAndAudio(
        "一度見つけた「なくしもの」を再度撮影する必要はありません。",
        "050.wav"
    );
    await playSubtitleAndAudio(
        "では、左後ろの通路から裏世界へ進んでください。",
        "011.wav"
    );
}

// すべて見つけられなかった場合
async function showEnd() {
    if (nakushimono == 0) {
        await playSubtitleAndAudio(
            "全ての「なくしもの」を見つけていただき、ありがとうございました。",
            "053.wav"
        );
    }else {
        await playSubtitleAndAudio(
            "それではみなさん、お時間です。",
            "051.wav"
        );
        await playSubtitleAndAudio(
            "全てではありませんが、「なくしもの」を見つけていただき、ありがとうございました。",
            "052.wav"
        );
    }
    await playSubtitleAndAudio(
        "端末は置いてあった場所に返してください。",
        "054.wav"
    );
    setTimeout(async () => {
        await playSubtitleAndAudio(
            "見つけていただいた「なくしもの」は私の方で浄化し、",
            "055.wav"
        );
        await playSubtitleAndAudio(
            "もとの世界の持ち主へ返しておきます。",
            "056.wav"
        );
        await playSubtitleAndAudio(
            "それでは約束通り、みなさんをもとの世界へ戻しましょう。",
            "057.wav"
        );
        await playSubtitleAndAudio(
            "ただ最後に一つだけ。",
            "058.wav"
        );
        await playSubtitleAndAudio(
            "きっとみなさんがもとの世界に戻った後も、",
            "059.wav"
        );
        await playSubtitleAndAudio(
            "忘れたくない楽しい時間を過ごすことでしょう。",
            "060.wav"
        );
        await playSubtitleAndAudio(
            "そこで得られるかけがえのない記憶や思い出が",
            "061.wav"
        );
        await playSubtitleAndAudio(
            "みなさんの持ち物であり続けることを祈っています。",
            "062.wav"
        );
        await playSubtitleAndAudio(
            "それでは、",
            "063.wav"
        );
        await playSubtitleAndAudio(
            "右奥の扉がもとの世界への出口となっています。",
            "064.wav"
        );
        await playSubtitleAndAudio(
            "あちらの世界でもお元気で。",
            "065.wav"
        );
    }, 3000);
}

init();
