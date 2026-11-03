// server/socketHandlers.js - 整理版（handlers/フォルダーとの重複解消）

const { setupConnectionHandlers } = require('./handlers/connection-handlers');
const { setupRoomHandlers } = require('./handlers/room-handlers');
const { setupGameHandlers } = require('./handlers/game-handlers');
const { setupChatHandlers } = require('./handlers/chat-handlers');

function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（統合版v2）');

    // 🔧 【修正】handlers/フォルダーの個別ハンドラーを統合使用
    const socketRequestHistory = setupConnectionHandlers(io);
    
    // 各ハンドラーにactiveRoomsを共有させる必要がある場合の処理
    // （既存のhandlers/内のファイルがactiveRoomsを管理している場合）
    
    console.log('🏁 Socket.io ハンドラー設定完了（統合版v2）');
}

module.exports = { 
    setupSocketHandlers
};
