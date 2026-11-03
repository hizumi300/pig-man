// 🔧 【保持】既存の import 文
import { SocketClient } from './socket-client.js';
import { UIManager } from './ui-manager.js';
import { RoomManager } from '../components/room-manager.js';
import { GameBoard } from '../components/game-board.js';
import { Chat } from '../components/chat.js';

// 🔧 【保持】既存の safeGetElement と safeAddEventListener 関数
function safeGetElement(id) {
    try {
        return document.getElementById(id);
    } catch (error) {
        console.warn(`Element not found: ${id}`);
        return null;
    }
}

function safeAddEventListener(elementId, event, handler) {
    try {
        const element = safeGetElement(elementId);
        if (element) {
            element.addEventListener(event, handler);
            console.log(`✅ ${elementId} に ${event} イベントリスナー追加`);
        } else {
            console.warn(`⚠️ ${elementId} 要素が見つかりません`);
        }
    } catch (error) {
        console.error(`イベントリスナー追加エラー (${elementId}):`, error);
    }
}

export class Game {
    constructor() {
        console.log('🎮 Game クラス初期化開始');
        
        // 🔧 【保持】既存のプロパティ
        this.roomId = null;
        this.gameData = null;
        this.myName = null;
        this.isHost = false;
        this.isSpectator = false;
        this.mySocketId = null;
        
        // 🔧 【保持】既存のマネージャー初期化
        this.socketClient = new SocketClient(this);
        this.roomManager = new RoomManager(this);
        this.gameBoard = new GameBoard(this);
        this.chat = new Chat(this);
        
        this.setupEventListeners();
        
        console.log('✅ Game クラス初期化完了');
    }

    // 🔧 【修正】完全に修正されたsetupEventListeners メソッド
    setupEventListeners() {
        try {
            console.log('🔧 イベントリスナー設定開始');
            
            // 🔧 【保持】既存のパスワード表示切り替え
            safeAddEventListener('use-password', 'change', (e) => {
                const passwordGroup = safeGetElement('password-group');
                if (passwordGroup) {
                    passwordGroup.style.display = e.target.checked ? 'block' : 'none';
                }
            });

            // 🔧 【保持】既存のルーム関連イベント
            safeAddEventListener('create-room', 'click', (e) => {
                e.preventDefault();
                this.roomManager.createRoom();
            });

            safeAddEventListener('join-room', 'click', (e) => {
                e.preventDefault();
                this.roomManager.joinRoom();
            });

            safeAddEventListener('spectate-room', 'click', (e) => {
                e.preventDefault();
                this.roomManager.spectateRoom();
            });

            // 🔧 【修正】退出関連イベント - シンプル退出のみ
            safeAddEventListener('leave-room', 'click', (e) => {
                e.preventDefault();
                this.roomManager.leaveRoom();
            });

            // 🔧 【修正】ゲーム中退出 - 確認ダイアログ付き
            safeAddEventListener('game-leave-room', 'click', (e) => {
                e.preventDefault();
                this.roomManager.confirmGameLeave();
            });

            // 🔧 【保持】既存のゲーム関連イベント
            safeAddEventListener('start-game', 'click', (e) => {
                e.preventDefault();
                this.startGame();
            });

            // 🔧 【保持】勝利画面からの退出
            safeAddEventListener('return-to-lobby', 'click', (e) => {
                e.preventDefault();
                this.roomManager.leaveRoom();
            });

            // 🔧 【保持】既存のリフレッシュボタン
            safeAddEventListener('refresh-rooms', 'click', (e) => {
                e.preventDefault();
                this.socketClient.getRoomList();
            });

            safeAddEventListener('refresh-ongoing', 'click', (e) => {
                e.preventDefault();
                this.socketClient.getOngoingGames();
            });

            // 🔧 【保持】既存のチャット関連
            safeAddEventListener('send-chat', 'click', (e) => {
                e.preventDefault();
                this.chat.sendChat();
            });

            // 🔧 【修正】チャット入力のイベントリスナー（構文エラー修正）
            const chatInput = safeGetElement('chat-input');
            if (chatInput) {
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.chat.sendChat();
                    }
                });
            }
            
            // 🔧 【保持】既存のページ離脱時の警告
            window.addEventListener('beforeunload', (e) => {
                if (this.roomId && this.gameData && this.gameData.gameState === 'playing') {
                    e.preventDefault();
                    e.returnValue = 'ゲーム中です。本当にページを離れますか？';
                    return e.returnValue;
                }
            });

            // 🔧 【保持】既存の手動再接続ボタン
            this.addManualReconnectButton();

            console.log('✅ イベントリスナー設定完了');
        } catch (error) {
            console.error('イベントリスナー設定エラー:', error);
        }
    }

    // 🔧 【保持】既存の手動再接続ボタン追加
    addManualReconnectButton() {
        try {
            // 既存のボタンがあれば削除
            const existingBtn = document.getElementById('manual-reconnect');
            if (existingBtn) {
                existingBtn.remove();
            }

            const reconnectBtn = document.createElement('button');
            reconnectBtn.id = 'manual-reconnect';
            reconnectBtn.className = 'btn btn-small';
            reconnectBtn.textContent = '🔄 再接続';
            reconnectBtn.style.cssText = `
                position: fixed;
                top: 10px;
                left: 200px;
                z-index: 1000;
                width: auto;
                font-size: 12px;
                padding: 6px 12px;
            `;
            
            reconnectBtn.onclick = () => {
                console.log('手動再接続ボタンクリック');
                
                // ゲーム中の再接続を防止
                if (this.roomId && this.gameData) {
                    console.warn('⚠️ ゲーム中の手動再接続はスキップします');
                    UIManager.showError('ゲーム中は再接続ボタンを使用できません', 'warning');
                    return;
                }
                
                try {
                    this.socketClient.forceReconnect();
                    UIManager.showError('再接続を試行中...', 'warning');
                } catch (error) {
                    console.error('手動再接続エラー:', error);
                    UIManager.showError('再接続に失敗しました');
                }
            };
            
            document.body.appendChild(reconnectBtn);
        } catch (error) {
            console.error('手動再接続ボタン追加エラー:', error);
        }
    }

    // 🔧 【保持】既存のサーバーからのイベント処理
    onRoomCreated(data) {
        try {
            this.roomManager.onRoomCreated(data);
        } catch (error) {
            console.error('ルーム作成イベント処理エラー:', error);
        }
    }

    onRoomJoined(data) {
        try {
            this.roomManager.onRoomJoined(data);
        } catch (error) {
            console.error('ルーム参加イベント処理エラー:', error);
        }
    }

    onSpectateSuccess(data) {
        try {
            this.roomManager.onSpectateSuccess(data);
        } catch (error) {
            console.error('観戦成功イベント処理エラー:', error);
        }
    }

    onError(data) {
        try {
            this.roomManager.onError(data);
        } catch (error) {
            console.error('エラーイベント処理エラー:', error);
        }
    }

    onGameUpdate(gameData) {
        try {
            this.roomManager.onGameUpdate(gameData);
        } catch (error) {
            console.error('ゲーム更新イベント処理エラー:', error);
        }
    }

    onHostChanged(data) {
        try {
            this.roomManager.onHostChanged(data);
        } catch (error) {
            console.error('ホスト変更イベント処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のゲーム開始メソッド
    startGame() {
        console.log('🎮 ゲーム開始要求');
        
        try {
            if (!this.isHost) {
                UIManager.showError('ゲームを開始できるのはホストのみです');
                return;
            }

            const playerCount = this.gameData?.players?.length || 0;
            if (playerCount < 3) {
                UIManager.showError('ゲーム開始には最低3人必要です');
                return;
            }

            this.socketClient.startGame();
            UIManager.showError('ゲームを開始中...', 'warning');

        } catch (error) {
            console.error('ゲーム開始エラー:', error);
            UIManager.showError('ゲーム開始でエラーが発生しました');
        }
    }

    // 🔧 【保持】既存のゲーム開始イベント処理
    onGameStart(gameData) {
        console.log('🎮 ゲーム開始:', gameData);
        
        try {
            this.gameData = gameData;
            this.gameBoard.onGameStart(gameData);
            UIManager.showScreen('game-board');
            UIManager.showError('ゲームが開始されました！', 'success');
            
        } catch (error) {
            console.error('ゲーム開始イベント処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のラウンド開始処理
    onRoundStart(roundNumber) {
        console.log('🔄 ラウンド開始:', roundNumber);
        
        try {
            this.gameBoard.onRoundStart(roundNumber);
            
        } catch (error) {
            console.error('ラウンド開始イベント処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のカード選択結果処理
    onCardResult(data) {
        console.log('🃏 カード選択結果:', data);
        
        try {
            this.gameBoard.onCardResult(data);
            
        } catch (error) {
            console.error('カード選択結果処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のゲーム終了処理
    onGameEnd(data) {
        console.log('🏁 ゲーム終了:', data);
        
        try {
            this.gameBoard.onGameEnd(data);
            
        } catch (error) {
            console.error('ゲーム終了イベント処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のチャットメッセージ処理
    onChatMessage(data) {
        try {
            this.chat.addMessage(data);
        } catch (error) {
            console.error('チャットメッセージ処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のゲームログ処理
    onGameLog(data) {
        try {
            this.chat.addGameLog(data.message);
        } catch (error) {
            console.error('ゲームログ処理エラー:', error);
        }
    }

    // 🔧 【保持】既存のルーム一覧更新処理
    onRoomList(roomList) {
        console.log('🏠 ルーム一覧更新:', roomList);
        
        try {
            UIManager.updateRoomList(roomList);
        } catch (error) {
            console.error('ルーム一覧更新エラー:', error);
        }
    }

    // 🔧 【保持】既存の進行中ゲーム更新処理
    onOngoingGames(gamesList) {
        console.log('🎮 進行中ゲーム更新:', gamesList);
        
        try {
            UIManager.updateOngoingGames(gamesList);
        } catch (error) {
            console.error('進行中ゲーム更新エラー:', error);
        }
    }

    // 🔧 【保持】既存のロビー復帰メソッド
    returnToLobby() {
        console.log('🏠 ロビー復帰処理');
        
        try {
            if (this.roomManager && typeof this.roomManager.leaveRoom === 'function') {
                this.roomManager.leaveRoom();
            } else {
                console.warn('⚠️ roomManager.leaveRoom が見つからない - 代替処理実行');
                // 代替処理
                UIManager.showScreen('lobby');
                UIManager.showError('ロビーに戻りました', 'success');
            }
        } catch (error) {
            console.error('ロビー復帰エラー:', error);
            // エラーでもロビーには戻す
            UIManager.showScreen('lobby');
            UIManager.showError('ロビーに戻りました', 'warning');
        }
    }

    // 🔧 【追加】連戦開始メソッド（重複削除）
    restartGame() {
        console.log('🔄 連戦開始処理');
        
        try {
            if (!this.isHost) {
                console.warn('⚠️ 連戦開始はホストのみ可能');
                UIManager.showError('連戦開始はホストのみ実行できます');
                return;
            }

            if (!this.socketClient || !this.socketClient.isConnected()) {
                console.warn('⚠️ サーバー未接続');
                UIManager.showError('サーバーとの接続が切断されています');
                return;
            }

            this.socketClient.restartGame();
            UIManager.showError('新しいゲームを開始中...', 'warning');
            
        } catch (error) {
            console.error('連戦開始エラー:', error);
            UIManager.showError('連戦開始でエラーが発生しました');
        }
    }

    // 🔧 【追加】勝利画面イベント処理メソッド（重複削除）
    onGameEnded(data) {
        console.log('🏁 ゲーム終了イベント受信:', data);
        
        try {
            // ゲームデータ更新
            if (this.gameData) {
                this.gameData.gameState = 'finished';
                this.gameData.winningTeam = data.winningTeam;
                this.gameData.victoryMessage = data.victoryMessage;
            }

            // GameBoardクラスに勝利画面表示を委譲
            if (this.gameBoard && typeof this.gameBoard.handleVictoryScreen === 'function') {
                this.gameBoard.handleVictoryScreen(this.gameData);
            } else {
                // フォールバック処理
                UIManager.showVictoryScreen(this.gameData || data);
            }
            
        } catch (error) {
            console.error('ゲーム終了イベント処理エラー:', error);
        }
    }

    // 🔧 【追加】ゲーム再開イベント処理メソッド（重複削除）
    onGameRestarted(gameData) {
        console.log('🔄 ゲーム再開イベント受信:', gameData);
        
        try {
            this.gameData = gameData;
            
            if (this.gameBoard && typeof this.gameBoard.updateGameUI === 'function') {
                this.gameBoard.updateGameUI();
            }
            
            UIManager.showError('新しいゲームが開始されました！', 'success');
            
        } catch (error) {
            console.error('ゲーム再開イベント処理エラー:', error);
        }
    }

    // 🔧 【削除】onRestartGame メソッド（重複のため削除）

    // 🔧 【保持】既存のデバッグ情報取得
    getDebugInfo() {
        try {
            return {
                roomId: this.roomId,
                gameState: this.gameData?.gameState || 'なし',
                playerName: this.myName,
                isHost: this.isHost,
                isSpectator: this.isSpectator,
                socketId: this.mySocketId,
                socketInfo: this.socketClient?.getDebugInfo() || {},
                roomManagerInfo: this.roomManager?.debug || {}
            };
        } catch (error) {
            console.error('デバッグ情報取得エラー:', error);
            return { error: 'デバッグ情報取得失敗' };
        }
    }
}
