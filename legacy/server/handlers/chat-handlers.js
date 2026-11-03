// server/handlers/chat-handlers.js - チャットログ100件対応版

function setupChatHandlers(io, socket, activeRooms) {  // activeRoomsを引数で受け取る
    
    // チャット送信
    socket.on('sendChat', (message) => {
        if (!socket.roomId || !socket.playerName) {
            console.warn('チャット送信失敗: ルーム情報不足');
            return;
        }
        
        const room = activeRooms.get(socket.roomId);
        if (!room) {
            console.warn('チャット送信失敗: ルームが見つからない');
            return;
        }
        
        // メッセージバリデーション
        if (!message || typeof message !== 'string') {
            socket.emit('error', { message: 'メッセージが無効です' });
            return;
        }
        
        const trimmedMessage = message.trim();
        if (trimmedMessage.length === 0) {
            return;
        }
        
        if (trimmedMessage.length > 100) {
            socket.emit('error', { message: 'メッセージが長すぎます（100文字以内）' });
            return;
        }
        
        // チャットメッセージオブジェクト作成
        const chatMessage = {
            type: 'player',
            playerName: socket.playerName,
            text: trimmedMessage,
            timestamp: Date.now()
        };
        
        // システムメッセージの場合
        if (socket.isSpectator) {
            chatMessage.playerName = `👁️ ${socket.playerName}`;
        }
        
        // ルームのメッセージ履歴に追加
        if (!room.gameData.messages) {
            room.gameData.messages = [];
        }
        
        room.gameData.messages.push(chatMessage);
        
        // 🔧 【修正】最新100件を保持（20件から100件に拡張）
        if (room.gameData.messages.length > 100) {
            room.gameData.messages = room.gameData.messages.slice(-100);
        }
        
        // ルーム内の全員にメッセージを送信
        io.to(socket.roomId).emit('newMessage', room.gameData.messages);
        
        console.log(`💬 チャット: [${socket.roomId}] ${socket.playerName}: ${trimmedMessage}`);
    });
}

// 🔧 【修正】ゲームログ送信関数（100件対応）
function sendGameLog(io, roomId, logMessage, activeRooms) {
    if (!activeRooms) {
        console.error('❌ activeRoomsが提供されていません');
        return;
    }
    
    const room = activeRooms.get(roomId);
    if (!room) {
        console.warn('❌ ゲームログ送信: ルームが見つかりません');
        return;
    }
    
    const gameLogMessage = {
        type: 'game-log',
        text: logMessage,
        timestamp: Date.now()
    };
    
    if (!room.gameData.messages) {
        room.gameData.messages = [];
    }
    
    room.gameData.messages.push(gameLogMessage);
    
    // 🔧 【修正】最新100件を保持（20件から100件に拡張）
    if (room.gameData.messages.length > 100) {
        room.gameData.messages = room.gameData.messages.slice(-100);
    }
    
    io.to(roomId).emit('newMessage', room.gameData.messages);
    console.log(`🎮 ゲームログ: [${roomId}] ${logMessage}`);
}

module.exports = {
    setupChatHandlers,
    sendGameLog
};
