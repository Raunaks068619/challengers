importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyBv2qh0mpLh3Sqab7MHM4XHDIChA6b60_8",
    authDomain: "challengers-1992d.firebaseapp.com",
    projectId: "challengers-1992d",
    storageBucket: "challengers-1992d.firebasestorage.app",
    messagingSenderId: "47674824742",
    appId: "1:47674824742:web:28e73ecf74d4bcc3daaee7"
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
