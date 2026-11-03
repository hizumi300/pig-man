// ユーティリティ関数群

export const safeGetElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ 要素が見つかりません: #${id}`);
    }
    return element;
};

export const safeSetText = (id, text) => {
    const el = safeGetElement(id);
    if (el) {
        el.textContent = text;
        return true;
    }
    return false;
};

export const safeAddEventListener = (id, event, handler) => {
    const element = safeGetElement(id);
    if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ ${id} に${event}イベント追加成功`);
        return true;
    } else {
        console.warn(`⚠️ イベント追加失敗: #${id}`);
        return false;
    }
};

// デバッグ用のグローバル関数
export const setupDebugInfo = () => {
    window.debugInfo = () => {
        const isRenderEnvironment = window.location.hostname.includes('render') || 
                                   window.location.hostname.includes('onrender');
        
        console.log('=== デバッグ情報 ===');
        console.log('URL:', window.location.href);
        console.log('Render環境:', isRenderEnvironment);
        console.log('Socket.io 存在:', typeof io !== 'undefined');
        console.log('PigManGame インスタンス:', window.pigGame ? '存在' : '未作成');
        if (window.pigGame?.socketClient?.socket) {
            console.log('Socket ID:', window.pigGame.socketClient.socket.id);
            console.log('Socket 接続状態:', window.pigGame.socketClient.socket.connected);
            console.log('Socket Transport:', window.pigGame.socketClient.socket.io.engine.transport.name);
        }
        console.log('現在のルームID:', window.pigGame?.roomId || 'なし');
        console.log('プレイヤー名:', window.pigGame?.myName || 'なし');
        console.log('==================');
    };
};

// バイブレーション機能
export const vibrate = (pattern) => {
    if (navigator.vibrate && ('ontouchstart' in window || typeof window.DeviceMotionEvent !== 'undefined')) {
        try {
            const result = navigator.vibrate(pattern);
            console.log('Vibration result:', result, 'Pattern:', pattern);
            return result;
        } catch (error) {
            console.warn('Vibration error:', error);
            return false;
        }
    } else {
        console.log('Vibration not supported on this device');
        return false;
    }
};

// エラーログ送信
export const logError = (type, details, socketClient = null) => {
    const errorInfo = {
        type,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
    };

    console.error('Game Error:', errorInfo);

    if (socketClient && socketClient.isConnected()) {
        socketClient.emit('clientError', errorInfo);
    }
};

// 環境検出
export const isRenderEnvironment = () => {
    return window.location.hostname.includes('render') || 
           window.location.hostname.includes('onrender');
};
