// 🔧 【保持】既存のアクティブルーム管理
const activeRooms = new Map();

// 🔧 【保持】既存のバリデーション関数
function validatePlayerName(name) {
    return name && typeof name === 'string' && name.trim().length > 0 && name.length <= 20;
}

function validateRoomId(roomId) {
    return roomId && typeof roomId === 'string' && /^[A-Z0-9]{4,10}$/.test(roomId);
}

// 🔧 【保持】既存のランダムルームID生成
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 🔧 【保持】既存のセットアップ関数
function setupRoomHandlers(io) {
    io.on('connection', (socket) => {
        console.log('🔌 新しい接続:', socket.id);

        // 🔧 【保持】既存のルーム作成イベント
        socket.on('createRoom', (data) => {
            console.log('🏠 ルーム作成要求:', data);
            const { playerName, hasPassword, password } = data;
            
            // バリデーション
            if (!validatePlayerName(playerName)) {
                socket.emit('error', { message: 'プレイヤー名が無効です' });
                return;
            }

            // ルームID生成（重複チェック）
            let roomId;
            do {
                roomId = generateRoomId();
            } while (activeRooms.has(roomId));

            // ルーム作成
            const room = {
                id: roomId,
                hostName: playerName,
                players: [{
                    id: socket.id,
                    name: playerName,
                    connected: true
                }],
                gameData: {
                    gameState: 'waiting',
                    host: socket.id,
                    players: [{
                        id: socket.id,
                        name: playerName,
                        connected: true
                    }],
                    password: hasPassword ? password : null
                }
            };

            activeRooms.set(roomId, room);
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;

            socket.emit('roomCreated', {
                roomId: roomId,
                gameData: room.gameData
            });

            updateRoomList(io);
            console.log(`✅ ルーム ${roomId} を作成: ${playerName}`);
        });

        // 🔧 【保持】既存のルーム参加イベント
        socket.on('joinRoom', (data) => {
            console.log('👥 ルーム参加要求:', data);
            const { roomId, playerName, password } = data;
            
            // バリデーション
            if (!validatePlayerName(playerName) || !validateRoomId(roomId)) {
                socket.emit('error', { message: '入力データが無効です' });
                return;
            }

            const room = activeRooms.get(roomId);
            if (!room) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }

            // パスワードチェック
            if (room.gameData.password && room.gameData.password !== password) {
                socket.emit('error', { message: 'パスワードが間違っています' });
                return;
            }

            // プレイヤー数制限
            if (room.players.length >= 10) {
                socket.emit('error', { message: 'ルームが満員です' });
                return;
            }

            // ゲーム状態チェック
            if (room.gameData.gameState !== 'waiting') {
                socket.emit('error', { message: 'ゲームが既に開始されています' });
                return;
            }

            // 同名プレイヤーチェック
            if (room.players.some(p => p.name === playerName)) {
                socket.emit('error', { message: '同じ名前のプレイヤーが既に参加しています' });
                return;
            }

            // プレイヤー追加
            const newPlayer = {
                id: socket.id,
                name: playerName,
                connected: true
            };

            room.players.push(newPlayer);
            room.gameData.players.push(newPlayer);

            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;

            socket.emit('roomJoined', {
                roomId: roomId,
                gameData: room.gameData,
                isHost: false
            });

            io.to(roomId).emit('gameUpdate', room.gameData);
            updateRoomList(io);
            
            console.log(`✅ ${playerName} がルーム ${roomId} に参加`);
        });

        // 🔧 【保持】既存の観戦イベント
        socket.on('spectateRoom', (data) => {
            console.log('👁️ 観戦要求:', data);
            const { roomId, spectatorName } = data;
            
            // バリデーション
            if (!validatePlayerName(spectatorName) || !validateRoomId(roomId)) {
                socket.emit('error', { message: '入力データが無効です' });
                return;
            }
            
            const room = activeRooms.get(roomId);
            if (!room) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            if (room.gameData.gameState !== 'playing') {
                socket.emit('error', { message: 'このルームはゲーム中ではありません' });
                return;
            }
            
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = spectatorName;
            socket.isSpectator = true;
            
            socket.emit('spectateSuccess', {
                roomId: roomId,
                gameData: room.gameData
            });
            
            console.log(`✅ ${spectatorName} がルーム ${roomId} を観戦開始`);
        });

        // 🔧 【修正】シンプルな退出イベントのみ（一時退出削除）
        socket.on('leaveRoom', () => {
            console.log('🚪 ルーム退出:', socket.id);
            handlePlayerLeave(socket, io);
        });

        // 🔧 【保持】既存の切断イベント
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
            handlePlayerDisconnect(socket, io);
        });

        // 🔧 【保持】既存のルーム一覧要求
        socket.on('getRoomList', () => {
            updateRoomList(io, socket);
        });

        // 🔧 【保持】既存の進行中ゲーム一覧要求
        socket.on('getOngoingGames', () => {
            sendOngoingGamesList(io, socket);
        });
    });
}

// 🔧 【修正】プレイヤー退出処理（一時退出機能削除）
function handlePlayerLeave(socket, io) {
    if (!socket.roomId) {
        console.log('⚠️ 退出処理：roomId が存在しません');
        return;
    }
    
    const room = activeRooms.get(socket.roomId);
    if (!room) {
        console.log('⚠️ 退出処理：ルームが見つかりません');
        return;
    }
    
    console.log(`🚪 プレイヤー退出: ${socket.playerName} (${socket.id})`);
    
    // ルームIDを保持（通知に使用）
    const roomIdToNotify = socket.roomId;
    
    // プレイヤーを完全に削除
    room.players = room.players.filter(p => p.id !== socket.id);
    room.gameData.players = room.gameData.players.filter(p => p.id !== socket.id);
    
    // ホストが退出した場合の処理
    if (room.gameData.host === socket.id) {
        const nextHost = room.players.find(p => p.connected);
        if (nextHost) {
            room.gameData.host = nextHost.id;
            console.log(`👑 新しいホスト: ${nextHost.name} (${nextHost.id})`);
            
            // ホスト変更を通知
            io.to(roomIdToNotify).emit('hostChanged', {
                newHostId: nextHost.id,
                newHostName: nextHost.name,
                message: `${nextHost.name} が新しいホストになりました`
            });
        }
    }
    
    // ソケット情報をクリア
    socket.roomId = null;
    socket.playerName = null;
    
    // 全員が退出した場合、ルームを削除
    if (room.players.length === 0) {
        activeRooms.delete(roomIdToNotify);
        console.log('🗑️ 空のルームを削除:', roomIdToNotify);
    } else {
        // ルーム内の他のプレイヤーに更新を送信
        io.to(roomIdToNotify).emit('gameUpdate', room.gameData);
    }
    
    // ルーム一覧更新
    updateRoomList(io);
    
    console.log('✅ 退出処理完了');
}

// 🔧 【修正】プレイヤー切断処理
function handlePlayerDisconnect(socket, io) {
    if (!socket.roomId) return;
    
    const room = activeRooms.get(socket.roomId);
    if (!room) return;
    
    console.log(`🔌 プレイヤー切断処理: ${socket.playerName} (${socket.id})`);
    
    // ルームIDを保持（通知用）
    const roomIdToNotify = socket.roomId;
    
    // プレイヤーを切断状態に（削除はしない）
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
        console.log(`${player.name} が切断しました`);
    }
    
    // ホストが切断した場合の処理（待機中のみ）
    if (room.gameData.host === socket.id && room.gameData.gameState === 'waiting') {
        const nextHost = room.players.find(p => p.connected);
        if (nextHost) {
            room.gameData.host = nextHost.id;
            console.log(`👑 ホスト切断により新しいホスト: ${nextHost.name}`);
            
            // ホスト変更を通知
            io.to(roomIdToNotify).emit('hostChanged', {
                newHostId: nextHost.id,
                newHostName: nextHost.name,
                message: `ホストが切断したため、${nextHost.name} が新しいホストになりました`
            });
        }
    }
    
    // ソケット情報をクリア
    socket.roomId = null;
    socket.playerName = null;
    
    // 全員が切断した場合、ルームを削除
    if (room.players.every(p => !p.connected)) {
        activeRooms.delete(roomIdToNotify);
        console.log('🗑️ 全員切断のためルームを削除:', roomIdToNotify);
    } else {
        // ルーム内の他のプレイヤーに更新を送信
        io.to(roomIdToNotify).emit('gameUpdate', room.gameData);
    }
    
    // ルーム一覧更新
    updateRoomList(io);
}

// 🔧 【保持】既存のルーム一覧更新
function updateRoomList(io, socket = null) {
    const roomList = Array.from(activeRooms.values())
        .filter(room => room.gameData.gameState === 'waiting')
        .map(room => ({
            id: room.id,
            hostName: room.hostName,
            playerCount: room.players.filter(p => p.connected).length,
            hasPassword: !!room.gameData.password
        }));
    
    if (socket) {
        socket.emit('roomList', roomList);
    } else {
        io.emit('roomList', roomList);
    }
    console.log('📋 ルーム一覧更新送信完了, ルーム数:', roomList.length);
}

// 🔧 【保持】既存の進行中ゲーム一覧送信
function sendOngoingGamesList(io, socket = null) {
    const ongoingGames = Array.from(activeRooms.values())
        .filter(room => room.gameData.gameState === 'playing')
        .map(room => ({
            id: room.id,
            hostName: room.hostName,
            playerCount: room.players.filter(p => p.connected).length,
            round: room.gameData.round || 1,
            gameState: room.gameData.gameState
        }));

    if (socket) {
        socket.emit('ongoingGames', ongoingGames);
    } else {
        io.emit('ongoingGames', ongoingGames);
    }
    console.log('🎮 進行中ゲーム一覧送信完了, ゲーム数:', ongoingGames.length);
}

// 🔧 【保持】既存のルームデータの取得と設定
function getActiveRooms() {
    return activeRooms;
}

function setActiveRooms(rooms) {
    activeRooms.clear();
    for (const [key, value] of rooms) {
        activeRooms.set(key, value);
    }
}

// 🔧 【保持】既存のエクスポート
module.exports = {
    setupRoomHandlers,
    handlePlayerLeave,
    handlePlayerDisconnect,
    updateRoomList,
    sendOngoingGamesList,
    getActiveRooms,
    setActiveRooms
};
