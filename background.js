
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('FunPay Golden Key Manager установлен');
        
        // Инициализация хранилища
        chrome.storage.local.set({
            accounts: []
        });
    }
});

chrome.action.onClicked.addListener((tab) => {
});

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data || '');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getGoldenKey') {
        chrome.cookies.get({
            url: request.url || 'https://funpay.com',
            name: 'golden_key'
        }, (cookie) => {
            sendResponse({ key: cookie?.value || null });
        });
        return true; // Асинхронный ответ
    }
    
    if (request.action === 'setGoldenKey') {
        const domains = [
            'https://funpay.com',
            'https://funpay.ru',
            'https://www.funpay.com',
            'https://www.funpay.ru'
        ];
        
        Promise.all(domains.map(domain => 
            chrome.cookies.set({
                url: domain,
                name: 'golden_key',
                value: request.key,
                path: '/',
                secure: true,
                sameSite: 'lax'
            })
        )).then(() => {
            log('Golden key установлен для всех доменов');
            sendResponse({ success: true });
        }).catch(error => {
            log('Ошибка установки golden key', error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true;
    }
    
    if (request.action === 'log') {
        log(request.message, request.data);
        sendResponse({ success: true });
    }
});

chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.name === 'golden_key') {
        if (changeInfo.removed) {
            log('Golden key был удалён');
        } else {
            log('Golden key был изменён');
        }
    }
});

log('FunPay Golden Key Manager background service запущен');
