// 🔧 【保持】既存の import と safeGetElement は維持
import { UIManager } from '../core/ui-manager.js';

// 安全な要素取得関数
function safeGetElement(id) {
    try {
        return document.getElementById(id);
    } catch (error) {
        console.warn(`Element not found: ${id}`);
        return null;
    }
}

export class RoomManager {
    constructor(game) {
        console.log('RoomManager 初期化');
        this.game = game;
        
        // 🔧 【保持】既存の状態管理プロパティ
        this.isJoining = false;
        this.isCreating = false;
        this.lastJoinAttempt = 0;
        this.lastCreateAttempt = 0;
        
        // 🔧 【保持】デバッグ情報
        this.debug = {
            joinAttempts: 0,
            createAttempts: 0,
            resetCount: 0
        };
    }

    // 🔧 【保持】既存のルーム作成メソッド
    createRoom() {
        console.log('🏠 ルーム作成処理開始');
        
        const now = Date.now();
        this.debug.createAttempts++;

        // 重複作成防止
        if (this.isCreating) {
            const timeSinceLastAttempt = now - this.lastCreateAttempt;
            if (timeSinceLastAttempt < 3000) {
                console.warn('⚠️ 作成処理が進行中です');
                UIManager.showError('ルーム作成中です。少しお待ちください。');
                return;
            }
        }

        try {
            const nameInput = safeGetElement('player-name-create');
            const passwordCheckbox = safeGetElement('use-password');
            const passwordInput = safeGetElement('room-password');

            if (!nameInput) {
                console.error('❌ プレイヤー名入力欄が見つかりません');
                UIManager.showError('プレイヤー名入力欄が見つかりません');
                return;
            }

            const playerName = nameInput.value.trim();
            if (!playerName) {
                UIManager.showError('プレイヤー名を入力してください');
                nameInput.focus();
                return;
            }

            if (playerName.length > 20) {
                UIManager.showError('プレイヤー名は20文字以内にしてください');
                nameInput.focus();
                return;
            }

            // 状態設定
            this.isCreating = true;
            this.lastCreateAttempt = now;

            // パスワード処理
            const hasPassword = passwordCheckbox?.checked || false;
            const password = hasPassword && passwordInput ? passwordInput.value.trim() : '';

            if (hasPassword && !password) {
                UIManager.showError('パスワードを入力してください');
                if (passwordInput) passwordInput.focus();
                this.isCreating = false;
                return;
            }

            // ゲーム状態設定
            this.game.myName = playerName;
            UIManager.showPlayerName(playerName);

            // サーバーにルーム作成要求
            this.game.socketClient.createRoom(playerName, hasPassword, password);
            UIManager.showError('ルームを作成中...', 'warning');

            console.log('📤 ルーム作成要求送信完了');

        } catch (error) {
            console.error('❌ ルーム作成エラー:', error);
            this.isCreating = false;
            UIManager.showError('ルーム作成でエラーが発生しました');
        }
    }

    // 🔧 【保持】既存のルーム参加メソッド
    joinRoom() {
        console.log('👥 ルーム参加処理開始');
        
        const now = Date.now();
        this.debug.joinAttempts++;

        // 既にルームに参加している場合は拒否
        if (this.game.roomId) {
            console.warn(`⚠️ 既にルーム ${this.game.roomId} に参加中`);
            UIManager.showError('既に他のルームに参加しています。一度退出してから参加してください。');
            return;
        }

        // 重複参加防止
        if (this.isJoining) {
            const timeSinceLastAttempt = now - this.lastJoinAttempt;
            
            if (timeSinceLastAttempt > 15000) {
                console.warn('⚠️ 古い参加フラグを強制リセット');
                this.forceResetAllStates();
            } else if (timeSinceLastAttempt > 5000) {
                const shouldReset = confirm('参加処理が継続中です。リセットして再試行しますか？');
                if (shouldReset) {
                    this.forceResetAllStates();
                } else {
                    return;
                }
            } else {
                console.warn('⚠️ 参加処理が進行中です');
                UIManager.showError('参加処理中です。少しお待ちください。');
                return;
            }
        }

        try {
            const nameInput = safeGetElement('player-name-join');
            const roomInput = safeGetElement('room-id-input');
            const passwordInput = safeGetElement('join-password');

            if (!nameInput || !roomInput) {
                console.error('❌ 入力欄が見つかりません');
                UIManager.showError('入力欄が見つかりません');
                return;
            }

            const playerName = nameInput.value.trim();
            const roomId = roomInput.value.trim().toUpperCase();

            if (!playerName) {
                UIManager.showError('プレイヤー名を入力してください');
                nameInput.focus();
                return;
            }

            if (!roomId) {
                UIManager.showError('ルームIDを入力してください');
                roomInput.focus();
                return;
            }

            if (playerName.length > 20) {
                UIManager.showError('プレイヤー名は20文字以内にしてください');
                return;
            }

            // 状態設定
            this.isJoining = true;
            this.lastJoinAttempt = now;

            const password = passwordInput ? passwordInput.value.trim() : '';

            // ゲーム状態設定
            this.game.myName = playerName;
            this.game.roomId = roomId;
            UIManager.showPlayerName(playerName);

            // サーバーに参加要求
            this.game.socketClient.joinRoom(roomId, playerName, password);
            UIManager.showError('ルームに参加中...', 'warning');

            console.log('📤 ルーム参加要求送信完了');

        } catch (error) {
            console.error('❌ ルーム参加エラー:', error);
            this.isJoining = false;
            UIManager.showError('ルーム参加でエラーが発生しました');
        }
    }

    // 🔧 【保持】既存の観戦機能
    spectateRoom() {
        try {
            const nameInput = safeGetElement('spectator-name');
            const roomInput = safeGetElement('spectate-room-id');
            
            const spectatorName = nameInput?.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
            const roomId = roomInput?.value.trim().toUpperCase();

            if (!roomId) {
                UIManager.showError('ルームIDを入力してください');
                return;
            }

            this.game.myName = spectatorName;
            this.game.isSpectator = true;
            this.game.roomId = roomId;
            UIManager.showPlayerName(this.game.myName + ' (観戦)');
            
            this.game.socketClient.spectateRoom(roomId, spectatorName);
            UIManager.showError('観戦を開始中...', 'warning');
            
        } catch (error) {
            console.error('観戦エラー:', error);
            UIManager.showError('観戦中にエラーが発生しました');
        }
    }

    // 🔧 【修正】シンプルな退出メソッド（一時退出機能削除）
    leaveRoom() {
        console.log('🚪 ルーム退出処理開始');
        
        try {
            // Step 1: サーバーに退出を通知
            if (this.game.socketClient && this.game.socketClient.isConnected()) {
                console.log('📤 サーバーに退出通知送信');
                this.game.socketClient.leaveRoom();
            }
            
            // Step 2: 全状態をリセット
            this.forceResetAllStates();
            
            // Step 3: ロビー画面に戻る
            UIManager.showScreen('lobby');
            UIManager.showError('ルームを退出しました', 'success');
            
            console.log('✅ ルーム退出完了');
            
        } catch (error) {
            console.error('❌ 退出エラー:', error);
            
            // エラーでもロビーには戻す
            this.forceResetAllStates();
            UIManager.showScreen('lobby');
            UIManager.showError('退出しました', 'warning');
        }
    }

    // 🔧 【追加】ゲーム中退出の確認ダイアログ
    confirmGameLeave() {
        if (this.game.gameData && this.game.gameData.gameState === 'playing') {
            const shouldLeave = confirm(
                '⚠️ ゲーム中です！\n' +
                '退出すると他のプレイヤーに影響があります。\n\n' +
                '本当に退出しますか？'
            );
            
            if (shouldLeave) {
                this.leaveRoom();
            }
        } else {
            // ゲーム中でなければそのまま退出
            this.leaveRoom();
        }
    }

    // 🔧 【保持】既存の状態リセットメソッド
    forceResetAllStates() {
        console.log('🔧 全状態強制リセット実行');
        
        try {
            // Socket状態リセット
            this.isJoining = false;
            this.isCreating = false;
            this.lastJoinAttempt = 0;
            this.lastCreateAttempt = 0;
            
            // ゲーム状態リセット
            this.game.roomId = null;
            this.game.gameData = null;
            this.game.isHost = false;
            this.game.isSpectator = false;
            this.game.myName = null;
            
            // UI状態リセット
            UIManager.showSpectatorMode(false);
            UIManager.showPlayerName('');
            
            // ボタン状態リセット
            this.updateButtonStates();
            
            // ストレージクリア
            try {
                // StorageManagerが未定義の場合は直接localStorage操作
                if (typeof StorageManager !== 'undefined' && StorageManager.clearAllData) {
                    StorageManager.clearAllData();
                } else {
                    // フォールバック: 直接localStorage操作
                    localStorage.removeItem('pigGamePlayerInfo');
                    localStorage.removeItem('pigGameRejoinInfo');
                    console.log('✅ ストレージクリア完了（フォールバック）');
                }
            } catch (e) {
                console.warn('ストレージクリア失敗:', e);
            }
            
            // デバッグカウンター更新
            this.debug.resetCount++;
            
            console.log('✅ 全状態リセット完了');
            
        } catch (error) {
            console.error('❌ 状態リセットエラー:', error);
        }
    }

    // 🔧 【保持】既存のボタン状態更新
    updateButtonStates() {
        try {
            const joinBtn = safeGetElement('join-room');
            const createBtn = safeGetElement('create-room');
            const leaveBtn = safeGetElement('leave-room');
            const gameLeaveBtn = safeGetElement('game-leave-room');
            
            if (joinBtn) {
                joinBtn.disabled = false;
                joinBtn.textContent = 'ルームに参加';
            }
            
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.textContent = 'ルームを作成';
            }
            
            if (leaveBtn) {
                leaveBtn.textContent = '🚪 ルームを退出';
                leaveBtn.disabled = false;
            }
            
            if (gameLeaveBtn) {
                gameLeaveBtn.textContent = '🚪 ゲームを退出';
                gameLeaveBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('ボタン状態更新エラー:', error);
        }
    }

    // 🔧 【保持】既存のルーム情報表示
    showRoomInfo() {
        try {
            UIManager.showScreen('room-info');
            
            const roomIdDisplay = safeGetElement('room-id-display');
            if (roomIdDisplay && this.game.roomId) {
                roomIdDisplay.textContent = this.game.roomId;
            }
            
            if (this.game.gameData && this.game.gameData.players) {
                UIManager.updatePlayersList(this.game.gameData.players, this.game.gameData.host);
            }
            
            const startButton = safeGetElement('start-game');
            if (startButton) {
                const playerCount = this.game.gameData?.players?.length || 0;
                const canStart = this.game.isHost && playerCount >= 3;
                
                startButton.style.display = this.game.isHost ? 'block' : 'none';
                startButton.disabled = !canStart;
                
                if (this.game.isHost) {
                    startButton.textContent = playerCount >= 3 
                        ? '豚小屋探検開始' 
                        : `豚小屋探検開始 (${playerCount}/3人)`;
                }
            }
            
        } catch (error) {
            console.error('ルーム情報表示エラー:', error);
        }
    }

    // 🔧 【保持】既存のサーバーイベント処理メソッド
    onRoomCreated(data) {
        console.log('✅ ルーム作成成功:', data);
        try {
            this.isCreating = false;
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = true;
            
            UIManager.showError('ルームを作成しました！', 'success');
            this.showRoomInfo();
            
        } catch (error) {
            console.error('ルーム作成成功処理エラー:', error);
        }
    }

    onRoomJoined(data) {
        console.log('✅ ルーム参加成功:', data);
        try {
            this.isJoining = false;
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.isHost;
            
            UIManager.showError('ルームに参加しました！', 'success');
            this.showRoomInfo();
            
        } catch (error) {
            console.error('ルーム参加成功処理エラー:', error);
        }
    }

    onSpectateSuccess(data) {
        console.log('✅ 観戦開始成功:', data);
        try {
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isSpectator = true;
            
            UIManager.showSpectatorMode(true);
            UIManager.showScreen('game-board');
            UIManager.showError('観戦を開始しました！', 'success');
            
        } catch (error) {
            console.error('観戦成功処理エラー:', error);
        }
    }

    onError(data) {
        console.error('❌ サーバーエラー:', data);
        try {
            const message = data.message || 'エラーが発生しました';
            UIManager.showError(message);
            
            // 状態をリセット
            this.isJoining = false;
            this.isCreating = false;
            this.updateButtonStates();
            
        } catch (error) {
            console.error('エラー処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のゲーム更新処理
    onGameUpdate(gameData) {
        try {
            this.game.gameData = gameData;
            
            if (gameData.gameState === 'waiting') {
                this.showRoomInfo();
            } else if (gameData.gameState === 'playing') {
                UIManager.showScreen('game-board');
            }
            
        } catch (error) {
            console.error('ゲーム更新処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のホスト変更処理
    onHostChanged(data) {
        console.log('👑 ホスト変更:', data);
        try {
            if (this.game.gameData) {
                this.game.gameData.host = data.newHostId;
                this.game.isHost = (data.newHostId === this.game.socketClient.socket.id);
                
                UIManager.showError(data.message, 'warning');
                this.showRoomInfo();
            }
        } catch (error) {
            console.error('ホスト変更処理エラー:', error);
        }
    }
}
