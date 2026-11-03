// チャット機能コンポーネント
import { safeGetElement } from '../utils/helpers.js';

export class Chat {
    constructor(game) {
        this.game = game;
        this.setupChatEvents();
    }

    setupChatEvents() {
        const sendButton = safeGetElement('send-chat');
        const chatInput = safeGetElement('chat-input');

        if (sendButton) {
            sendButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.sendChat();
            });
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendChat();
                }
            });
        }
    }

    sendChat() {
        const input = safeGetElement('chat-input');
        if (!input) return;
        
        const message = input.value.trim();
        
        if (!message || !this.game.roomId) return;
        
        this.game.socketClient.sendChat(message);
        input.value = '';
    }
}
