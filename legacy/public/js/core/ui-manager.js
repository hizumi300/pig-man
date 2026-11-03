// UIManager - ゲームログ表示修正版（構文エラー修正済み）

export class UIManager {
    // 🔧 【修正】メッセージ更新処理（ゲームログ表示対応）
    static updateMessages(messages) {
        try {
            const container = this.safeGetElement('chat-container');
            if (!container) return;
            
            if (!messages || !Array.isArray(messages)) return;
            
            // 🔧 【修正】最新100件を表示（20件から100件に拡張）
            const recentMessages = messages.slice(-100);
            
            // 🔧 【追加】パフォーマンス最適化: 大量メッセージ用の仮想スクロール検討
            // 現在のメッセージ数をログ出力
            if (recentMessages.length > 50) {
                console.log(`💬 チャット履歴: ${recentMessages.length}件のメッセージを表示中`);
            }
            
            container.innerHTML = '';
            recentMessages.forEach(function(msg, index) {
                try {
                    if (!msg || typeof msg !== 'object') return;

                    const div = document.createElement('div');
                    
                    // ゲームログの適切な表示処理
                    if (msg.type === 'game-log') {
                        div.className = 'chat-message game-log';
                        div.textContent = msg.text || '';
                        
                        // ゲームログの特別な装飾
                        if (msg.text && msg.text.includes('♻️')) {
                            div.style.background = 'rgba(50, 205, 50, 0.2)';
                            div.style.borderLeft = '4px solid #32CD32';
                            div.style.fontWeight = 'bold';
                        } else if (msg.text && msg.text.includes('🐷')) {
                            div.style.background = 'rgba(255, 215, 0, 0.1)';
                            div.style.borderLeft = '4px solid #FFD700';
                        } else if (msg.text && msg.text.includes('💀')) {
                            div.style.background = 'rgba(220, 20, 60, 0.1)';
                            div.style.borderLeft = '4px solid #DC143C';
                        }
                        
                    } else if (msg.type === 'player') {
                        div.className = 'chat-message player';
                        const playerName = msg.playerName || '名前なし';
                        const text = msg.text || '';
                        div.textContent = playerName + ': ' + text;
                        
                    } else {
                        // システムメッセージ
                        div.className = 'chat-message system';
                        div.textContent = msg.text || '';
                    }
                    
                    // 🔧 【追加】タイムスタンプ表示（任意）
                    if (msg.timestamp && recentMessages.length > 20) {
                        const timestamp = new Date(msg.timestamp);
                        const timeStr = timestamp.toLocaleTimeString('ja-JP', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                        div.title = timeStr; // ホバー時に時刻表示
                    }
                    
                    container.appendChild(div);
                } catch (error) {
                    console.error('メッセージアイテム作成エラー:', error);
                }
            });
            
            // スクロール位置を最下部に移動
            container.scrollTop = container.scrollHeight;
            
            // 🔧 【追加】大量メッセージ時のパフォーマンス警告
            if (recentMessages.length > 80) {
                console.warn(`⚠️ チャット履歴が多くなっています（${recentMessages.length}件）。パフォーマンスに注意。`);
            }
            
        } catch (error) {
            console.error('メッセージ更新エラー:', error);
        }
    }

    // ⭐ リサイクル状況表示更新メソッド
    static updateRecycleStatus(status) {
        const recycleEl = this.safeGetElement('recycle-status');
        if (recycleEl) {
            recycleEl.textContent = status;
            recycleEl.style.color = '#32CD32'; // 成功時の緑色
            
            // 3秒後に元の表示に戻す
            setTimeout(() => {
                recycleEl.textContent = 'ラウンド終了時：全部屋調査完了→残存保証→再配布';
                recycleEl.style.color = '#FFA500'; // 元のオレンジ色
            }, 3000);
        }
    }

    // ⭐ リサイクル対応ラウンド開始表示メソッド
    static showRoundStartWithRecycle(roundNumber, recycleInfo = null) {
        try {
            // 既存の showRoundStart メソッドがあれば実行
            if (typeof this.showRoundStart === 'function') {
                this.showRoundStart(roundNumber);
            }
            
            // リサイクル情報を追加表示
            if (recycleInfo) {
                const recycleStatus = `ラウンド${roundNumber}開始！カードリサイクル完了（手札${recycleInfo.newCardsPerPlayer}枚）`;
                this.updateRecycleStatus(recycleStatus);
            } else {
                const recycleStatus = `ラウンド${roundNumber}開始！カードリサイクル完了`;
                this.updateRecycleStatus(recycleStatus);
            }
        } catch (error) {
            console.error('リサイクル対応ラウンド表示エラー:', error);
            // エラーが発生しても既存機能は維持
        }
    }

    // ⭐ ゲーム情報更新（リサイクル情報付き）
    static updateGameInfoWithRecycle(gameData) {
        try {
            // 既存の updateGameInfo メソッドを呼び出し（既存機能維持）
            if (typeof this.updateGameInfo === 'function') {
                this.updateGameInfo(gameData);
            }
            
            // リサイクル情報の追加表示
            if (gameData && gameData.currentRound > 1) {
                const remainingTreasures = (gameData.totalTreasures || 7) - (gameData.treasureFound || 0);
                const remainingTraps = (gameData.totalTraps || 2) - (gameData.trapTriggered || 0);
                
                const recycleEl = this.safeGetElement('recycle-status');
                if (recycleEl) {
                    recycleEl.innerHTML = `R${gameData.currentRound}: 手札${gameData.cardsPerPlayer}枚<br><small>残り子豚${remainingTreasures}匹・罠${remainingTraps}個を回収済み</small>`;
                    recycleEl.style.color = '#32CD32';
                }
            }
        } catch (error) {
            console.error('リサイクル対応ゲーム情報更新エラー:', error);
        }
    }

    // 🔧 【追加】ラウンド開始表示（リサイクル情報付き）
    static showRoundStartWithRecycle(roundNumber) {
        try {
            const overlay = this.safeGetElement('round-start-overlay');
            const message = this.safeGetElement('round-start-message');
            
            if (overlay && message) {
                const roundNum = roundNumber || 1;
                const cardsThisRound = this.getExpectedCardsForRound(roundNum);
                
                let roundMessage = 'ラウンド ' + roundNum + ' スタート！';
                let subMessage = '手札 ' + cardsThisRound + ' 枚';
                
                if (roundNum > 1) {
                    subMessage += '<br><small style="color: #32CD32;">✅ 全カード回収→残存カード保証→再配布完了</small>';
                } else {
                    subMessage += '<br><small style="color: #87CEEB;">初期配布完了</small>';
                }
                
                message.innerHTML = roundMessage + '<br>' + subMessage;
                overlay.style.display = 'flex';
                
                // バイブレーション追加
                if (navigator.vibrate) {
                    if (roundNum > 1) {
                        navigator.vibrate([100, 50, 100, 50, 100, 50, 200]); // リサイクル完了
                    } else {
                        navigator.vibrate([100, 50, 100, 50, 200]); // 初期開始
                    }
                }
                
                setTimeout(function() {
                    overlay.style.display = 'none';
                }, 3500);
            }
        } catch (error) {
            console.error('ラウンド開始表示エラー:', error);
        }
    }

    // 🔧 【追加】ラウンド表示の更新（手札枚数付き）
    static updateRoundDisplayWithCards(gameData) {
        try {
            const currentRound = gameData.currentRound || 1;
            const cardsThisRound = gameData.cardsPerPlayer || 5;
            
            // 手札枚数表示を更新
            this.safeSetText('cards-per-player', cardsThisRound);
            
            // リサイクル情報の更新
            const recycleStatus = this.safeGetElement('recycle-status');
            if (recycleStatus) {
                const remainingTreasures = (gameData.totalTreasures || gameData.treasureGoal || 7) - (gameData.treasureFound || 0);
                const remainingTraps = (gameData.totalTraps || gameData.trapGoal || 2) - (gameData.trapTriggered || 0);
                
                if (currentRound > 1) {
                    recycleStatus.innerHTML = `R${currentRound}: 手札${cardsThisRound}枚<br><small>残り子豚${remainingTreasures}匹・罠${remainingTraps}個を全回収→再配布済み</small>`;
                    recycleStatus.style.color = '#32CD32';
                } else {
                    recycleStatus.innerHTML = `ラウンド終了時：全カード回収→残存カード保証→再配布<br><small>子豚・罠カードは必ず手札に含まれます</small>`;
                    recycleStatus.style.color = '#FFA500';
                }
            }
            
        } catch (error) {
            console.error('ラウンド表示更新エラー:', error);
        }
    }

    // ラウンド別手札枚数の期待値
    static getExpectedCardsForRound(round) {
        const cardsPerRound = { 1: 5, 2: 4, 3: 3, 4: 2 };
        return cardsPerRound[round] || 5;
    }

    // 既存の showRoundStart メソッドを上書き
    static showRoundStart(roundNumber) {
        this.showRoundStartWithRecycle(roundNumber);
    }

    // ゲーム情報更新（正しいカードリサイクル対応）
    static updateGameInfo(gameData) {
        try {
            if (!gameData || typeof gameData !== 'object') {
                console.warn('無効なゲームデータ:', gameData);
                return;
            }

            // 基本情報の安全な更新
            this.safeSetText('treasure-found', gameData.treasureFound || 0);
            this.safeSetText('trap-triggered', gameData.trapTriggered || 0);
            this.safeSetText('trap-goal', gameData.trapGoal || 2);
            this.safeSetText('treasure-goal', gameData.treasureGoal || 7);
            this.safeSetText('cards-flipped', gameData.cardsFlippedThisRound || 0);
            
            // ラウンド表示の特別処理（手札枚数を表示）
            this.updateRoundDisplayWithCards(gameData);
            
        } catch (error) {
            console.error('❌ ゲーム情報更新エラー:', error);
        }
    }

    // ゲーム概要更新（正しいカードリサイクル説明付き）
    static updateGameOverview(playerCount) {
        try {
            let roleText = '';
            let cardText = '';

            switch (playerCount) {
                case 3:
                    roleText = '探検家 1-2人、豚男 1-2人';
                    cardText = '子豚5匹、罠2個、空き部屋8個';
                    break;
                case 4:
                    roleText = '探検家 2-3人、豚男 1-2人';
                    cardText = '子豚6匹、罠2個、空き部屋12個';
                    break;
                case 5:
                    roleText = '探検家 3人、豚男 2人';
                    cardText = '子豚7匹、罠2個、空き部屋16個';
                    break;
                case 6:
                    roleText = '探検家 4人、豚男 2人';
                    cardText = '子豚8匹、罠2個、空き部屋20個';
                    break;
                case 7:
                    roleText = '探検家 4-5人、豚男 2-3人';
                    cardText = '子豚7匹、罠2個、空き部屋26個';
                    break;
                case 8:
                    roleText = '探検家 5-6人、豚男 2-3人';
                    cardText = '子豚8匹、罠2個、空き部屋30個';
                    break;
                case 9:
                    roleText = '探検家 6人、豚男 3人';
                    cardText = '子豚9匹、罠2個、空き部屋34個';
                    break;
                case 10:
                    roleText = '探検家 6-7人、豚男 3-4人';
                    cardText = '子豚10匹、罠3個、空き部屋37個';
                    break;
                default:
                    roleText = 'プレイヤー数: ' + playerCount + '人';
                    cardText = 'カード構成を計算中...';
            }

            // 正しいカードリサイクルの説明を追加
            cardText += '<br><small style="color: #32CD32;">✅ 正しいカードリサイクル：全カード回収→残存カード保証→再配布</small>';
            cardText += '<br><small style="color: #87CEEB;">各ラウンドの手札: 1R→5枚, 2R→4枚, 3R→3枚, 4R→2枚</small>';
            cardText += '<br><small style="color: #FFD700;">⚠️ 未発見の子豚・未発動の罠は必ず手札に含まれます</small>';

            this.safeSetText('role-possibility-text', roleText);
            
            const cardDistEl = this.safeGetElement('card-distribution-text');
            if (cardDistEl) {
                cardDistEl.innerHTML = cardText;
            }
        } catch (error) {
            console.error('ゲーム概要更新エラー:', error);
        }
    }

    // 進捗バー更新
    static updateProgressBars(gameData) {
        try {
            if (!gameData || typeof gameData !== 'object') {
                console.warn('無効なゲームデータ:', gameData);
                return;
            }

            const treasureTotal = gameData.totalTreasures || gameData.treasureGoal || 7;
            const trapTotal = gameData.totalTraps || gameData.trapGoal || 2;
            const treasureFound = gameData.treasureFound || 0;
            const trapTriggered = gameData.trapTriggered || 0;

            // 財宝の進捗バー
            const treasureContainer = this.safeGetElement('treasure-icons');
            if (treasureContainer) {
                treasureContainer.innerHTML = '';
                for (let i = 0; i < treasureTotal; i++) {
                    const icon = document.createElement('div');
                    icon.className = 'progress-icon treasure';
                    if (i < treasureFound) {
                        icon.classList.add('used');
                    }
                    treasureContainer.appendChild(icon);
                }
            }

            // 罠の進捗バー
            const trapContainer = this.safeGetElement('trap-icons');
            if (trapContainer) {
                trapContainer.innerHTML = '';
                for (let i = 0; i < trapTotal; i++) {
                    const icon = document.createElement('div');
                    icon.className = 'progress-icon trap';
                    if (i < trapTriggered) {
                        icon.classList.add('used');
                    }
                    trapContainer.appendChild(icon);
                }
            }
        } catch (error) {
            console.error('進捗バー更新エラー:', error);
        }
    }

    // 🔧 【完全修正】勝利画面表示（固定ボタン対応）
    static showVictoryScreen(gameData) {
        try {
            if (!gameData || typeof gameData !== 'object') {
                console.warn('無効な勝利データ:', gameData);
                return;
            }

            const screen = this.safeGetElement('victory-screen');
            const title = this.safeGetElement('victory-title');
            const messageEl = this.safeGetElement('victory-message');
            const winnersList = this.safeGetElement('winners-list');
            
            if (!screen || !title || !messageEl || !winnersList) {
                console.warn('勝利画面要素が見つかりません');
                return;
            }
            
            if (gameData.winningTeam === 'adventurer') {
                title.textContent = '⛏️ 探検家チームの勝利！';
                title.style.color = '#FFD700';
            } else {
                title.textContent = '🐷 豚男チームの勝利！';
                title.style.color = '#DC143C';
            }
            
            messageEl.textContent = gameData.victoryMessage || 'ゲーム終了！';
            
            // 勝利チーム表示
            winnersList.innerHTML = '<h3>勝利チーム:</h3>';
            
            // ゲーム統計（正しいカードリサイクル情報付き）
            const statsDiv = document.createElement('div');
            statsDiv.style.marginTop = '15px';
            statsDiv.style.fontSize = '14px';
            statsDiv.style.color = '#87CEEB';
            
            const finalRound = gameData.currentRound || 1;
            const maxRounds = gameData.maxRounds || 4;
            const treasureFound = gameData.treasureFound || 0;
            const treasureGoal = gameData.treasureGoal || 7;
            const trapTriggered = gameData.trapTriggered || 0;
            const trapGoal = gameData.trapGoal || 2;
            
            // 正しいカードリサイクル回数を計算
            const recycleCount = Math.max(0, finalRound - 1);
            const remainingTreasures = treasureGoal - treasureFound;
            const remainingTraps = trapGoal - trapTriggered;
            
            statsDiv.innerHTML = '<strong>ゲーム統計:</strong><br>' +
                                '終了ラウンド: ' + finalRound + '/' + maxRounds + '<br>' +
                                '救出された子豚: ' + treasureFound + '/' + treasureGoal + '<br>' +
                                '発動した罠: ' + trapTriggered + '/' + trapGoal + '<br>' +
                                '<small style="color: #32CD32;">✅ 全カード回収→再配布回数: ' + recycleCount + '回</small><br>' +
                                '<small style="color: #FFD700;">最終残存: 子豚' + remainingTreasures + '匹、罠' + remainingTraps + '個</small>';
            
            winnersList.appendChild(statsDiv);
            
            // 勝者一覧
            if (gameData.players && Array.isArray(gameData.players)) {
                const winnersDiv = document.createElement('div');
                winnersDiv.style.marginTop = '15px';
                
                gameData.players.forEach(function(player) {
                    try {
                        if (!player || typeof player !== 'object') return;
                        
                        if ((gameData.winningTeam === 'adventurer' && player.role === 'adventurer') ||
                            (gameData.winningTeam === 'guardian' && player.role === 'guardian')) {
                            const div = document.createElement('div');
                            div.textContent = '🎉 ' + (player.name || '名前なし');
                            div.style.color = '#FFD700';
                            div.style.marginBottom = '5px';
                            winnersDiv.appendChild(div);
                        }
                    } catch (error) {
                        console.error('勝者表示エラー:', error, player);
                    }
                });
                
                winnersList.appendChild(winnersDiv);
            }
            
            // 🔧 【重要】固定ボタンの表示制御
            const lobbyBtn = this.safeGetElement('return-to-lobby');
            const restartBtn = this.safeGetElement('restart-game');
            
            if (lobbyBtn) {
                lobbyBtn.style.display = 'block';
                // イベントリスナーが重複しないようにクリア
                lobbyBtn.onclick = null;
                lobbyBtn.onclick = function() {
                    console.log('🏠 ロビー復帰ボタンクリック（固定ボタン）');
                    if (window.pigGame && typeof window.pigGame.returnToLobby === 'function') {
                        window.pigGame.returnToLobby();
                    } else {
                        console.error('❌ pigGame.returnToLobby メソッドが見つかりません');
                    }
                };
            }
            
            if (restartBtn) {
                // ホストのみ連戦ボタンを表示
                if (window.pigGame && window.pigGame.isHost) {
                    restartBtn.style.display = 'block';
                    restartBtn.onclick = null;
                    restartBtn.onclick = function() {
                        console.log('🔄 連戦開始ボタンクリック（固定ボタン）');
                        if (window.pigGame && typeof window.pigGame.restartGame === 'function') {
                            window.pigGame.restartGame();
                        } else {
                            console.error('❌ pigGame.restartGame メソッドが見つかりません');
                        }
                    };
                } else {
                    restartBtn.style.display = 'none';
                }
            }
            
            screen.style.display = 'flex';
            
            console.log('✅ 勝利画面表示完了（固定ボタン対応）');
            
        } catch (error) {
            console.error('勝利画面表示エラー:', error);
        }
    }

    // 進行中ゲーム一覧更新（正しいカードリサイクル情報付き）
    static updateOngoingGames(games) {
        try {
            const container = this.safeGetElement('ongoing-games-container');
            if (!container) return;
            
            container.innerHTML = '';

            if (!games || !Array.isArray(games) || games.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #32CD32;">現在進行中のゲームはありません</p>';
                return;
            }

            const self = this;
            games.forEach(function(game, index) {
                try {
                    if (!game || typeof game !== 'object') return;

                    const gameDiv = document.createElement('div');
                    gameDiv.className = 'ongoing-game-item';
                    gameDiv.style.cssText = 'background: rgba(4, 56, 76, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(135, 206, 235, 0.2); display: flex; flex-direction: column; gap: 10px;';
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'ongoing-game-info';
                    
                    const gameId = game.id || 'GAME' + index;
                    const currentRound = game.currentRound || 1;
                    const maxRounds = game.maxRounds || 4;
                    const cardsPerPlayer = game.cardsPerPlayer || 5;
                    const playerCount = game.playerCount || 0;
                    const treasureFound = game.treasureFound || 0;
                    const treasureGoal = game.treasureGoal || 7;
                    const trapTriggered = game.trapTriggered || 0;
                    const trapGoal = game.trapGoal || 2;
                    
                    // 正しいカードリサイクル情報を表示
                    const remainingTreasures = treasureGoal - treasureFound;
                    const remainingTraps = trapGoal - trapTriggered;
                    const recycleCount = Math.max(0, currentRound - 1);
                    
                    infoDiv.innerHTML = '<strong>ID: ' + gameId + '</strong><br>' +
                                       'ラウンド: ' + currentRound + '/' + maxRounds + ' | プレイヤー: ' + playerCount + '/10<br>' +
                                       '手札: ' + cardsPerPlayer + '枚 | 救出: ' + treasureFound + '/' + treasureGoal + ' | 罠: ' + trapTriggered + '/' + trapGoal + '<br>' +
                                       '<small style="color: #32CD32;">✅ リサイクル' + recycleCount + '回 | 残存: 子豚' + remainingTreasures + '匹・罠' + remainingTraps + '個</small>';
                    
                    const spectateBtn = document.createElement('button');
                    spectateBtn.className = 'btn btn-small';
                    spectateBtn.textContent = '観戦する';
                    spectateBtn.style.width = '100%';
                    
                    spectateBtn.onclick = function() {
                        try {
                            const spectateRoomInput = self.safeGetElement('spectate-room-id');
                            const spectatorNameInput = self.safeGetElement('spectator-name');
                            
                            if (spectateRoomInput) {
                                spectateRoomInput.value = gameId;
                            }
                            
                            if (spectatorNameInput && !spectatorNameInput.value.trim()) {
                                const spectatorName = '観戦者' + Math.floor(Math.random() * 1000);
                                spectatorNameInput.value = spectatorName;
                            }
                            
                            if (spectatorNameInput) {
                                spectatorNameInput.focus();
                            }
                        } catch (error) {
                            console.error('観戦ボタンクリックエラー:', error);
                        }
                    };
                    
                    gameDiv.appendChild(infoDiv);
                    gameDiv.appendChild(spectateBtn);
                    container.appendChild(gameDiv);
                } catch (error) {
                    console.error('ゲームアイテム作成エラー:', error);
                }
            });
        } catch (error) {
            console.error('進行中ゲーム一覧更新エラー:', error);
        }
    }

    // その他の基本機能（既存コードから継承）
    static showSpectatorMode(isSpectator) {
        try {
            const existingIndicator = document.getElementById('spectator-indicator');
            
            if (isSpectator) {
                if (!existingIndicator) {
                    const indicator = document.createElement('div');
                    indicator.id = 'spectator-indicator';
                    indicator.className = 'spectator-indicator';
                    indicator.textContent = '👁️ 観戦中';
                    document.body.appendChild(indicator);
                }
            } else {
                if (existingIndicator) {
                    existingIndicator.remove();
                }
            }
        } catch (error) {
            console.error('観戦モード表示エラー:', error);
        }
    }

    static showConnectionStatus(status) {
        try {
            const statusEl = this.safeGetElement('connection-status');
            if (!statusEl) return;
            
            if (status === 'connected') {
                statusEl.textContent = '🟢 接続済み';
                statusEl.className = 'connection-status connected';
            } else {
                statusEl.textContent = '🔴 切断';
                statusEl.className = 'connection-status disconnected';
            }
        } catch (error) {
            console.error('接続状態表示エラー:', error);
        }
    }

    static showError(message, type) {
        try {
            if (type === undefined) type = 'error';
            const errorEl = this.safeGetElement('error-message');
            if (!errorEl) return;
            
            errorEl.textContent = message || 'エラーが発生しました';
            errorEl.style.display = 'block';
            
            if (type === 'success') {
                errorEl.style.background = 'rgba(34, 139, 34, 0.9)';
                errorEl.style.borderColor = '#228B22';
            } else if (type === 'warning') {
                errorEl.style.background = 'rgba(255, 165, 0, 0.9)';
                errorEl.style.borderColor = '#FFA500';
            } else {
                errorEl.style.background = 'rgba(220, 20, 60, 0.9)';
                errorEl.style.borderColor = '#DC143C';
            }
            
            const displayTime = type === 'success' ? 3000 : 8000;
            setTimeout(function() {
                if (errorEl && errorEl.style.display === 'block') {
                    errorEl.style.display = 'none';
                }
            }, displayTime);
        } catch (error) {
            console.error('エラー表示処理でエラー:', error);
        }
    }

    static showPlayerName(name) {
        try {
            const displayEl = this.safeGetElement('player-name-display');
            const nameEl = this.safeGetElement('my-name');
            
            if (displayEl && nameEl && name) {
                displayEl.style.display = 'block';
                nameEl.textContent = String(name);
            }
        } catch (error) {
            console.error('プレイヤー名表示エラー:', error);
        }
    }

    static updateRoomList(rooms) {
        try {
            const container = this.safeGetElement('room-list-container');
            if (!container) return;
            
            container.innerHTML = '';

            if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #87CEEB;">現在開設中のルームはありません</p>';
                return;
            }

            const self = this;
            rooms.forEach(function(room, index) {
                try {
                    if (!room || typeof room !== 'object') return;

                    const roomDiv = document.createElement('div');
                    roomDiv.className = 'room-item';
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'room-item-info';
                    
                    const roomId = room.id || 'ROOM' + index;
                    const hostName = room.hostName || '不明';
                    const playerCount = room.playerCount || 0;
                    const hasPassword = room.hasPassword || false;
                    
                    infoDiv.innerHTML = '<strong>ID: ' + roomId + '</strong>' +
                                       (hasPassword ? '<span class="password-icon">🔒</span>' : '') +
                                       '<br>ホスト: ' + hostName + ' | プレイヤー: ' + playerCount + '/10';
                    
                    const joinBtn = document.createElement('button');
                    joinBtn.className = 'btn btn-small';
                    joinBtn.textContent = '参加';
                    
                    joinBtn.onclick = function() {
                        try {
                            const roomIdInput = self.safeGetElement('room-id-input');
                            if (roomIdInput) {
                                roomIdInput.value = roomId;
                            }
                            
                            if (hasPassword) {
                                const passwordGroup = self.safeGetElement('join-password-group');
                                if (passwordGroup) {
                                    passwordGroup.style.display = 'block';
                                }
                            }
                            
                            const playerNameInput = self.safeGetElement('player-name-join');
                            if (playerNameInput) {
                                playerNameInput.focus();
                            }
                        } catch (error) {
                            console.error('ルーム参加ボタンクリックエラー:', error);
                        }
                    };
                    
                    roomDiv.appendChild(infoDiv);
                    roomDiv.appendChild(joinBtn);
                    container.appendChild(roomDiv);
                } catch (error) {
                    console.error('ルームアイテム作成エラー:', error);
                }
            });
        } catch (error) {
            console.error('ルーム一覧更新エラー:', error);
        }
    }

    static showScreen(screenName) {
        try {
            const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
            
            const self = this;
            screens.forEach(function(screen) {
                const element = self.safeGetElement(screen);
                if (element) {
                    element.style.display = 'none';
                }
            });
            
            if (screenName) {
                const screen = this.safeGetElement(screenName);
                if (screen) {
                    screen.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('画面切り替えエラー:', error);
        }
    }

    static updatePlayersList(players, hostId) {
        try {
            const container = this.safeGetElement('players-list');
            const countEl = this.safeGetElement('player-count');
            
            if (!container || !countEl) return;
            
            if (!players || !Array.isArray(players)) {
                container.innerHTML = '<p>プレイヤー情報を取得できませんでした</p>';
                countEl.textContent = '0';
                return;
            }
            
            const count = players.filter(function(p) { return p && p.connected; }).length;
            countEl.textContent = count;
            
            container.innerHTML = '';
            players.forEach(function(player) {
                try {
                    if (!player || typeof player !== 'object') return;

                    const div = document.createElement('div');
                    div.className = 'player-item';
                    
                    if (player.id === hostId) {
                        div.classList.add('host');
                    }
                    
                    const status = player.connected ? '🟢' : '🔴';
                    const playerName = player.name || '名前なし';
                    const disconnectedText = player.connected ? '' : ' (切断中)';
                    div.textContent = status + ' ' + playerName + disconnectedText;
                    
                    if (!player.connected) {
                        div.style.opacity = '0.6';
                        div.style.fontStyle = 'italic';
                    }
                    
                    container.appendChild(div);
                } catch (error) {
                    console.error('プレイヤーアイテム作成エラー:', error);
                }
            });
        } catch (error) {
            console.error('プレイヤー一覧更新エラー:', error);
        }
    }

    // ユーティリティメソッド
    static safeGetElement(id) {
        try {
            if (!id || typeof id !== 'string') {
                return null;
            }
            
            const element = document.getElementById(id);
            if (!element) {
                console.warn('⚠️ 要素が見つかりません: #' + id);
            }
            return element;
        } catch (error) {
            console.error('要素取得エラー (#' + id + '):', error);
            return null;
        }
    }

    static safeSetText(id, text) {
        try {
            const el = this.safeGetElement(id);
            if (el) {
                el.textContent = String(text || '');
                return true;
            }
            return false;
        } catch (error) {
            console.error('テキスト設定エラー (#' + id + '):', error);
            return false;
        }
    }
}
