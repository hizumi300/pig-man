// main.js - 完全修正版（重複防止対応）

import { Game } from './core/game.js';

console.log('🐷 豚小屋探検隊 JavaScript 開始');

// 🔧 【重要】グローバル初期化フラグチェック
if (window.pigGameInitialized) {
    console.warn('⚠️ Game は既に初期化済み - 重複初期化を防止');
    // 既存のインスタンスがある場合はそれを使用
    if (window.pigGame) {
        console.log('✅ 既存のGameインスタンスを使用');
    }
} else {
    // 折りたたみ機能
    window.toggleSection = (sectionId) => {
        const section = document.getElementById(sectionId);
        if (!section) {
            console.warn('⚠️ セクションが見つかりません:', sectionId);
            return;
        }
        
        const button = section.previousElementSibling;
        const icon = button ? button.querySelector('.toggle-icon') : null;
        
        section.classList.toggle('collapsed');
        if (icon) {
            icon.textContent = section.classList.contains('collapsed') ? '▼' : '▲';
        }
    };

    // ゲーム初期化
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🎮 DOM読み込み完了 - ゲーム初期化開始');
        
        // 🔧 【重要】重複初期化防止チェック
        if (window.pigGameInitialized || window.pigGame) {
            console.warn('⚠️ 既にゲームが初期化済み - 処理をスキップ');
            return;
        }
        
        // 🔧 【重要】初期化フラグ設定
        window.pigGameInitialized = true;
        
        try {
            const game = new Game();
            window.pigGame = game;
            console.log('✅ Game インスタンス作成完了');
            
            // 🔧 【追加】重複防止確認ログ
            console.log('🔧 重複防止確認:', {
                pigGameInitialized: window.pigGameInitialized,
                pigGameInstance: !!window.pigGame,
                socketInstance: !!window.globalSocketInstance,
                gameSocketId: window.pigGame?.socketClient?.getSocketId() || 'なし'
            });
            
            // ルール表示切り替え
            const toggleRulesBtn = document.getElementById('toggle-rules');
            if (toggleRulesBtn) {
                toggleRulesBtn.addEventListener('click', function() {
                    const rules = document.getElementById('game-rules');
                    if (!rules) {
                        console.warn('⚠️ ゲームルール要素が見つかりません');
                        return;
                    }
                    
                    const isHidden = rules.style.display === 'none' || rules.style.display === '';
                    rules.style.display = isHidden ? 'block' : 'none';
                    this.textContent = isHidden ? 'ルールを隠す' : 'ルールを表示';
                });
                console.log('✅ ルール表示切り替え機能初期化完了');
            } else {
                console.warn('⚠️ toggle-rules ボタンが見つかりません');
            }
            
            // 🔧 【重要】勝利画面の固定ボタンイベント処理
             const returnToLobbyBtn = document.getElementById('return-to-lobby');
            const restartGameBtn = document.getElementById('restart-game');
            
            if (returnToLobbyBtn) {
                // 既存のイベントリスナーをクリア（重複防止）
                returnToLobbyBtn.replaceWith(returnToLobbyBtn.cloneNode(true));
                const newReturnBtn = document.getElementById('return-to-lobby');
                
                newReturnBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation(); // 🔧 【追加】イベント伝播を停止
                    console.log('🏠 固定ロビー復帰ボタンクリック');
                    
                    // 🔧 【重要】重複実行防止
                    if (this.disabled) {
                        console.warn('⚠️ ボタンが無効化されています');
                        return;
                    }
                    
                    this.disabled = true;
                    this.textContent = '処理中...';
                    setTimeout(() => { 
                        if (this) {
                            this.disabled = false; 
                            this.textContent = '🏠 ロビーに戻る';
                        }
                    }, 3000); // 3秒間無効化
                    
                    if (window.pigGame && typeof window.pigGame.returnToLobby === 'function') {
                        window.pigGame.returnToLobby();
                    } else {
                        console.error('❌ pigGame.returnToLobby メソッドが見つかりません');
                        // フォールバック処理
                        if (window.pigGame && window.pigGame.socketClient) {
                            window.pigGame.socketClient.returnToLobby();
                        }
                    }
                });
                console.log('✅ 固定ロビー復帰ボタンのイベントリスナー登録完了（安全化済み）');
            } else {
                console.warn('⚠️ return-to-lobby ボタンが見つかりません（動的生成される可能性あり）');
            }
            
            if (restartGameBtn) {
                // 既存のイベントリスナーをクリア（重複防止）
                restartGameBtn.replaceWith(restartGameBtn.cloneNode(true));
                const newRestartBtn = document.getElementById('restart-game');
                
                newRestartBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation(); // 🔧 【追加】イベント伝播を停止
                    console.log('🔄 固定連戦開始ボタンクリック');
                    
                    // 🔧 【重要】重複実行防止
                    if (this.disabled) {
                        console.warn('⚠️ ボタンが無効化されています');
                        return;
                    }
                    
                    this.disabled = true;
                    this.textContent = '処理中...';
                    setTimeout(() => { 
                        if (this) {
                            this.disabled = false; 
                            this.textContent = '🔄 もう一戦！';
                        }
                    }, 5000); // 5秒間無効化
                    
                    if (window.pigGame && typeof window.pigGame.restartGame === 'function') {
                        window.pigGame.restartGame();
                    } else {
                        console.error('❌ pigGame.restartGame メソッドが見つかりません');
                        // フォールバック処理
                        if (window.pigGame && window.pigGame.socketClient) {
                            window.pigGame.socketClient.restartGame();
                        }
                    }
                });
                console.log('✅ 固定連戦開始ボタンのイベントリスナー登録完了（安全化済み）');
            } else {
                console.warn('⚠️ restart-game ボタンが見つかりません（動的生成される可能性あり）');
            }
            
            // 🔧 【追加】動的ボタン処理の無効化フラグ
            window.disableDynamicButtons = false; // デフォルトは有効
            
            // 🔧 【追加】安全なボタン検証関数
            window.validateButtonClick = function(element) {
                // 固定ボタンが存在し、機能している場合は動的処理を無効化
                const fixedReturnBtn = document.getElementById('return-to-lobby');
                const fixedRestartBtn = document.getElementById('restart-game');
                
                if (fixedReturnBtn && !fixedReturnBtn.disabled && fixedReturnBtn.style.display !== 'none') {
                    if (element.textContent && element.textContent.includes('ロビー')) {
                        console.log('🔧 固定ボタンが利用可能なため動的処理をスキップ');
                        return false;
                    }
                }
                
                if (fixedRestartBtn && !fixedRestartBtn.disabled && fixedRestartBtn.style.display !== 'none') {
                    if (element.textContent && element.textContent.includes('もう一戦')) {
                        console.log('🔧 固定ボタンが利用可能なため動的処理をスキップ');
                        return false;
                    }
                }
                
                return true;
            };
            
            // 🔧 【修正】動的ボタンのフォールバック処理（誤クリック防止強化）
            let lastClickTime = 0;
            const clickCooldown = 1000; // 1秒のクールダウン
            
            document.addEventListener('click', function(e) {
                const now = Date.now();
                
                // 🔧 【重要】クリック間隔チェック（重複防止）
                if (now - lastClickTime < clickCooldown) {
                    console.warn('⚠️ クリック間隔が短すぎます - 重複防止');
                    e.preventDefault();
                    return;
                }
                
                // 🔧 【重要】より厳格な要素チェック（誤クリック防止）
                const target = e.target;
                
                // ボタン要素かどうかの厳格なチェック
                const isButton = target.tagName === 'BUTTON' || 
                                target.classList.contains('btn') || 
                                target.closest('button') !== null;
                
                // 勝利画面内の要素かどうかのチェック
                const isInVictoryScreen = target.closest('#victory-screen') !== null;
                
                // 🔧 【修正】厳格な条件でのみ動的ボタン処理を実行
                if (isButton && isInVictoryScreen && target.textContent) {
                    const buttonText = target.textContent.trim();
                    
                    // 🔧 【追加】安全性チェック
                    if (window.disableDynamicButtons) {
                        console.log('🔧 動的ボタン処理が無効化されています');
                        return;
                    }
                    
                    // 🔧 【追加】固定ボタンとの競合チェック
                    if (window.validateButtonClick && !window.validateButtonClick(target)) {
                        return;
                    }
                    
                    // より具体的なテキストマッチング
                    if (buttonText === 'ロビーに戻る' || buttonText === '🏠 ロビーに戻る') {
                        e.preventDefault();
                        e.stopPropagation();
                        lastClickTime = now;
                        
                        console.log('🏠 フォールバック: 動的ロビー復帰ボタンクリック');
                        
                        // 🔧 【追加】確認ダイアログ（誤クリック防止）
                        if (!confirm('ロビーに戻りますか？\n（ゲームが終了します）')) {
                            return;
                        }
                        
                        if (window.pigGame && typeof window.pigGame.returnToLobby === 'function') {
                            window.pigGame.returnToLobby();
                        } else if (window.pigGame && typeof window.pigGame.onReturnToLobby === 'function') {
                            window.pigGame.onReturnToLobby();
                        } else {
                            console.error('❌ pigGame.returnToLobby メソッドが見つかりません');
                            // 最終フォールバック
                            if (window.pigGame && window.pigGame.socketClient) {
                                window.pigGame.socketClient.returnToLobby();
                            }
                        }
                        return;
                    }
                    
                    if (buttonText === 'もう一戦！' || buttonText === '🔄 もう一戦！') {
                        e.preventDefault();
                        e.stopPropagation();
                        lastClickTime = now;
                        
                        console.log('🔄 フォールバック: 動的連戦開始ボタンクリック');
                        
                        // 🔧 【追加】確認ダイアログ（誤クリック防止）
                        if (!confirm('新しいゲームを開始しますか？')) {
                            return;
                        }
                        
                        if (window.pigGame && typeof window.pigGame.restartGame === 'function') {
                            window.pigGame.restartGame();
                        } else if (window.pigGame && typeof window.pigGame.onRestartGame === 'function') {
                            window.pigGame.onRestartGame();
                        } else {
                            console.error('❌ pigGame.restartGame メソッドが見つかりません');
                            // 最終フォールバック
                            if (window.pigGame && window.pigGame.socketClient) {
                                window.pigGame.socketClient.restartGame();
                            }
                        }
                        return;
                    }
                }
                
                // 🔧 【追加】デバッグ情報（開発時のみ）
                if (target.textContent && (
                    target.textContent.includes('ロビー') || 
                    target.textContent.includes('もう一戦') ||
                    target.textContent.includes('戻る')
                )) {
                    console.log('🔍 疑わしいクリック検出:', {
                        tagName: target.tagName,
                        className: target.className,
                        textContent: target.textContent,
                        isButton: isButton,
                        isInVictoryScreen: isInVictoryScreen,
                        parentElement: target.parentElement?.tagName
                    });
                }
            });
            
            // 🔧 【追加】デバッグ用グローバル関数
            window.debugVictory = function() {
                console.log('=== 勝利画面デバッグ ===');
                console.log('pigGame:', window.pigGame);
                console.log('isHost:', window.pigGame?.isHost);
                console.log('returnToLobby:', typeof window.pigGame?.returnToLobby);
                console.log('onReturnToLobby:', typeof window.pigGame?.onReturnToLobby);
                console.log('restartGame:', typeof window.pigGame?.restartGame);
                console.log('onRestartGame:', typeof window.pigGame?.onRestartGame);
                console.log('socketClient:', window.pigGame?.socketClient);
                console.log('socketClient.returnToLobby:', typeof window.pigGame?.socketClient?.returnToLobby);
                console.log('socketClient.restartGame:', typeof window.pigGame?.socketClient?.restartGame);
                console.log('==================');
            };
            
            // 🔧 【追加】ゲーム状態デバッグ関数
            window.debugGame = function() {
                console.log('=== ゲーム状態デバッグ ===');
                console.log('roomId:', window.pigGame?.roomId);
                console.log('gameData:', window.pigGame?.gameData);
                console.log('mySocketId:', window.pigGame?.mySocketId);
                console.log('myName:', window.pigGame?.myName);
                console.log('isHost:', window.pigGame?.isHost);
                console.log('isSpectator:', window.pigGame?.isSpectator);
                console.log('Socket接続状態:', window.pigGame?.socketClient?.isConnected());
                console.log('Socket ID:', window.pigGame?.socketClient?.getSocketId());
                console.log('Transport:', window.pigGame?.socketClient?.getTransportName());
                console.log('グローバルSocket:', !!window.globalSocketInstance);
                console.log('初期化フラグ:', window.pigGameInitialized);
                console.log('===================');
            };
            
            // 🔧 【追加】エラー状態デバッグ関数
            window.debugError = function() {
                console.log('=== エラー状態デバッグ ===');
                console.log('RoomManager状態:', window.pigGame?.roomManager?.getDebugInfo());
                console.log('SocketClient状態:', window.pigGame?.socketClient?.getDebugInfo());
                console.log('最後のエラー:', window.pigGame?.roomManager?.debug?.lastError);
                console.log('リセット回数:', window.pigGame?.roomManager?.debug?.resetCount);
                console.log('参加試行回数:', window.pigGame?.roomManager?.debug?.joinAttempts);
                console.log('===================');
            };
            
            // 🔧 【追加】強制リセット関数
            window.forceReset = function() {
                console.log('🔧 強制リセット実行');
                if (window.pigGame && window.pigGame.roomManager && typeof window.pigGame.roomManager.forceResetAllStates === 'function') {
                    window.pigGame.roomManager.forceResetAllStates();
                    console.log('✅ 強制リセット完了');
                } else {
                    console.error('❌ 強制リセット関数が見つかりません');
                }
            };
            
            // 🔧 【追加】手動再接続関数
            window.manualReconnect = function() {
                console.log('🔄 手動再接続実行');
                if (window.pigGame && window.pigGame.socketClient && typeof window.pigGame.socketClient.forceReconnect === 'function') {
                    window.pigGame.socketClient.forceReconnect();
                    console.log('✅ 手動再接続要求送信');
                } else {
                    console.error('❌ 手動再接続関数が見つかりません');
                }
            };
            
            // 🔧 【追加】ボタン状態チェック関数
            window.checkButtons = function() {
                console.log('=== ボタン状態チェック ===');
                const buttons = [
                    'create-room', 'join-room', 'rejoin-room', 'spectate-room',
                    'start-game', 'leave-room', 'return-to-lobby', 'restart-game'
                ];
                
                buttons.forEach(buttonId => {
                    const btn = document.getElementById(buttonId);
                    if (btn) {
                        console.log(`${buttonId}: 存在=${btn ? 'あり' : 'なし'}, 無効=${btn?.disabled}, 表示=${btn?.style.display || 'デフォルト'}`);
                    } else {
                        console.log(`${buttonId}: 要素が見つかりません`);
                    }
                });
                console.log('=======================');
            };
            
            // 🔧 【追加】完全な状態表示関数
            window.fullStatus = function() {
                console.log('=== 完全状態表示 ===');
                window.debugGame();
                window.debugError();
                window.checkButtons();
                window.debugVictory();
                console.log('==================');
            };
            
            // 🔧 【追加】緊急修復関数
            window.emergencyFix = function() {
                console.log('🚨 緊急修復開始');
                
                try {
                    // 1. 強制リセット
                    if (window.pigGame && window.pigGame.roomManager) {
                        window.pigGame.roomManager.forceResetAllStates();
                    }
                    
                    // 2. Socket再接続
                    if (window.pigGame && window.pigGame.socketClient) {
                        window.pigGame.socketClient.forceReconnect();
                    }
                    
                    // 3. UI画面をロビーに戻す
                    const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
                    screens.forEach(screenName => {
                        const screen = document.getElementById(screenName);
                        if (screen) {
                            screen.style.display = screenName === 'lobby' ? 'block' : 'none';
                        }
                    });
                    
                    // 4. エラーメッセージをクリア
                    const errorEl = document.getElementById('error-message');
                    if (errorEl) {
                        errorEl.style.display = 'none';
                    }
                    
                    console.log('✅ 緊急修復完了');
                    
                } catch (error) {
                    console.error('❌ 緊急修復エラー:', error);
                }
            };
            
            // 🔧 【追加】重複防止専用関数
            window.checkDuplicates = function() {
                console.log('=== 重複状態チェック ===');
                console.log('pigGameInitialized:', window.pigGameInitialized);
                console.log('pigGame存在:', !!window.pigGame);
                console.log('globalSocketInstance:', !!window.globalSocketInstance);
                console.log('Socket接続状態:', window.pigGame?.socketClient?.isConnected());
                console.log('Socket ID:', window.pigGame?.socketClient?.getSocketId());
                console.log('現在のルーム:', window.pigGame?.roomId);
                console.log('プレイヤー名:', window.pigGame?.myName);
                console.log('=========================');
            };
            
            // 🔧 【追加】初期化状態リセット関数（開発用）
            window.resetInitialization = function() {
                console.log('🔧 初期化状態リセット（開発用）');
                
                const confirmed = confirm('初期化状態をリセットしますか？\n（ページリロードが推奨されます）');
                if (!confirmed) return;
                
                try {
                    // グローバルフラグリセット
                    window.pigGameInitialized = false;
                    
                    // Socket切断
                    if (window.globalSocketInstance) {
                        window.globalSocketInstance.disconnect();
                        window.globalSocketInstance = null;
                    }
                    
                    if (window.pigGame?.socketClient?.socket) {
                        window.pigGame.socketClient.socket.disconnect();
                    }
                    
                    // インスタンス削除
                    window.pigGame = null;
                    
                    console.log('✅ 初期化状態リセット完了 - ページリロードを推奨');
                    
                } catch (error) {
                    console.error('❌ リセットエラー:', error);
                }
            };
            
            // 🔧 【追加】ヘルプ関数（拡張版）
            window.gameHelp = function() {
                console.log(`
=== 豚小屋探検隊 デバッグコマンド（拡張版） ===
【基本デバッグ】
debugGame()          - ゲーム状態を表示
debugVictory()       - 勝利画面の状態を表示
debugError()         - エラー状態を表示
checkButtons()       - ボタンの状態を確認
fullStatus()         - 全ての状態を表示

【修復・操作】
forceReset()         - 強制リセット実行
manualReconnect()    - 手動再接続
emergencyFix()       - 緊急修復（全リセット）

【重複防止関連】
checkDuplicates()    - 重複状態確認
resetInitialization() - 初期化状態リセット（開発用）

【使用例】
1. ゲームが動かない時: emergencyFix()
2. 参加できない時: forceReset()
3. 接続が切れた時: manualReconnect()
4. 重複問題確認: checkDuplicates()
5. 状態確認: fullStatus()
================================================
                `);
            };
            
            // 初期状態をコンソールに表示
            console.log('🎮 豚小屋探検隊初期化完了！（重複防止対応）');
            console.log('💡 困った時は gameHelp() をコンソールで実行してください');
            console.log('🔧 重複問題の確認は checkDuplicates() を実行してください');
            
        } catch (error) {
            console.error('❌ ゲーム初期化エラー:', error);
            
            // 🔧 【重要】エラー時はフラグをリセット
            window.pigGameInitialized = false;
            
            // UIManagerが使えない場合のフォールバック
            const errorEl = document.getElementById('error-message');
            if (errorEl) {
                errorEl.textContent = 'ゲームの初期化に失敗しました。ページをリロードしてください。';
                errorEl.style.display = 'block';
            }
            
            // エラー時も基本的なデバッグ関数は提供
            window.emergencyReload = function() {
                console.log('🔄 緊急リロード実行');
                window.location.reload();
            };
            
            console.log('💡 緊急時は emergencyReload() でページをリロードできます');
        }
    });
}
