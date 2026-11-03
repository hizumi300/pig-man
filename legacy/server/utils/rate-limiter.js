// レート制限機能

function checkRateLimit(socketId, action, socketRequestHistory) {
    const now = Date.now();
    const history = socketRequestHistory.get(socketId);
    
    if (!history) {
        // 新しいSocketの場合は履歴を作成
        socketRequestHistory.set(socketId, {
            lastJoinRequest: action === 'join' ? now : 0,
            lastCreateRequest: action === 'create' ? now : 0,
            lastChatRequest: action === 'chat' ? now : 0,
            requestCooldown: 3000 // 3秒
        });
        return true;
    }
    
    let lastRequest = 0;
    let cooldown = history.requestCooldown;
    
    switch (action) {
        case 'join':
            lastRequest = history.lastJoinRequest;
            cooldown = 3000; // 参加は3秒
            break;
        case 'create':
            lastRequest = history.lastCreateRequest;
            cooldown = 5000; // 作成は5秒
            break;
        case 'chat':
            lastRequest = history.lastChatRequest;
            cooldown = 1000; // チャットは1秒
            break;
        default:
            cooldown = 3000;
            break;
    }
    
    // クールダウンチェック
    if (now - lastRequest < cooldown) {
        console.warn(`⚠️ レート制限: Socket ${socketId}, action: ${action}`);
        return false;
    }
    
    // 履歴更新
    switch (action) {
        case 'join':
            history.lastJoinRequest = now;
            break;
        case 'create':
            history.lastCreateRequest = now;
            break;
        case 'chat':
            history.lastChatRequest = now;
            break;
    }
    
    return true;
}

function cleanupRateLimit(socketRequestHistory) {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1時間
    
    for (const [socketId, history] of socketRequestHistory) {
        const lastActivity = Math.max(
            history.lastJoinRequest,
            history.lastCreateRequest,
            history.lastChatRequest
        );
        
        if (now - lastActivity > maxAge) {
            socketRequestHistory.delete(socketId);
        }
    }
}

// 定期的なクリーンアップ（1時間ごと）
function setupRateLimitCleanup(socketRequestHistory) {
    setInterval(() => {
        console.log('🧹 レート制限履歴の定期清理実行');
        cleanupRateLimit(socketRequestHistory);
        console.log(`現在のSocket履歴数: ${socketRequestHistory.size}`);
    }, 60 * 60 * 1000); // 1時間ごと
}

module.exports = {
    checkRateLimit,
    cleanupRateLimit,
    setupRateLimitCleanup
};
