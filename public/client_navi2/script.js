const TEST_MODE = true;

// ナビゲーターのベースカラー
const CHARACTER_BASE_COLOR = 0x87CEEB;

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

let mainContainer = new PIXI.Container();
app.stage.addChild(mainContainer);


// ======== 字幕の管理 ========
const subtitleElement = document.getElementById('subtitle-container');
subtitleElement.style.bottom        = "15%";    // 画面下からの位置
subtitleElement.style.left          = "50%";    // 画面左からの位置
subtitleElement.style["max-width"]  = "800px";  // 最大横幅
subtitleElement.style["font-size"]  = "28px";   // フォントサイズ
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
async function playAudio(path) {
    try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

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
                }, 150000); // 1.5秒待機
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
        g.lineStyle(4, color + Math.random(), 0.8);
        g.beginFill();
        g.arc(0, 0, radius, startAngle, endAngle);
        g.endFill();
        c.addChild(g);
        c.speed = (Math.random() - 0.5) * 0.1;
        arcs.addChild(c);
        radius += 20;
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
app.stage.addChild(character);

// ======== アニメーションループ ========

app.ticker.add((delta) => {
    character.animationProps.time += delta * 0.05;

    // 上下運動 (Sine波)
    //character.y = character.animationProps.initialY + Math.sin(character.animationProps.time) * 10;
    character.y -= 1;
    // 円弧の回転
    //character.animationProps.arcs.rotation += 0.01 * delta;
    for (const arc of character.children[0].children) {
        arc.rotation += arc.speed;
    }
});

// ======== 初期化処理 ========

function init() {
    // 保存されたマスクがなければ全画面表示
    character.x = app.screen.width / 2;
    character.y = app.screen.height / 2;
    character.animationProps.initialY = app.screen.height / 2 - 50;

    setTimeout(() => {
        playSubtitleAndAudio(
            "こんにちは。これはHTMLとJavaScriptで作られたデモです。",
            "sample.wav" // あなたが用意した音声ファイル名
        );
        
    }, 2000);
}

init();