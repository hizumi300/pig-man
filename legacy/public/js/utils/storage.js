// LocalStorage管理クラス

export class StorageManager {
    static KEYS = {
        PLAYER_INFO: 'pigGamePlayerInfo',
        REJOIN_INFO: 'pigGameRejoinInfo'
    };

    static savePlayerInfo(playerInfo) {
        try {
            localStorage.setItem(this.KEYS.PLAYER_INFO, JSON.stringify(playerInfo));
            console.log('プレイヤー情報を保存:', playerInfo);
            return true;
        } catch (error) {
            console.error('プレイヤー情報の保存エラー:', error);
            return false;
        }
    }

    static getPlayerInfo() {
        try {
            const data = localStorage.getItem(this.KEYS.PLAYER_INFO);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('プレイヤー情報の読み込みエラー:', error);
            return null;
        }
    }

    static clearPlayerInfo() {
        try {
            localStorage.removeItem(this.KEYS.PLAYER_INFO);
            console.log('プレイヤー情報を削除');
            return true;
        } catch (error) {
            console.error('プレイヤー情報の削除エラー:', error);
            return false;
        }
    }

    static saveRejoinInfo(rejoinInfo) {
        try {
            const infoWithTimestamp = {
                ...rejoinInfo,
                timestamp: Date.now()
            };
            localStorage.setItem(this.KEYS.REJOIN_INFO, JSON.stringify(infoWithTimestamp));
            console.log('再入場情報を保存:', infoWithTimestamp);
            return true;
        } catch (error) {
            console.error('再入場情報の保存エラー:', error);
            return false;
        }
    }

    static getRejoinInfo() {
        try {
            const data = localStorage.getItem(this.KEYS.REJOIN_INFO);
            if (!data) return null;

            const rejoinInfo = JSON.parse(data);
            
            // 24時間以上古い情報は削除
            if (Date.now() - rejoinInfo.timestamp > 24 * 60 * 60 * 1000) {
                this.clearRejoinInfo();
                return null;
            }

            return rejoinInfo;
        } catch (error) {
            console.error('再入場情報の読み込みエラー:', error);
            return null;
        }
    }

    static clearRejoinInfo() {
        try {
            localStorage.removeItem(this.KEYS.REJOIN_INFO);
            console.log('再入場情報を削除');
            return true;
        } catch (error) {
            console.error('再入場情報の削除エラー:', error);
            return false;
        }
    }

    static clearAllData() {
        this.clearPlayerInfo();
        this.clearRejoinInfo();
        console.log('全てのゲームデータを削除');
    }
}
