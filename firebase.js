import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    update,
    onValue,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyDXibm6St9QjnsDfC1O2RfI7ptqREBEDCU",
  authDomain: "wolcoin-6fcf5.firebaseapp.com",
  databaseURL: "https://wolcoin-6fcf5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "wolcoin-6fcf5",
  storageBucket: "wolcoin-6fcf5.firebasestorage.app",
  messagingSenderId: "2115234602",
  appId: "1:2115234602:web:2f8d392fefb445bf3d8c53",
  measurementId: "G-54ZMG2WXRK"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export class UserData {
    constructor(telegramId) {
        this.telegramId = telegramId;
        this.userRef = ref(database, `users/${telegramId}`);
    }

    async initUser(telegramUser) {
        try {
            const snapshot = await get(this.userRef);
            
            if (!snapshot.exists()) {
                const newUser = {
                    telegramId: this.telegramId,
                    firstName: telegramUser.first_name || '',
                    lastName: telegramUser.last_name || '',
                    username: telegramUser.username || '',
                    balance: 0,
                    energy: 1000,
                    maxEnergy: 1000,
                    lastEnergyUpdate: serverTimestamp(),
                    hashRate: 1,
                    boostLevels: {
                        energy: 1,
                        speed: 1,
                        power: 1
                    },
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    totalMined: 0,
                    referrals: 0
                };
                
                await set(this.userRef, newUser);
                return newUser;
            } else {
                await update(this.userRef, {
                    lastLogin: serverTimestamp()
                });
                return snapshot.val();
            }
        } catch (error) {
            console.error('Firebase init error:', error);
            return null;
        }
    }

    onUserUpdate(callback) {
        return onValue(this.userRef, (snapshot) => {
            callback(snapshot.val());
        });
    }

    async addCoins(amount) {
        try {
            const snapshot = await get(this.userRef);
            if (snapshot.exists()) {
                const currentBalance = snapshot.val().balance || 0;
                await update(this.userRef, {
                    balance: currentBalance + amount,
                    totalMined: (snapshot.val().totalMined || 0) + amount
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Add coins error:', error);
            return false;
        }
    }

    async useEnergy(amount) {
        try {
            const snapshot = await get(this.userRef);
            if (snapshot.exists()) {
                const currentEnergy = snapshot.val().energy || 0;
                if (currentEnergy >= amount) {
                    const newEnergy = currentEnergy - amount;
                    await update(this.userRef, {
                        energy: newEnergy,
                        lastEnergyUpdate: serverTimestamp()
                    });
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Use energy error:', error);
            return false;
        }
    }

    async regenerateEnergy() {
        try {
            const snapshot = await get(this.userRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                const currentEnergy = data.energy || 0;
                const maxEnergy = data.maxEnergy || 1000;
                const lastUpdate = data.lastEnergyUpdate ? new Date(data.lastEnergyUpdate) : new Date();
                
                const now = new Date();
                const secondsPassed = Math.floor((now - lastUpdate) / 1000);
                const regenRate = 1/60;
                
                const regenerated = Math.floor(secondsPassed * regenRate);
                if (regenerated > 0) {
                    const newEnergy = Math.min(maxEnergy, currentEnergy + regenerated);
                    await update(this.userRef, {
                        energy: newEnergy,
                        lastEnergyUpdate: serverTimestamp()
                    });
                }
            }
        } catch (error) {
            console.error('Regenerate energy error:', error);
        }
    }
}

export { database };
