importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Log service worker installation
self.addEventListener("install", () => {
    console.info("[firebase-messaging-sw.js] Service worker installed.");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.info("[firebase-messaging-sw.js] Service worker activated.");
    event.waitUntil(self.clients.claim());
});

// Initialize the Firebase app in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyBv2qh0mpLh3Sqab7MHM4XHDIChA6b60_8",
    authDomain: "challengers-1992d.firebaseapp.com",
    projectId: "challengers-1992d",
    storageBucket: "challengers-1992d.firebasestorage.app",
    messagingSenderId: "47674824742",
    appId: "1:47674824742:web:28e73ecf74d4bcc3daaee7"
});

const messaging = firebase.messaging();

// Log delivery for analytics
const sendDeliveryReport = (payload) => {
    console.log("[firebase-messaging-sw.js] Push notification delivered:", payload);
};

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    // Prefer data payload, fallback to notification payload
    const notificationTitle = payload.data?.title || payload.notification?.title || "Challengers";
    const notificationOptions = {
        body: payload.data?.body || payload.notification?.body || "",
        icon: payload.data?.icon || payload.notification?.icon || '/icon-192x192.png',
        image: payload.data?.image || payload.notification?.image,
        badge: payload.data?.badge || '/icon-192x192.png',
        tag: payload.data?.tag || 'challengers-notification',
        renotify: true,
        requireInteraction: payload.data?.requireInteraction === 'true',
        data: {
            url: payload.data?.url || payload.notification?.click_action || '/',
            ...payload.data
        },
        actions: payload.data?.actions ? JSON.parse(payload.data.actions) : undefined
    };

    sendDeliveryReport(payload);
    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
    event.notification.close();

    // Get the URL from notification data
    const urlToOpen = event.notification.data?.url || '/';
    const fullUrl = new URL(urlToOpen, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window open with our app
            for (const client of clientList) {
                // If we find an existing window, focus it and navigate
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus().then(() => {
                        if ('navigate' in client) {
                            return client.navigate(fullUrl);
                        }
                    });
                }
            }
            // If no existing window, open a new one
            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', function (event) {
    console.log('[firebase-messaging-sw.js] Notification closed:', event.notification);
});
