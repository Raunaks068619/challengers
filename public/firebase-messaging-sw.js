importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
    apiKey: "YOUR_API_KEY", // Note: These values are technically public in client-side JS anyway, but usually we'd inject them. 
    // For SW, we often hardcode or use a build step. For simplicity in this MVP, we'll rely on the fact that 
    // the SW mainly needs to exist and the main app handles the token. 
    // However, for background handling, the SW needs config.
    // We will use a placeholder here and instruct the user to fill it or use a smarter injection method if needed.
    // Actually, for just receiving background messages, often just initializing is enough if the payload is right.
    // Let's try to keep it minimal.
    messagingSenderId: "YOUR_SENDER_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icons/icon-192x192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
