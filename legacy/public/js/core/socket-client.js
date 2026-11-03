// 🔧 【保持】既存のimportとSocketClientクラス
import { UIManager } from './ui-manager.js';

export class SocketClient {
    constructor(game) {
        console.log('SocketClient 初期化開始');
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.connectionTimeout = null;
        this.isConnecting = false;
        this.initializeSocket();
    }

    // 🔧 【保持】既存の安全なプロパティアクセス関数
    safeGetProperty(obj, path, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        
        try {
            const keys = path.split('.');
            let current = obj;
            
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return defaultValue;
                }
            }
            
            return current;
        } catch (error) {
            console.warn('プロパティアクセスエラー:', error);
            return defaultValue;
        }
    }

    // 🔧 【保持】既存のTransport名の安全な取得
    getTransportName() {
        return this.safeGetProperty(this.socket, 'io.engine.transport.name', 'unknown');
    }

    // 🔧 【保持】既存のSocket IDの安全な取得
    getSocketId() {
        return this.safeGetProperty(this.socket, 'id', 'なし');
    }

    // 🔧 【保持】既存の接続状態の確認
    isConnected() {
        try {
            return this.socket && this.socket.connected === true;
        } catch (error) {
            console.warn('接続状態確認エラー:', error);
            return false;
        }
    }

    // 🔧 【保持】既存のSocket初期化
    initializeSocket() {
        console.log('Socket.io 初期化開始');
        
        // 既存Socket接続の完全チェック
        if (window.globalSocketInstance) {
            console.warn('⚠️ 既存のグローバルSocket接続を検出 - 強制切断');
            try {
                window.globalSocketInstance.removeAllListeners();
                window.globalSocketInstance.disconnect();
                window.globalSocketInstance.close();
            } catch (e) {
                console.warn('既存Socket切断エラー:', e);
            }
            window.globalSocketInstance = null;
        }
        
        if (typeof io === 'undefined') {
            console.error('❌ Socket.io が読み込まれていません');
            UIManager.showError('Socket.io ライブラリが読み込まれていません');
            return;
        }

        if (this.isConnecting) {
            console.warn('⚠️ Socket初期化中のため処理をスキップ');
            return;
        }

        // 重複初期化防止フラグ
        if (this.socket && this.socket.connected) {
            console.warn('⚠️ 既に接続済みのSocket');
            return;
        }

        this.isConnecting = true;

        try {
            // Socket.io接続設定
            this.socket = io('/', {
                transports: ['websocket', 'polling'],
                upgrade: true,
                timeout: 20000,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                maxHttpBufferSize: 1e8,
                pingTimeout: 60000,
                pingInterval: 25000,
                forceNew: true
            });

            // グローバル参照設定
            window.globalSocketInstance = this.socket;

            this.setupSocketEventListeners();

        } catch (error) {
            console.error('❌ Socket初期化エラー:', error);
            this.isConnecting = false;
            UIManager.showError('接続の初期化に失敗しました');
        }
    }

    // 🔧 【保持】既存のSocketイベントリスナー設定
    setupSocketEventListeners() {
        const self = this;

        // 接続成功イベント
        this.socket.on('connect', function() {
            console.log('✅ Socket.io 接続成功:', self.socket.id);
            
            // Transport情報取得
            let transportName = 'unknown';
            try {
                transportName = self.getTransportName();
            } catch (e) {
                console.warn('Transport名取得エラー:', e);
            }
            console.log('Transport:', transportName);
            
            self.game.mySocketId = self.socket.id;
            UIManager.showConnectionStatus('connected');
            self.reconnectAttempts = 0;
            self.isConnecting = false;
            
            // 接続後の処理を遅延実行
            setTimeout(function() {
                self.getRoomList();
                self.getOngoingGames();
            }, 2000);
        });

        // 切断イベント
        this.socket.on('disconnect', function(reason) {
            console.log('❌ Socket.io 切断:', reason);
            UIManager.showConnectionStatus('disconnected');
            self.isConnecting = false;
            
            // 切断時もフラグリセット
            if (self.game.roomManager && typeof self.game.roomManager.forceResetJoinState === 'function') {
                console.log('🔧 切断時のフラグリセット実行');
                self.game.roomManager.forceResetJoinState();
            }
            
            if (reason === 'transport close' || reason === 'transport error') {
                console.log('🔄 Render.com環境での切断を検出 - 再接続準備中...');
                UIManager.showError('接続が不安定です。自動的に再接続します...', 'warning');
                
                setTimeout(function() {
                    if (!self.socket.connected && !self.isConnecting) {
                        self.forceReconnect();
                    }
                }, 3000);
            } else if (reason !== 'io client disconnect') {
                UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
            }
        });

        // エラーイベント
        this.socket.on('connect_error', function(error) {
            console.error('❌ Socket.io 接続エラー:', error);
            self.reconnectAttempts++;
            self.isConnecting = false;
            
            // エラーメッセージの安全な取得
            let errorMessage = '';
            try {
                errorMessage = error && error.message ? error.message : 'Unknown error';
            } catch (e) {
                errorMessage = 'Connection error';
            }
            
            if (self.reconnectAttempts >= self.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
                console.error('最大再接続試行回数に到達');
            } else {
                UIManager.showError(`接続エラー: ${errorMessage} (${self.reconnectAttempts}/${self.maxReconnectAttempts})`, 'warning');
            }
        });

        // 🔧 【保持】既存のサーバーイベント処理
        this.setupServerEventListeners();
    }

    // 🔧 【保持】既存のサーバーイベントリスナー設定
    setupServerEventListeners() {
        // ルーム関連イベント
        this.socket.on('roomCreated', (data) => {
            this.game.onRoomCreated(data);
        });

        this.socket.on('roomJoined', (data) => {
            this.game.onRoomJoined(data);
        });

        this.socket.on('spectateSuccess', (data) => {
            this.game.onSpectateSuccess(data);
        });

        this.socket.on('error', (data) => {
            this.game.onError(data);
        });

        this.socket.on('gameUpdate', (data) => {
            this.game.onGameUpdate(data);
        });

        this.socket.on('hostChanged', (data) => {
            this.game.onHostChanged(data);
        });

        // ゲーム関連イベント
        this.socket.on('gameStart', (data) => {
            this.game.onGameStart(data);
        });

        this.socket.on('roundStart', (roundNumber) => {
            this.game.onRoundStart(roundNumber);
        });

        this.socket.on('cardResult', (data) => {
            this.game.onCardResult(data);
        });

        this.socket.on('gameEnd', (data) => {
            this.game.onGameEnd(data);
        });

        this.socket.on('gameEnded', (data) => {
            if (this.game.onGameEnded) {
                this.game.onGameEnded(data);
            } else {
                this.game.onGameEnd(data);
            }
        });

        this.socket.on('gameRestarted', (data) => {
            if (this.game.onGameRestarted) {
                this.game.onGameRestarted(data);
            }
        });

        this.socket.on('newMessage', (messages) => {
            if (typeof UIManager !== 'undefined' && UIManager.updateMessages) {
                UIManager.updateMessages(messages);
            }
        });

        // チャット関連イベント
        this.socket.on('chatMessage', (data) => {
            this.game.onChatMessage(data);
        });

        this.socket.on('gameLog', (data) => {
            this.game.onGameLog(data);
        });

        // リスト更新イベント
        this.socket.on('roomList', (data) => {
            this.game.onRoomList(data);
        });

        this.socket.on('ongoingGames', (data) => {
            this.game.onOngoingGames(data);
        });
    }

    // 🔧 【保持】既存の汎用emit メソッド
    emit(eventName, data = null) {
        if (!this.isConnected()) {
            console.warn(`⚠️ Socket未接続のため${eventName}をスキップ`);
            UIManager.showError('サーバーとの接続が切断されています', 'warning');
            return false;
        }
        
        try {
            if (data !== null) {
                this.socket.emit(eventName, data);
                console.log(`📤 送信: ${eventName}`, data);
            } else {
                this.socket.emit(eventName);
                console.log(`📤 送信: ${eventName}`);
            }
            return true;
        } catch (error) {
            console.error(`Socket通信エラー (${eventName}):`, error);
            UIManager.showError('通信エラーが発生しました', 'error');
            return false;
        }
    }

    // 🔧 【保持】既存のルーム関連メソッド
    createRoom(playerName, hasPassword, password) {
        console.log('🏠 ルーム作成要求');
        return this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        console.log('👥 ルーム参加要求');
        return this.emit('joinRoom', { roomId, playerName, password });
    }

    spectateRoom(roomId, spectatorName) {
        console.log('👁️ 観戦要求');
        return this.emit('spectateRoom', { roomId, spectatorName });
    }

    // 🔧 【修正】シンプルな退出メソッド（一時退出削除）
    leaveRoom() {
        console.log('🚪 ルーム退出要求');
        
        if (!this.isConnected()) {
            console.warn('⚠️ Socket未接続のため退出通知をスキップ');
            return false;
        }
        
        try {
            this.socket.emit('leaveRoom');
            console.log('📤 退出通知送信完了');
            return true;
        } catch (error) {
            console.error('退出通知エラー:', error);
            return false;
        }
    }

    // 🔧 【保持】既存のゲーム関連メソッド
    startGame() {
        console.log('🎮 ゲーム開始要求');
        return this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        console.log('🃏 カード選択:', { targetPlayerId: targetPlayerId, cardIndex: cardIndex });
        
        if (!targetPlayerId || cardIndex === undefined || cardIndex === null) {
            UIManager.showError('無効なカード選択です');
            return false;
        }
        
        return this.emit('selectCard', { targetPlayerId: targetPlayerId, cardIndex: cardIndex });
    }

    // 🔧 【保持】既存のチャット関連メソッド
    sendChatMessage(message) {
        console.log('💬 チャットメッセージ送信');
        if (!message || message.trim().length === 0) {
            return false;
        }
        return this.emit('chatMessage', { message: message.trim() });
    }
    
    // 🔧 【追加】Chat.js で使用される sendChat メソッド
sendChat(message) {
    console.log('💬 チャット送信');
    if (!message || message.trim().length === 0) {
        return false;
    }
    // 🔧 【重要】サーバーで期待されるイベント名は 'sendChat'
    return this.emit('sendChat', message.trim());
}

    // 🔧 【保持】既存のリスト取得メソッド
    getRoomList() {
        console.log('📋 ルーム一覧要求');
        return this.emit('getRoomList');
    }

    getOngoingGames() {
        console.log('🎮 進行中ゲーム一覧要求');
        return this.emit('getOngoingGames');
    }

    // 🔧 【保持】既存のロビー復帰・連戦メソッド
    returnToLobby() {
        console.log('🏠 ロビー復帰要求');
        return this.emit('returnToLobby');
    }
    
    restartGame() {
        console.log('🔄 連戦開始要求');
        return this.emit('restartGame');
    }

    // 🔧 【保持】既存の手動再接続メソッド
    forceReconnect() {
        console.log('🔄 手動再接続開始');
        
        if (this.isConnecting) {
            console.warn('⚠️ 既に接続処理中');
            return;
        }
        
        this.isConnecting = true;
        
        if (this.socket) {
            try {
                this.socket.disconnect();
            } catch (error) {
                console.error('切断エラー:', error);
            }
        }
        
        const self = this;
        setTimeout(function() {
            self.initializeSocket();
        }, 1000);
    }

    // 🔧 【保持】既存の強制切断メソッド
    forceDisconnect() {
        console.log('🔌 強制切断実行');
        try {
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.disconnect();
                this.socket.close();
            }
            
            // グローバルインスタンスもクリア
            if (window.globalSocketInstance === this.socket) {
                window.globalSocketInstance = null;
            }
            
            this.socket = null;
            this.isConnecting = false;
            
            UIManager.showConnectionStatus('disconnected');
            console.log('✅ 強制切断完了');
            
        } catch (error) {
            console.error('強制切断エラー:', error);
        }
    }

    // 🔧 【保持】既存のデバッグ用メソッド
    getDebugInfo() {
        try {
            return {
                socketId: this.getSocketId(),
                connected: this.isConnected(),
                connecting: this.isConnecting,
                transport: this.getTransportName(),
                reconnectAttempts: this.reconnectAttempts
            };
        } catch (error) {
            console.error('デバッグ情報取得エラー:', error);
            return {
                error: 'デバッグ情報取得失敗'
            };
        }
    }
}
