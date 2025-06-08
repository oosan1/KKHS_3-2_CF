const CHARACTER_BASE_COLOR = 0x87CEEB;

// LocalStorageに保存する際のキー
const MASK_STORAGE_KEY = "houseMaskShape";

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