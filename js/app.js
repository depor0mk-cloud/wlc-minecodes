import { UserData } from './firebase.js';

// Элементы DOM
const balanceEl = document.getElementById('balance');
const countdownEl = document.getElementById('countdown');
const startMiningBtn = document.getElementById('startMiningBtn');
const minerStatus = document.getElementById('minerStatus');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const energyBar = document.getElementById('energyBar');
const energyValue = document.getElementById('energyValue');
const profileBtn = document.getElementById('profileBtn');
const navBoost = document.getElementById('navBoost');
const navTasks = document.getElementById('navTasks');
const navProfile = document.getElementById('navProfile');

// Переменные
let tg = window.Telegram?.WebApp;
let userData = null;
let currentUser = null;
let miningInterval = null;
let miningStartTime = null;
const miningDuration = 30000;

// Функции
async function initApp() {
    try {
        if (tg) {
            tg.ready();
            tg.expand();
        }

        let tgUser = tg?.initDataUnsafe?.user;
        
        // Тестовый режим если нет Telegram
        if (!tgUser) {
            console.log('Тестовый режим');
            tgUser = {
                id: 123456789,
                first_name: 'Тест',
                last_name: '',
                username: 'testuser'
            };
        }

        userData = new UserData(tgUser.id.toString());
        currentUser = await userData.initUser(tgUser);
        
        if (!currentUser) {
            minerStatus.textContent = 'Ошибка подключения к базе';
            return;
        }

        updateUI();
        startEnergyRegeneration();
        updateCountdown();
        setInterval(updateCountdown, 1000);

        userData.onUserUpdate((updatedData) => {
            if (updatedData) {
                currentUser = updatedData;
                updateUI();
            }
        });

    } catch (error) {
        console.error('Init error:', error);
        minerStatus.textContent = 'Ошибка загрузки';
    }
}

function updateUI() {
    if (currentUser) {
        balanceEl.textContent = currentUser.balance?.toFixed(2) || '0';
        
        const energy = currentUser.energy || 0;
        const maxEnergy = currentUser.maxEnergy || 1000;
        const percent = (energy / maxEnergy) * 100;
        energyBar.style.width = percent + '%';
        energyValue.textContent = `${Math.floor(energy)} / ${maxEnergy}`;
        
        startMiningBtn.disabled = energy < 10;
    }
}

function updateCountdown() {
    const targetDate = new Date(2026, 1, 1, 0, 0, 0);
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
        countdownEl.textContent = 'Листинг сегодня!';
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownEl.textContent = `${days}д ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startEnergyRegeneration() {
    setInterval(async () => {
        if (userData && currentUser) {
            await userData.regenerateEnergy();
        }
    }, 10000);
}

async function startMining() {
    if (miningInterval) return;

    if (!currentUser || currentUser.energy < 10) {
        minerStatus.textContent = 'Недостаточно энергии';
        return;
    }

    const success = await userData.useEnergy(10);
    if (!success) {
        minerStatus.textContent = 'Ошибка';
        return;
    }

    minerStatus.textContent = 'Майнинг...';
    startMiningBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    miningStartTime = Date.now();
    
    const updateProgress = () => {
        const elapsed = Date.now() - miningStartTime;
        const percent = Math.min(100, (elapsed / miningDuration) * 100);
        progressBar.style.width = percent + '%';
        
        if (elapsed >= miningDuration) {
            finishMining();
        }
    };
    
    miningInterval = setInterval(updateProgress, 100);
}

async function finishMining() {
    clearInterval(miningInterval);
    miningInterval = null;
    
    const random = Math.random();
    let reward = 0;
    let message = '';
    
    if (random < 0.3) {
        reward = 5;
        message = `Успех! +${reward.toFixed(2)} WOL`;
    } else {
        reward = 0.5;
        message = `Пул: +${reward.toFixed(2)} WOL`;
    }
    
    const added = await userData.addCoins(reward);
    if (added) {
        minerStatus.textContent = message;
    } else {
        minerStatus.textContent = 'Ошибка начисления';
    }
    
    progressContainer.classList.add('hidden');
    startMiningBtn.disabled = false;
}

// События
startMiningBtn.addEventListener('click', startMining);

profileBtn.addEventListener('click', () => {
    const msg = currentUser 
        ? `Профиль ${currentUser.firstName || ''}\nБаланс: ${currentUser.balance} WOL`
        : 'Профиль не загружен';
    tg?.showAlert ? tg.showAlert(msg) : alert(msg);
});

navBoost.addEventListener('click', () => {
    tg?.showAlert ? tg.showAlert('Бусты скоро') : alert('Бусты скоро');
});

navTasks.addEventListener('click', () => {
    tg?.showAlert ? tg.showAlert('Задания скоро') : alert('Задания скоро');
});

navProfile.addEventListener('click', () => {
    if (!currentUser) return;
    const msg = `ID: ${currentUser.telegramId}\nДобыто: ${currentUser.totalMined?.toFixed(2) || 0} WOL`;
    tg?.showAlert ? tg.showAlert(msg) : alert(msg);
});

// Старт
document.addEventListener('DOMContentLoaded', initApp);
