// script.js

// --- 定数とDOM要素の取得 ---
const BLADDER_FILL = document.getElementById('bladder-fill');
const HEART_FILL = document.getElementById('heart-fill');
const MOVE_FILL = document.getElementById('move-fill');
const PATIENCE_BUTTON = document.getElementById('patience-button');
const SPEED_TOGGLE = document.getElementById('speed-toggle');
const SCENE_IMAGE = document.getElementById('scene-image');
const HOTSPOT_AREA = document.getElementById('hotspot-area');
const HORROR_OVERLAY = document.getElementById('horror-overlay');
const BRANCH_MODAL = document.getElementById('branch-modal');
const SCENE_TEXT = document.getElementById('scene-text');
const START_SCREEN = document.getElementById('start-screen');
const GAME_CONTAINER = document.getElementById('game-container');

// --- ゲーム状態変数（統合版）---
let bladderValue = 0; // 初期値を0%に変更
let heartValue = 10;   // 初期心拍数 (10%)
let moveProgress = 0;  // 移動進行度 (0-100%)
let pressCount = 0;    // 我慢ボタンの連打カウンター
let isRunning = false; // 走行モードフラグ
let gameRunning = true; // ゲーム実行フラグ
let isMoving = false;  // 移動中フラグ
let moveTimer = null;

// 移動時間設定（必ず定義されるよう確認）
const MOVE_DURATION_WALK = 5000; // 歩行時の移動時間（ミリ秒）
const MOVE_DURATION_RUN = 3000;  // 走行時の移動時間（ミリ秒）

// --- パラメータ設定 ---
const BASE_BLADDER_INCREASE = 0.15; // 限界ゲージの基本上昇値
const RUN_MULTIPLIER = 3.0;        // 走行時のゲージ上昇倍率
const HEART_DECAY = 0.02;          // 心拍数の自然減少値
const MAX_HEART_FOR_CRISIS = 70;   // パニック開始閾値
const SUPPRESSION_MULTIPLIER = 0.3; // 我慢ボタンによる上昇速度減速倍率（新設）

// --- 旅館のシーンデータ (簡易版) ---
const SCENES = {
    "start": {
        image: "images/corridor_start.png", // 適切な画像を準備してください
        text: "薄暗い廊下だ。トイレはあの突き当りのようだ。",
        hotspots: [
            { id: "forward", style: { top: '20%', left: '30%', width: '40%', height: '50%' }, nextScene: "corridor_mid", timeCost: 200 }
        ]
    },
    "corridor_mid": {
        image: "images/corridor_mid.png",
        text: "床がミシミシ鳴る。心臓がうるさい。",
        hotspots: [
            { id: "forward", style: { top: '20%', left: '30%', width: '40%', height: '50%' }, nextScene: "branch_point", timeCost: 200 }
        ]
    },
    "branch_point": {
        image: "images/corridor_branch.png",
        text: "分かれ道だ。左の狭い廊下か、右の広間か...",
        hotspots: [
            { id: "branch", style: { top: '30%', left: '20%', width: '60%', height: '40%' }, nextScene: "branch_modal" } // モーダルを開く
        ]
    },
    "safe_route": {
        image: "images/safe_path.png",
        text: "遠回りだが静かだ。少し落ち着こう。",
        hotspots: [
             { id: "forward", style: { top: '20%', left: '30%', width: '40%', height: '50%' }, nextScene: "goal", timeCost: 350 }
        ]
    },
    "danger_route": {
        image: "images/danger_path.png",
        text: "近道だが、何かの気配がする！",
        hotspots: [
             { id: "forward", style: { top: '20%', left: '30%', width: '40%', height: '50%' }, nextScene: "goal", timeCost: 150, event: true } // イベントフラグ
        ]
    },
    "goal": {
        image: "images/toilet_door.png",
        text: "トイレのドアだ！あとは...",
        hotspots: [] // ゴール後の処理は別途
    }
};

let currentScene = "start";

// --- 関数定義 ---

/**
 * ゲージとゲーム状態を更新するメインループ
 */
function gameLoop() {
    if (!gameRunning) {
        // ゲームが停止中でも次のフレームをスケジュール
        requestAnimationFrame(gameLoop);
        return;
    }

    // 1. ゲージの基本変動計算
    let bladderIncrease = BASE_BLADDER_INCREASE;
    
    // 走行時の倍率適用
    if (isRunning) {
        bladderIncrease *= RUN_MULTIPLIER;
        heartValue += 0.1; // 走行中は心拍数が上昇
    } else {
        heartValue = Math.max(0, heartValue - HEART_DECAY); // 歩行中は心拍数が減少
    }

    // 2. パニック状態の確認
    let panicMultiplier = 1;
    if (heartValue > MAX_HEART_FOR_CRISIS) {
        panicMultiplier = 2; // パニック中はゲージ上昇を増幅させる
        HORROR_OVERLAY.classList.add('glitch');
    } else {
        HORROR_OVERLAY.classList.remove('glitch');
    }
    
    // 3. 我慢ボタンによる減速効果（ゲージを減らすのではなく、上昇を遅くする）
    let suppressionEffect = 1.0; // デフォルトは通常速度
    if (pressCount > 0) {
        suppressionEffect = SUPPRESSION_MULTIPLIER; // 我慢中は上昇速度を大幅減速
    }
    
    // 4. 最終的な限界ゲージの変化（減算ではなく乗算で調整）
    let finalIncrease = bladderIncrease * panicMultiplier * suppressionEffect;
    bladderValue += finalIncrease;

    // 5. ゲージの限界処理
    bladderValue = Math.max(0, Math.min(100, bladderValue));
    heartValue = Math.min(100, heartValue);

    // 移動進行度の更新を追加
    if (isMoving) {
        updateMoveProgress();
    }

    // 6. UIの更新
    updateUI();

    // 7. ゲームオーバー判定
    if (bladderValue >= 100) {
        endGame(false);
        return;
    }
    
    // 8. 連打カウンターの減衰 (次のフレームに向けて効果を薄める)
    pressCount *= 0.7; 

    requestAnimationFrame(gameLoop);
}

/**
 * ルート分岐モーダルの表示
 */
function showBranchModal() {
    console.log('分岐モーダル表示開始');
    // ゲームループは停止しない（移動進行度の更新を継続するため）
    BRANCH_MODAL.classList.remove('hidden');

    // 分岐テキストとオプションの設定
    document.getElementById('branch-text').textContent = SCENES['branch_point'].text;
    
    console.log('分岐モーダル表示完了');
}

/**
 * ルート分岐の選択処理
 */
function handleBranchSelection(option) {
    console.log(`=== ルート選択: ${option} ===`);
    
    // モーダルを隠す
    BRANCH_MODAL.classList.add('hidden');
    
    // 選択に応じて処理
    if (option === 'A') {
        console.log('危険ルート選択 - danger_route へ移動開始');
        heartValue += 20;
        // 選択と同時に背景画像とテキストを変更
        SCENE_IMAGE.style.backgroundImage = `url('${SCENES['danger_route'].image}')`;
        if (SCENE_TEXT) {
            SCENE_TEXT.textContent = SCENES['danger_route'].text;
        }
        console.log(`背景を危険ルートに変更: ${SCENES['danger_route'].image}`);
        // 即座に移動開始
        startSceneMove('danger_route', 50, true);
    } else if (option === 'B') {
        console.log('安全ルート選択 - safe_route へ移動開始');
        heartValue = Math.max(0, heartValue - 10);
        // 選択と同時に背景画像とテキストを変更
        SCENE_IMAGE.style.backgroundImage = `url('${SCENES['safe_route'].image}')`;
        if (SCENE_TEXT) {
            SCENE_TEXT.textContent = SCENES['safe_route'].text;
        }
        console.log(`背景を安全ルートに変更: ${SCENES['safe_route'].image}`);
        // 即座に移動開始
        startSceneMove('safe_route', 150, false);
    } else {
        console.error('不正な選択:', option);
    }
}

/**
 * 移動進行度を更新する関数
 */
function updateMoveProgress() {
    if (!isMoving) return;
    
    const duration = isRunning ? MOVE_DURATION_RUN : MOVE_DURATION_WALK;
    const increment = (100 / (duration / 16)); // 60FPSを想定（16ms毎の更新）
    
    moveProgress += increment;
    
    // デバッグログの頻度を調整
    if (Math.floor(moveProgress) % 5 === 0 && moveProgress % 5 < increment) {
        console.log(`移動進行度更新: ${moveProgress.toFixed(1)}% (isMoving: ${isMoving})`);
    }
    
    if (moveProgress >= 100) {
        moveProgress = 100;
        completeCurrentMove();
    }
}

/**
 * UIの見た目（ゲージとボタンのテキスト）を更新
 */
function updateUI() {
    // ゲージの更新
    if (BLADDER_FILL) BLADDER_FILL.style.width = Math.max(0, Math.min(100, bladderValue)) + '%';
    if (HEART_FILL) HEART_FILL.style.width = Math.max(0, Math.min(100, heartValue)) + '%';
    if (MOVE_FILL) {
        const progressWidth = Math.max(0, Math.min(100, moveProgress));
        MOVE_FILL.style.width = progressWidth + '%';
        
        // 移動中は視覚的フィードバックを追加
        if (isMoving) {
            MOVE_FILL.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.8)';
        } else {
            MOVE_FILL.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
        }
    }
    
    // 危険時の色変化と画面揺れ（CSSアニメーションと連携させる）
    if (bladderValue > 80) {
        BLADDER_FILL.style.backgroundColor = 'darkred';
        // ここに画面揺れCSSクラスの追加処理を記述
    } else {
        BLADDER_FILL.style.backgroundColor = 'red';
    }
    
    // 速度ボタンのテキスト更新
    SPEED_TOGGLE.textContent = isRunning ? "現在：走行中 (タップで歩行)" : "現在：歩行中 (タップで走行)";
}

/**
 * シーン移動完了
 */
function completeCurrentMove() {
    if (!window.currentMove) return;
    
    const { targetScene, timeCost, hasEvent } = window.currentMove;
    
    console.log(`シーン移動完了: ${currentScene} → ${targetScene}`);
    
    // 移動状態をリセット
    isMoving = false;
    moveProgress = 0;
    
    // ゴールシーンではホラーイベントを発生させない
    if (hasEvent && targetScene !== 'goal') {
        triggerHorrorEvent();
    } else if (hasEvent && targetScene === 'goal') {
        console.log('ゴールシーンのため、ホラーイベントをスキップしました');
    }
    
    // シーン変更を実行
    if (SCENES[targetScene]) {
        changeScene(targetScene, timeCost);
    } else {
        console.log(`シーン "${targetScene}" が見つかりません。現在のシーンを維持します。`);
    }
    
    // 移動データをクリア
    window.currentMove = null;
    
    // UIを更新
    updateUI();
}

/**
 * ホットスポットがクリックされたときの処理
 */
function handleHotspotClick(hotspot) {
    if (isMoving) return; // 移動中はクリックを無効化
    
    if (hotspot.nextScene === "branch_modal") {
        showBranchModal();
    } else {
        startSceneMove(hotspot.nextScene, hotspot.timeCost, hotspot.event);
    }
}

/**
 * ホラーイベントの発生処理
 */
function triggerHorrorEvent() {
    console.log("ホラーイベント発生！");
    
    // 走行中かどうかで処理を分岐
    if (isRunning) {
        console.log("走行中のため、ホラーイベントを回避！");
        // 走行中は軽微な心拍数上昇のみ
        heartValue += 10;
        
        // 回避成功の視覚効果（短い緑フラッシュ）
        HORROR_OVERLAY.classList.add('green-flash');
        setTimeout(() => {
            HORROR_OVERLAY.classList.remove('green-flash');
        }, 500);
        
        // 回避メッセージ（オプション）
        showTemporaryMessage("走って回避した！", "success");
        
    } else {
        console.log("歩行中のため、ホラーイベント直撃！");
        // 歩行中は大ダメージ
        heartValue += 30; // 心拍数急上昇
        bladderValue = 99; // 膀胱ゲージを99%まで一気に上昇
        console.log(`膀胱ゲージが99%まで上昇: ${bladderValue}%`);
        
        // 通常の赤フラッシュ
        HORROR_OVERLAY.classList.add('red-flash');
        setTimeout(() => {
            HORROR_OVERLAY.classList.remove('red-flash');
        }, 1000);
        
        // 被害メッセージ
        showTemporaryMessage("何かに遭遇した！もう限界だ...", "danger");
    }
    
    // UIを即座に更新
    updateUI();
}

/**
 * 一時的なメッセージを表示する関数
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ（"success", "danger", "info"）
 */
function showTemporaryMessage(message, type = "info") {
    // メッセージ要素を作成
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2000;
        padding: 15px 30px;
        border-radius: 10px;
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    // タイプに応じて色を設定
    switch(type) {
        case "success":
            messageElement.style.backgroundColor = "rgba(76, 175, 80, 0.9)";
            messageElement.style.color = "white";
            messageElement.style.border = "2px solid #4CAF50";
            break;
        case "danger":
            messageElement.style.backgroundColor = "rgba(244, 67, 54, 0.9)";
            messageElement.style.color = "white";
            messageElement.style.border = "2px solid #F44336";
            break;
        default:
            messageElement.style.backgroundColor = "rgba(33, 150, 243, 0.9)";
            messageElement.style.color = "white";
            messageElement.style.border = "2px solid #2196F3";
    }
    
    // 画面に追加
    document.body.appendChild(messageElement);
    
    // フェードイン
    setTimeout(() => {
        messageElement.style.opacity = "1";
    }, 100);
    
    // 3秒後にフェードアウトして削除
    setTimeout(() => {
        messageElement.style.opacity = "0";
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 300);
    }, 3000);
}

/**
 * シーン（場所）の変更とホットスポットの再描画
 * @param {string} sceneKey - 次のシーンのキー
 * @param {number} timeCost - 移動にかかる時間コスト (限界ゲージに加算)
 */
function changeScene(sceneKey, timeCost = 0) {
    if (!SCENES[sceneKey]) {
        console.error(`シーン "${sceneKey}" が存在しません`);
        return;
    }
    
    currentScene = sceneKey;
    const scene = SCENES[sceneKey];
    
    console.log(`シーン変更: ${sceneKey}`);
    console.log(`新しい画像: ${scene.image}`);

    // 時間コストを限界ゲージに加算（シーン変更時のペナルティ）
    if (timeCost > 0) {
        bladderValue += timeCost * 0.02; // 0.05から0.02に調整して影響を軽減
        bladderValue = Math.min(100, bladderValue);
        console.log(`シーン変更による限界ゲージ上昇: +${(timeCost * 0.02).toFixed(2)}% (現在: ${bladderValue.toFixed(1)}%)`);
    }

    // 画像とテキストの更新
    const newImageUrl = `url('${scene.image}')`;
    console.log(`背景画像を変更: ${newImageUrl}`);
    SCENE_IMAGE.style.backgroundImage = newImageUrl;
    
    // シーンテキストの更新
    if (SCENE_TEXT) {
        SCENE_TEXT.textContent = scene.text;
        console.log(`シーンテキスト更新: ${scene.text}`);
    }
    
    // 画像の読み込み確認（デバッグ用）
    const testImage = new Image();
    testImage.onload = () => {
        console.log(`画像読み込み成功: ${scene.image}`);
    };
    testImage.onerror = () => {
        console.error(`画像読み込み失敗: ${scene.image}`);
    };
    testImage.src = scene.image;
    
    // HOTSPOT_AREAの既存のボタンをクリア
    HOTSPOT_AREA.innerHTML = ''; 

    // ゴールシーンの場合は成功処理
    if (sceneKey === 'goal') {
        endGame(true);
        return;
    }

    // 分岐シーンの場合はモーダルを表示（自動移動は行わない）
    if (sceneKey === 'branch_point') {
        showBranchModal();
        return;
    }

    // 通常のシーンの場合は自動的に次のシーンへ移動開始
    if (scene.hotspots.length > 0) {
        const nextHotspot = scene.hotspots[0];
        console.log(`次の移動予約: ${nextHotspot.nextScene}`);
        setTimeout(() => {
            console.log('自動移動開始実行');
            startSceneMove(nextHotspot.nextScene, nextHotspot.timeCost, nextHotspot.event);
        }, 1000); // 1秒後に自動移動開始
    }
    
    console.log(`シーン "${sceneKey}" を表示しました`);
    
    // UIを即座に更新して限界ゲージの状態を反映
    updateUI();
}

/**
 * ゲーム終了処理
 * @param {boolean} success - 成功(true)か失敗(false)か
 */
function endGame(success) {
    gameRunning = false;
    isMoving = false; // 移動も停止
    
    if (success) {
        showGameEndModal("success", "成功！", "間に合いました！\nトイレに到着しました。");
    } else {
        showGameEndModal("failure", "ゲームオーバー", "決壊！\n『走るな、漏れる』");
    }
}

/**
 * スタート画面を表示
 */
function showStartScreen() {
    console.log('スタート画面を表示');
    START_SCREEN.classList.remove('hidden');
    GAME_CONTAINER.classList.add('hidden');
    
    // ゲームを完全停止
    gameRunning = false;
    isMoving = false;
}

/**
 * ゲームを開始（スタート画面から）
 */
function startGameFromMenu() {
    console.log('=== ゲーム開始 ===');
    
    // スタート画面を隠してゲーム画面を表示
    START_SCREEN.classList.add('hidden');
    GAME_CONTAINER.classList.remove('hidden');
    
    // ゲーム状態を初期化
    gameRunning = true;
    isMoving = false;
    moveProgress = 0;
    bladderValue = 0;
    heartValue = 10;
    currentScene = 'start';
    pressCount = 0;
    isRunning = false;
    
    // 移動データをクリア
    window.currentMove = null;
    
    // ホラーオーバーレイのクラスをクリア
    HORROR_OVERLAY.classList.remove('glitch', 'red-flash', 'green-flash');
    
    // モーダルを隠す
    BRANCH_MODAL.classList.add('hidden');
    
    // UIを更新してから初期シーンをロード
    updateUI();
    changeScene(currentScene);
    
    // 2秒後に自動移動開始
    setTimeout(() => {
        const startScene = SCENES[currentScene];
        if (startScene && startScene.hotspots && startScene.hotspots.length > 0) {
            const firstHotspot = startScene.hotspots[0];
            startSceneMove(firstHotspot.nextScene, firstHotspot.timeCost, firstHotspot.event);
        }
    }, 2000);
}

/**
 * ゲーム終了モーダルを表示
 * @param {string} type - "success" または "failure"
 * @param {string} title - タイトル
 * @param {string} message - メッセージ
 */
function showGameEndModal(type, title, message) {
    // 既存のモーダルがあれば削除
    const existingModal = document.getElementById('game-end-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // モーダル要素を作成
    const modal = document.createElement('div');
    modal.id = 'game-end-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.5s ease;
    `;
    
    // モーダルコンテンツを作成
    const content = document.createElement('div');
    content.style.cssText = `
        background-color: ${type === 'success' ? '#1B5E20' : '#B71C1C'};
        padding: 40px;
        border-radius: 15px;
        text-align: center;
        max-width: 400px;
        border: 3px solid ${type === 'success' ? '#4CAF50' : '#F44336'};
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
    `;
    
    // タイトル
    const titleElement = document.createElement('h2');
    titleElement.textContent = title;
    titleElement.style.cssText = `
        color: white;
        font-size: 2em;
        margin: 0 0 20px 0;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    `;
    
    // メッセージ
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        color: white;
        font-size: 1.2em;
        line-height: 1.4;
        margin: 0 0 30px 0;
        white-space: pre-line;
    `;
    
    // スタート画面に戻るボタンのみ
    const backToStartButton = document.createElement('button');
    backToStartButton.textContent = 'スタート画面に戻る';
    backToStartButton.style.cssText = `
        padding: 12px 24px;
        font-size: 1.1em;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    `;
    backToStartButton.onmouseover = () => backToStartButton.style.backgroundColor = '#45A049';
    backToStartButton.onmouseout = () => backToStartButton.style.backgroundColor = '#4CAF50';
    backToStartButton.onclick = () => {
        modal.remove();
        showStartScreen();
    };
    
    // 要素を組み立て
    content.appendChild(titleElement);
    content.appendChild(messageElement);
    content.appendChild(backToStartButton);
    modal.appendChild(content);
    
    // ページに追加
    document.body.appendChild(modal);
    
    // フェードイン
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 100);
}

/**
 * シーン移動を開始
 * @param {string} targetScene - 移動先のシーン
 * @param {number} timeCost - 時間コスト
 * @param {boolean} hasEvent - イベントがあるかどうか
 */
function startSceneMove(targetScene, timeCost = 0, hasEvent = false) {
    if (isMoving) {
        console.log('既に移動中のため、新しい移動をキャンセルします');
        return;
    }
    
    console.log('=== シーン移動開始 ===');
    console.log('移動先:', targetScene);
    console.log('時間コスト:', timeCost);
    console.log('イベント有り:', hasEvent);
    console.log('現在のゲーム状態 - isMoving:', isMoving, 'gameRunning:', gameRunning);
    
    isMoving = true;
    moveProgress = 0;
    
    // 移動データを保存
    window.currentMove = {
        targetScene: targetScene,
        timeCost: timeCost,
        hasEvent: hasEvent
    };
    
    // UIを即座に更新
    updateUI();
    
    console.log('移動開始完了 - isMoving:', isMoving);
    console.log('currentMove:', window.currentMove);
}

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', function() {
    // スタートボタンのイベントリスナー
    const startGameButton = document.getElementById('start-game-btn');
    if (startGameButton) {
        startGameButton.addEventListener('click', startGameFromMenu);
        console.log('スタートボタンのイベントリスナー設定完了');
    }
    
    // 初期状態ではスタート画面を表示
    showStartScreen();
    
    // DOM要素の存在確認とデバッグ情報
    console.log('=== DOM要素チェック ===');
    console.log('START_SCREEN:', START_SCREEN);
    console.log('GAME_CONTAINER:', GAME_CONTAINER);
    console.log('BLADDER_FILL:', BLADDER_FILL);
    console.log('HEART_FILL:', HEART_FILL);
    console.log('MOVE_FILL:', MOVE_FILL);
    console.log('BRANCH_MODAL:', BRANCH_MODAL);
    console.log('SCENE_TEXT:', SCENE_TEXT);
    
    // ルート分岐ボタンのイベントリスナーを設定
    const optionA = document.getElementById('option-a');
    const optionB = document.getElementById('option-b');
    
    console.log('option-a element:', optionA);
    console.log('option-b element:', optionB);
    
    if (optionA) {
        optionA.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Option A clicked - 危険ルート選択');
            handleBranchSelection('A');
        });
        console.log('Option A イベントリスナー設定完了');
    } else {
        console.error('option-a 要素が見つかりません');
    }
    
    if (optionB) {
        optionB.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Option B clicked - 安全ルート選択');
            handleBranchSelection('B');
        });
        console.log('Option B イベントリスナー設定完了');
    } else {
        console.error('option-b 要素が見つかりません');
    }
    
    // 移動ゲージの初期化
    updateUI();
    
    // 初期シーンのロード
    changeScene(currentScene);
    
    // 自動移動開始
    setTimeout(() => {
        console.log('=== 初回自動移動開始処理 ===');
        console.log('現在のシーン:', currentScene);
        const startScene = SCENES[currentScene];
        console.log('スタートシーンデータ:', startScene);
        
        if (startScene && startScene.hotspots && startScene.hotspots.length > 0) {
            const firstHotspot = startScene.hotspots[0];
            startSceneMove(firstHotspot.nextScene, firstHotspot.timeCost, firstHotspot.event);
        } else {
            console.log('ホットスポットが見つかりません');
        }
    }, 2000);
});

// --- イベントリスナー設定 ---

// 1. 我慢ボタンの連打処理 (マウスダウン/タッチスタート)
PATIENCE_BUTTON.addEventListener('mousedown', () => { pressCount += 1; });
PATIENCE_BUTTON.addEventListener('touchstart', (e) => {
    e.preventDefault(); // スマホでのデフォルト動作をキャンセル
    pressCount += 1; 
}, { passive: false });

// 2. 走る/歩くの切り替え
SPEED_TOGGLE.addEventListener('click', () => {
    isRunning = !isRunning;
});

// --- ゲーム開始 ---
requestAnimationFrame(gameLoop);