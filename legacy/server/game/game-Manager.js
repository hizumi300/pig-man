class GameManager {
    static games = {};

    static create(roomId, hostId, hostName, hasPassword = false, password = '') {
        const game = {
            id: roomId,
            host: hostId,
            password: hasPassword ? password : null,
            players: [{
                id: hostId,
                name: hostName,
                role: null,
                hand: [],
                connected: true
            }],
            gameState: 'waiting',
            currentRound: 1,
            treasureFound: 0,
            trapTriggered: 0,
            allCards: [],
            playerHands: {},
            remainingCards: [],
            cardsPerPlayer: 5,
            messages: [],
            treasureGoal: 7,
            trapGoal: 2,
            totalTreasures: 7,
            totalTraps: 2,
            keyHolderId: null,
            turnInRound: 0,
            maxRounds: 4,
            cardsFlippedThisRound: 0
        };
        
        this.games[roomId] = game;
        return game;
    }

    static get(roomId) {
        return this.games[roomId];
    }

    static delete(roomId) {
        delete this.games[roomId];
    }

    static getPublicRoomList() {
        return Object.values(this.games)
            .filter(game => game.gameState === 'waiting')
            .map(game => ({
                id: game.id,
                hostName: game.players.find(p => p.id === game.host)?.name || 'Unknown',
                playerCount: game.players.length,
                hasPassword: !!game.password
            }));
    }

    static addPlayer(roomId, playerId, playerName) {
        const game = this.games[roomId];
        if (!game) return null;

        const existingPlayer = game.players.find(p => p.name === playerName);
        if (existingPlayer) {
            existingPlayer.id = playerId;
            existingPlayer.connected = true;
            return existingPlayer;
        }

        const newPlayer = {
            id: playerId,
            name: playerName,
            role: null,
            hand: [],
            connected: true
        };
        game.players.push(newPlayer);
        return newPlayer;
    }

    static removePlayer(roomId, playerId) {
        const game = this.games[roomId];
        if (!game) return;

        const player = game.players.find(p => p.id === playerId);
        if (player) {
            player.connected = false;
        }

        if (game.players.every(p => !p.connected)) {
            delete this.games[roomId];
            return true;
        }
        return false;
    }

    static setGameState(roomId, state) {
        const game = this.games[roomId];
        if (game) {
            game.gameState = state;
        }
    }

    static updateGameData(roomId, updates) {
        const game = this.games[roomId];
        if (game) {
            Object.assign(game, updates);
        }
    }

    // 🆕 【追加】カードリサイクル処理メソッド
    static processCardRecycle(roomId, roundNumber) {
        const game = this.get(roomId);
        if (!game) return { success: false, error: 'ゲームが見つかりません' };
        
        // 既存の correctCardRecycleSystem を活用
        const { correctCardRecycleSystem } = require('./game-Logic');
        const connectedPlayers = game.players.filter(p => p.connected);
        return correctCardRecycleSystem(game, connectedPlayers);
    }

    // 🆕 【追加】ラウンド進行データ更新メソッド
    static updateRoundProgress(roomId, roundData) {
        const game = this.get(roomId);
        if (game) {
            Object.assign(game, roundData);
            return true;
        }
        return false;
    }

    // 🆕 【追加】activeRooms との同期メソッド（データ整合性確保）
    static syncWithActiveRooms(activeRooms) {
        // room-handlers.js の activeRooms との同期
        for (const [roomId, roomData] of activeRooms) {
            const gameData = this.get(roomId);
            if (gameData && roomData) {
                // データ同期処理
                Object.assign(roomData.gameData, gameData);
            }
        }
    }
}

module.exports = GameManager;
