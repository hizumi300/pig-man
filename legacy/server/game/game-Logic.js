// server/game/game-Logic.js - 完全修正版（既存ファイルに不足関数を追加）

// 🔧 【追加】不足している基本関数群

// ルームID生成関数
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 役職割り当て関数
function assignRoles(playerCount) {
    const roles = [];
    
    // 基本的な役職配分
    if (playerCount <= 3) {
        // 3人以下：探検家1-2人、豚男1-2人
        const adventurerCount = Math.floor(playerCount / 2) + (playerCount % 2);
        const guardianCount = playerCount - adventurerCount;
        
        for (let i = 0; i < adventurerCount; i++) roles.push('adventurer');
        for (let i = 0; i < guardianCount; i++) roles.push('guardian');
    } else if (playerCount <= 5) {
        // 4-5人：探検家3人、豚男2人（基本）
        const guardianCount = Math.max(1, Math.floor(playerCount * 0.4));
        const adventurerCount = playerCount - guardianCount;
        
        for (let i = 0; i < adventurerCount; i++) roles.push('adventurer');
        for (let i = 0; i < guardianCount; i++) roles.push('guardian');
    } else {
        // 6人以上：約30-40%が豚男
        const guardianCount = Math.max(2, Math.floor(playerCount * 0.35));
        const adventurerCount = playerCount - guardianCount;
        
        for (let i = 0; i < adventurerCount; i++) roles.push('adventurer');
        for (let i = 0; i < guardianCount; i++) roles.push('guardian');
    }
    
    // シャッフル
    return shuffleArray(roles);
}

// 全カード生成関数
// server/game/game-Logic.js - カード枚数修正版（該当関数のみ置き換え）

// 🔧 【修正】正しいカード配分ルール
function generateAllCards(playerCount) {
    let treasureCount, trapCount;
    
    // 🔧 【修正】プレイヤー数に応じた正しいカード配分
    switch (playerCount) {
        case 3:
            treasureCount = 5;  // 子豚5匹
            trapCount = 2;      // 罠2個
            break;
        case 4:
            treasureCount = 6;  // 子豚6匹
            trapCount = 2;      // 罠2個
            break;
        case 5:
            treasureCount = 7;  // 子豚7匹
            trapCount = 2;      // 罠2個
            break;
        case 6:
            treasureCount = 8;  // 子豚8匹
            trapCount = 2;      // 罠2個
            break;
        case 7:
            treasureCount = 7;  // 子豚7匹
            trapCount = 2;      // 罠2個
            break;
        case 8:
            treasureCount = 8;  // 子豚8匹
            trapCount = 2;      // 罠2個
            break;
        case 9:
            treasureCount = 9;  // 子豚9匹
            trapCount = 2;      // 罠2個
            break;
        case 10:
            treasureCount = 10; // 子豚10匹
            trapCount = 3;      // 罠3個
            break;
        default:
            // 3人未満・10人超の場合のフォールバック
            treasureCount = Math.max(3, Math.min(10, playerCount + 2));
            trapCount = playerCount >= 10 ? 3 : 2;
    }
    
    const totalCards = playerCount * 5; // 初期手札数（1ラウンド目）
    const emptyCount = totalCards - treasureCount - trapCount;
    
    console.log(`🎴 カード配分 (${playerCount}人): 子豚${treasureCount}匹, 罠${trapCount}個, 空き部屋${emptyCount}個`);
    
    const cards = [];
    
    // 子豚カード
    for (let i = 0; i < treasureCount; i++) {
        cards.push({
            type: 'treasure',
            id: `treasure-${i}`,
            revealed: false
        });
    }
    
    // 罠カード
    for (let i = 0; i < trapCount; i++) {
        cards.push({
            type: 'trap',
            id: `trap-${i}`,
            revealed: false
        });
    }
    
    // 空き部屋カード
    for (let i = 0; i < emptyCount; i++) {
        cards.push({
            type: 'empty',
            id: `empty-${i}`,
            revealed: false
        });
    }
    
    return {
        cards: shuffleArray(cards),
        treasureCount,
        trapCount,
        emptyCount
    };
}

// 🔧 【修正】勝利条件計算も同じルールに合わせる
function calculateVictoryGoal(playerCount) {
    let treasureGoal, trapGoal;
    
    switch (playerCount) {
        case 3:
            treasureGoal = 5;   // 子豚5匹
            trapGoal = 2;       // 罠2個
            break;
        case 4:
            treasureGoal = 6;   // 子豚6匹
            trapGoal = 2;       // 罠2個
            break;
        case 5:
            treasureGoal = 7;   // 子豚7匹
            trapGoal = 2;       // 罠2個
            break;
        case 6:
            treasureGoal = 8;   // 子豚8匹
            trapGoal = 2;       // 罠2個
            break;
        case 7:
            treasureGoal = 7;   // 子豚7匹
            trapGoal = 2;       // 罠2個
            break;
        case 8:
            treasureGoal = 8;   // 子豚8匹
            trapGoal = 2;       // 罠2個
            break;
        case 9:
            treasureGoal = 9;   // 子豚9匹
            trapGoal = 2;       // 罠2個
            break;
        case 10:
            treasureGoal = 10;  // 子豚10匹
            trapGoal = 3;       // 罠3個
            break;
        default:
            treasureGoal = Math.max(3, Math.min(10, playerCount + 2));
            trapGoal = playerCount >= 10 ? 3 : 2;
    }
    
    console.log(`🎯 勝利条件 (${playerCount}人): 子豚${treasureGoal}匹救出 or 罠${trapGoal}個発動`);
    
    return { treasureGoal, trapGoal };
}

// カード配布関数
function distributeCards(allCards, playerCount, cardsPerPlayer) {
    const playerHands = [];
    const shuffledCards = shuffleArray([...allCards]);
    
    for (let i = 0; i < playerCount; i++) {
        const hand = [];
        for (let j = 0; j < cardsPerPlayer; j++) {
            const cardIndex = i * cardsPerPlayer + j;
            if (cardIndex < shuffledCards.length) {
                hand.push(shuffledCards[cardIndex]);
            }
        }
        playerHands.push(shuffleArray(hand));
    }
    
    return { playerHands };
}

// 勝利条件計算関数


// ゲーム初期化関数
function initializeGameData(playerCount) {
    const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
    const assignedRoles = assignRoles(playerCount);
    const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
    
    return {
        treasureGoal,
        trapGoal,
        totalTreasures: treasureCount,
        totalTraps: trapCount,
        assignedRoles,
        allCards: cards,
        maxRounds: 4,
        currentRound: 1
    };
}

// ゲーム終了条件チェック関数
function checkGameEndConditions(gameData) {
    // 探検家チームの勝利：すべての子豚を救出
    if (gameData.treasureFound >= gameData.treasureGoal) {
        return {
            ended: true,
            winner: 'adventurer',
            message: `全ての子豚（${gameData.treasureGoal}匹）を救出しました！探検家チームの勝利です！`
        };
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        return {
            ended: true,
            winner: 'guardian',
            message: `全ての罠（${gameData.trapGoal}個）が発動しました！豚男チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：最大ラウンド終了
    if (gameData.currentRound > gameData.maxRounds) {
        return {
            ended: true,
            winner: 'guardian',
            message: `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`
        };
    }
    
    return { ended: false };
}

// ラウンド別手札枚数を計算
function getCardsPerPlayerForRound(round) {
    const cardsPerRound = { 1: 5, 2: 4, 3: 3, 4: 2 };
    return cardsPerRound[round] || 5;
}

// 配列シャッフル関数
function shuffleArray(array) {
    if (!Array.isArray(array)) {
        console.warn('シャッフル対象が配列ではありません:', array);
        return [];
    }

    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// ラウンド進行処理
function advanceToNextRound(gameData, connectedPlayerCount) {
    console.log('📋 ===== ラウンド進行処理 =====');
    console.log('現在のラウンド:', gameData.currentRound);
    
    gameData.currentRound++;
    console.log(`📈 ラウンド進行: ${gameData.currentRound - 1} → ${gameData.currentRound}`);
    
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('⏰ 4ラウンド終了！豚男チームの勝利');
        return { gameEnded: true, reason: 'max_rounds_reached' };
    }
    
    const newCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
    gameData.cardsPerPlayer = newCardsPerPlayer;
    gameData.cardsFlippedThisRound = 0;
    
    console.log(`🆕 ラウンド ${gameData.currentRound} 開始準備完了（手札${newCardsPerPlayer}枚）`);
    return { 
        newRound: gameData.currentRound, 
        gameEnded: false, 
        cardsPerPlayer: newCardsPerPlayer,
        needsCardRecycle: true 
    };
}

// 正しいカードリサイクルシステム
function correctCardRecycleSystem(gameData, connectedPlayers) {
    console.log('♻️ ===== 正しいカードリサイクルシステム開始 =====');
    console.log(`ラウンド ${gameData.currentRound} 開始前の処理`);
    
    try {
        // 1. 現在のゲーム状況を確認
        const remainingTreasures = gameData.totalTreasures - gameData.treasureFound;
        const remainingTraps = gameData.totalTraps - gameData.trapTriggered;
        
        console.log(`残り子豚: ${remainingTreasures}, 残り罠: ${remainingTraps}`);
        
        // 2. 接続中プレイヤーの手札を回収
        connectedPlayers.forEach((player) => {
            const handSize = player.hand ? player.hand.length : 0;
            console.log(`${player.name}: ${handSize}枚回収`);
            player.hand = []; // 手札を空にする
        });
        
        // 3. 次ラウンドの必要カード数を計算
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        const totalNeededCards = connectedPlayers.length * nextRoundCardsPerPlayer;
        
        console.log(`次ラウンド手札: ${nextRoundCardsPerPlayer}枚/人, 総必要数: ${totalNeededCards}枚`);
        
        // 4. 新しいカードプールを作成（残存カード保証付き）
        const newCardPool = [];
        
        // 4-1. 残りの子豚カードを必ず含める
        for (let i = 0; i < remainingTreasures; i++) {
            newCardPool.push({
                type: 'treasure',
                id: `treasure-${i}-${Date.now()}`,
                revealed: false
            });
        }
        
        // 4-2. 残りの罠カードを必ず含める
        for (let i = 0; i < remainingTraps; i++) {
            newCardPool.push({
                type: 'trap',
                id: `trap-${i}-${Date.now()}`,
                revealed: false
            });
        }
        
        // 4-3. 残りを空き部屋カードで埋める
        const remainingSlots = totalNeededCards - remainingTreasures - remainingTraps;
        for (let i = 0; i < remainingSlots; i++) {
            newCardPool.push({
                type: 'empty',
                id: `empty-${i}-${Date.now()}`,
                revealed: false
            });
        }
        
        console.log(`新カードプール: 子豚${remainingTreasures}, 罠${remainingTraps}, 空き${remainingSlots}`);
        
        // 5. カードプールをシャッフル
        const shuffledPool = shuffleArray(newCardPool);
        
        // 6. 各プレイヤーにランダム配布
        connectedPlayers.forEach((player) => {
            const newHand = [];
            for (let i = 0; i < nextRoundCardsPerPlayer; i++) {
                if (shuffledPool.length > 0) {
                    newHand.push(shuffledPool.pop());
                }
            }
            player.hand = shuffleArray(newHand);
            
            const cardTypes = player.hand.reduce((acc, card) => {
                acc[card.type] = (acc[card.type] || 0) + 1;
                return acc;
            }, {});
            
            console.log(`${player.name}: ${player.hand.length}枚配布 (子豚${cardTypes.treasure || 0}, 罠${cardTypes.trap || 0}, 空き${cardTypes.empty || 0})`);
        });
        
        // 7. ゲームデータの更新
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        console.log('✅ 正しいカードリサイクル処理完了');
        return {
            success: true,
            newCardsPerPlayer: nextRoundCardsPerPlayer
        };
        
    } catch (error) {
        console.error('❌ カードリサイクル処理エラー:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 🔧 【重要】module.exportsに全ての関数を含める
module.exports = {
    generateRoomId,
    assignRoles,
    generateAllCards,
    shuffleArray,
    distributeCards,
    calculateVictoryGoal,
    initializeGameData,
    checkGameEndConditions,
    getCardsPerPlayerForRound,
    advanceToNextRound,
    correctCardRecycleSystem
};
