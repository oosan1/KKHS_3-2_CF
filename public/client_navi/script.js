// ======== グローバル設定 ========

// キャラクターのベースカラー (16進数)
const CHARACTER_BASE_COLOR = 0x87CEEB; // 例: スカイブルー

// LocalStorageに保存する際のキー
const MASK_STORAGE_KEY = 'houseMaskShape';


// ======== PIXIアプリケーションの初期化 ========

let app = new PIXI.Application();
document.body.appendChild(app.view);

// リサイズ処理
function resizeApp() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    // マスクやキャラクターの位置を再調整する場合はここに記述
}
window.addEventListener('resize', resizeApp);
resizeApp(); // 初期表示時にも実行

let mainContainer = new PIXI.Container();
app.stage.addChild(mainContainer);


// ======== 字幕と音声の管理 ========

const subtitleElement = document.getElementById('subtitle-container');
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
 * 音声の長さに合わせて字幕をタイプライター風に表示する
 * @param {string} text - 字幕テキスト
 * @param {string} audioPath - 同期する音声ファイルのパス
 * @returns {Promise<void>}
 */
async function typeSubtitle(text, audioPath) {
    subtitleElement.innerHTML = '';
    let audioDuration = 2; // 音声取得失敗時のデフォルト長 (秒)

    try {
        // 音声の長さを取得
        const response = await fetch(audioPath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioDuration = audioBuffer.duration;
    } catch (error) {
        console.error('音声の長さを取得できませんでした。デフォルト値を使用します。', error);
    }
    
    // 1文字あたりの表示時間を計算 (ミリ秒)
    const delayPerChar = (audioDuration * 1000) / text.length;

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
        }, delayPerChar);
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
    console.log(character);

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
console.log(character)


// ======== 描画範囲 (マスク) の実装 ========

let houseMask = new PIXI.Graphics();
app.stage.addChild(houseMask);
mainContainer.mask = houseMask;

/**
 * 与えられた頂点群から家型のポリゴンを描画する
 * @param {Array<{x: number, y: number}>} points - タップされた点の配列
 */
function createHouseShape(points) {
    if (!points || points.length < 1) {
        // デフォルトは全画面表示
        houseMask.clear();
        houseMask.beginFill(0xFFFFFF);
        houseMask.drawRect(0, 0, app.screen.width, app.screen.height);
        houseMask.endFill();
        return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });

    const roofY = minY - (maxX - minX) * 0.3; // 屋根の高さを少し調整
    const centerX = minX + (maxX - minX) / 2;

    const housePoints = [
        new PIXI.Point(minX, maxY),     // 左下
        new PIXI.Point(maxX, maxY),     // 右下
        new PIXI.Point(maxX, minY),     // 右上
        new PIXI.Point(centerX, roofY), // 屋根の頂点
        new PIXI.Point(minX, minY),     // 左上
    ];

    houseMask.clear();
    houseMask.beginFill(0xFFFFFF); // マスクは任意の色でOK
    houseMask.drawPolygon(housePoints);
    houseMask.endFill();

    // キャラクターの位置をマスクの中央少し上に再設定
    character.animationProps.initialY = (roofY + maxY) / 2 - 30;
    character.x = centerX;

    console.log("House mask applied. Character position adjusted to:", { x: character.x, y: character.y });
    // マスクとキャラクターのバウンディングボックスを比較してみる
    const characterBounds = character.getBounds();
    const maskBounds = houseMask.getBounds();
    console.log("Character Bounds:", characterBounds);
    console.log("Mask Bounds:", maskBounds);

    if (!maskBounds.contains(characterBounds.x, characterBounds.y) ||
        !maskBounds.contains(characterBounds.x + characterBounds.width, characterBounds.y + characterBounds.height)) {
        console.warn("WARNING: Character might be outside the mask bounds!");
    }

    return housePoints;
}

// LocalStorageからマスク情報を読み込む
function loadMaskFromStorage() {
    const data = localStorage.getItem(MASK_STORAGE_KEY);
    if (data) {
        const points = JSON.parse(data);
        return createHouseShape(points);
    }
    return null;
}

// LocalStorageにマスク情報を保存する
function saveMaskToStorage(points) {
    localStorage.setItem(MASK_STORAGE_KEY, JSON.stringify(points));
}


// ======== タップイベントハンドリング ========

let tapPoints = [];
let tapTimeout = null;

app.view.eventMode = 'static'; // PIXI v7+
app.view.addEventListener('pointerdown', (e) => {
    // ユーザー操作があったのでAudioContextを開始試行
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // タップ位置を記録
    tapPoints.push({ x: e.clientX, y: e.clientY });

    // 前回のタイムアウトをクリア
    clearTimeout(tapTimeout);
    // 1秒以内に次のタップがなければリセット
    tapTimeout = setTimeout(() => {
        tapPoints = [];
    }, 1000);

    // 10回タップされたらマスクを生成
    if (tapPoints.length >= 10) {
        const newShapePoints = createHouseShape(tapPoints);
        saveMaskToStorage(newShapePoints);
        tapPoints = []; // カウンターリセット
        clearTimeout(tapTimeout);
    }
});


// ======== アニメーションループ ========

app.ticker.add((delta) => {
    character.animationProps.time += delta * 0.05;

    // 上下運動 (Sine波)
    character.y = character.animationProps.initialY + Math.sin(character.animationProps.time) * 10;
    
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

    // 5秒後にデモを開始
    setTimeout(() => {
        playSubtitleAndAudio(
            "こんにちは。これはHTMLとJavaScriptで作られたデモです。",
            "sample.wav" // あなたが用意した音声ファイル名
        );
    }, 2000);
}

init();