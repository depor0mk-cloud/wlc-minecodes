// js/firebase.js

// Импорт функций Firebase SDK (используем модульный подход)
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

// Твой полный конфиг Firebase
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

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Класс для работы с пользовательскими данными
class UserData {
    constructor(telegramId) {
        this.telegramId = telegramId;
        this.userRef = ref(database, `users/${telegramId}`);
    }

    // Создание или получение профиля пользователя
    async initUser(telegramUser) {
        const snapshot = await get(this.userRef);
        
        if (!snapshot.exists()) {
            // Новый пользователь - создаём запись
            const newUser = {
                telegramId: this.telegramId,
                firstName: telegramUser.first_name || '',
                lastName: telegramUser.last_name || '',
                username: telegramUser.username || '',
                balance: 0, // начальный баланс 0 WOL
                energy: 1000, // максимальная энергия
                maxEnergy: 1000,
                lastEnergyUpdate: serverTimestamp(),
                hashRate: 1, // базовый хэшрейт
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
            // Обновляем время последнего входа
            await update(this.userRef, {
                lastLogin: serverTimestamp()
            });
            return snapshot.val();
        }
    }

    // Получение данных пользователя в реальном времени
    onUserUpdate(callback) {
        return onValue(this.userRef, (snapshot) => {
            callback(snapshot.val());
        });
    }

    // Обновление баланса
    async updateBalance(newBalance) {
        await update(this.userRef, {
            balance: newBalance
        });
    }

    // Добавление монет к балансу
    async addCoins(amount) {
        const snapshot = await get(this.userRef);
        if (snapshot.exists()) {
            const currentBalance = snapshot.val().balance || 0;
            await update(this.userRef, {
                balance: currentBalance + amount,
                totalMined: (snapshot.val().totalMined || 0) + amount
            });
        }
    }

    // Списание монет (проверка достаточности баланса внутри)
    async spendCoins(amount) {
        const snapshot = await get(this.userRef);
        if (snapshot.exists()) {
            const currentBalance = snapshot.val().balance || 0;
            if (currentBalance >= amount) {
                await update(this.userRef, {
                    balance: currentBalance - amount
                });
                return true;
            }
        }
        return false;
    }

    // Обновление энергии
    async updateEnergy(newEnergy) {
        const snapshot = await get(this.userRef);
        if (snapshot.exists()) {
            const maxEnergy = snapshot.val().maxEnergy || 1000;
            // Энергия не может превышать максимум и быть меньше 0
            const clampedEnergy = Math.min(maxEnergy, Math.max(0, newEnergy));
            await update(this.userRef, {
                energy: clampedEnergy,
                lastEnergyUpdate: serverTimestamp()
            });
        }
    }

    // Использовать энергию (списать, если достаточно)
    async useEnergy(amount) {
        const snapshot = await get(this.userRef);
        if (snapshot.exists()) {
            const currentEnergy = snapshot.val().energy || 0;
            if (currentEnergy >= amount) {
                const newEnergy = currentEnergy - amount;
                await this.updateEnergy(newEnergy);
                return true;
            }
        }
        return false;
    }

    // Восстановление энергии (должно вызываться периодически)
    async regenerateEnergy() {
        const snapshot = await get(this.userRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const currentEnergy = data.energy || 0;
            const maxEnergy = data.maxEnergy || 1000;
            const lastUpdate = data.lastEnergyUpdate ? new Date(data.lastEnergyUpdate) : new Date();
            
            // Прошло секунд с последнего обновления
            const now = new Date();
            const secondsPassed = Math.floor((now - lastUpdate) / 1000);
            
            // Скорость восстановления: 1 энергии в минуту (можно менять)
            const regenRate = 1/60; // в секунду
            
            const regenerated = Math.floor(secondsPassed * regenRate);
            if (regenerated > 0) {
                const newEnergy = Math.min(maxEnergy, currentEnergy + regenerated);
                await update(this.userRef, {
                    energy: newEnergy,
                    lastEnergyUpdate: serverTimestamp()
                });
            }
        }
    }

    // Получить уровень буста
    async getBoostLevel(boostType) {
        const snapshot = await get(this.userRef);
        return snapshot.val().boostLevels?.[boostType] || 1;
    }

    // Улучшить буст
    async upgradeBoost(boostType) {
        const snapshot = await get(this.userRef);
        if (snapshot.exists()) {
            const currentLevel = snapshot.val().boostLevels?.[boostType] || 1;
            // Здесь можно добавить логику цены улучшения
            await update(this.userRef, {
                [`boostLevels.${boostType}`]: currentLevel + 1
            });
        }
    }
}

// Функция для получения рейтинга (топ игроков)
async function getLeaderboard(limit = 100) {
    const leaderboardRef = ref(database, 'users');
    const snapshot = await get(leaderboardRef);
    if (snapshot.exists()) {
        const users = snapshot.val();
        // Преобразуем объект в массив и сортируем по балансу
        const leaderboard = Object.entries(users)
            .map(([id, data]) => ({
                id,
                name: data.firstName || data.username || 'Аноним',
                balance: data.balance || 0
            }))
            .sort((a, b) => b.balance - a.balance)
            .slice(0, limit);
        return leaderboard;
    }
    return [];
}

// Функция для глобального события (например, для будущей конвертации валют)
async function globalEvent(eventType, eventData) {
    const eventRef = ref(database, 'events/' + eventType);
    await set(eventRef, {
        ...eventData,
        timestamp: serverTimestamp()
    });
}

// Экспортируем класс и функции для использования в app.js
export { 
    database, 
    UserData, 
    getLeaderboard, 
    globalEvent 
};
