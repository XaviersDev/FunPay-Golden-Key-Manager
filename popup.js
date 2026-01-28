
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

function getInitial(name) {
    return name.charAt(0).toUpperCase();
}

function formatKeyPreview(key) {
    if (!key || key.length < 16) return key;
    return `${key.substring(0, 8)}...${key.substring(key.length - 8)}`;
}

async function getCurrentGoldenKey() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab?.url?.includes('funpay')) {
            return null;
        }

        const cookies = await chrome.cookies.getAll({
            url: tab.url,
            name: 'golden_key'
        });

        return cookies.length > 0 ? cookies[0].value : null;
    } catch (error) {
        console.error('Ошибка получения golden_key:', error);
        return null;
    }
}

async function setGoldenKey(key) {
    const domains = [
        'https://funpay.com',
        'https://funpay.ru',
        'https://www.funpay.com',
        'https://www.funpay.ru'
    ];

    for (const domain of domains) {
        try {
            await chrome.cookies.set({
                url: domain,
                name: 'golden_key',
                value: key,
                path: '/',
                secure: true,
                sameSite: 'lax'
            });
        } catch (error) {
            console.error(`Ошибка установки куки для ${domain}:`, error);
        }
    }
}

async function loadAccounts() {
    const result = await chrome.storage.local.get(['accounts']);
    return result.accounts || [];
}

async function saveAccounts(accounts) {
    await chrome.storage.local.set({ accounts });
}

async function displayCurrentKey() {
    const currentKeyEl = document.getElementById('currentKey');
    const copyBtn = document.getElementById('btnCopy');
    const key = await getCurrentGoldenKey();
    
    if (key) {
        currentKeyEl.textContent = formatKeyPreview(key);
        currentKeyEl.classList.remove('empty');
        copyBtn.disabled = false;
    } else {
        currentKeyEl.textContent = 'Откройте FunPay';
        currentKeyEl.classList.add('empty');
        copyBtn.disabled = true;
    }
}

async function displayAccounts() {
    const accountsListEl = document.getElementById('accountsList');
    const accounts = await loadAccounts();
    const currentKey = await getCurrentGoldenKey();
    
    if (accounts.length === 0) {
        accountsListEl.innerHTML = `
            <div class="empty-state">
                Нет сохранённых аккаунтов
            </div>
        `;
        return;
    }
    
    accountsListEl.innerHTML = accounts.map((account, index) => {
        const isActive = account.key === currentKey;
        const avatarContent = account.avatarUrl 
            ? `<img src="${account.avatarUrl}" alt="${account.name}">` 
            : getInitial(account.name);
        
        return `
            <div class="account-item ${isActive ? 'active' : ''}" data-index="${index}">
                <div class="account-avatar">${avatarContent}</div>
                <div class="account-info">
                    <div class="account-name">${account.name}</div>
                </div>
                <button class="btn-delete" data-index="${index}">×</button>
            </div>
        `;
    }).join('');
    
    accountsListEl.querySelectorAll('.account-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-delete')) return;
            
            const index = parseInt(item.dataset.index);
            const account = accounts[index];
            
            await setGoldenKey(account.key);
            showNotification(`→ ${account.name}`);
            
            // Перезагружаем текущую вкладку если это FunPay
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url?.includes('funpay')) {
                chrome.tabs.reload(tab.id);
            }
            
            await displayCurrentKey();
            await displayAccounts();
        });
    });
    
    accountsListEl.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const index = parseInt(btn.dataset.index);
            const account = accounts[index];
            
            accounts.splice(index, 1);
            await saveAccounts(accounts);
            showNotification('Удалено');
            await displayAccounts();
        });
    });
}

document.getElementById('btnAddAccount').addEventListener('click', async () => {
    const nameInput = document.getElementById('accountName');
    const keyInput = document.getElementById('goldenKey');
    
    const name = nameInput.value.trim();
    const key = keyInput.value.trim();
    
    if (!name || !key) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    const accounts = await loadAccounts();
    
    if (accounts.some(acc => acc.key === key)) {
        showNotification('Этот ключ уже сохранён', 'error');
        return;
    }
    
    const newAccount = {
        name: name,
        key: key,
        avatarUrl: null,
        addedAt: Date.now()
    };
    
    accounts.push(newAccount);
    await saveAccounts(accounts);
    
    showNotification('Сохранено');
    
    nameInput.value = '';
    keyInput.value = '';
    
    await displayAccounts();
});

document.getElementById('btnCopy').addEventListener('click', async () => {
    const key = await getCurrentGoldenKey();
    if (key) {
        navigator.clipboard.writeText(key);
        showNotification('Скопировано');
    }
});

document.getElementById('btnExtractKey').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url?.includes('funpay')) {
        showNotification('Откройте FunPay', 'error');
        return;
    }
    
    const key = await getCurrentGoldenKey();
    
    if (!key) {
        showNotification('Key не найден', 'error');
        return;
    }
    
    document.getElementById('goldenKey').value = key;
    showNotification('Извлечён');
});

document.getElementById('btnRefresh').addEventListener('click', async () => {
    await displayCurrentKey();
    await displayAccounts();
});

(async function init() {
    await displayCurrentKey();
    await displayAccounts();
})();
