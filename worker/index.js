importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyBv2qh0mpLh3Sqab7MHM4XHDIChA6b60_8",
    authDomain: "challengers-1992d.firebaseapp.com",
    projectId: "challengers-1992d",
    storageBucket: "challengers-1992d.firebasestorage.app",
    messagingSenderId: "47674824742",
    appId: "1:47674824742:web:28e73ecf74d4bcc3daaee7"
});

const messaging = firebase.messaging();

const safeParseActions = (value) => {
    if (!value) return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
};

messaging.onBackgroundMessage(function (payload) {
    console.log("[sw] Received background message:", payload);

    const notificationTitle = payload.data?.title || payload.notification?.title || "Challengers";
    const notificationOptions = {
        body: payload.data?.body || payload.notification?.body || "",
        icon: payload.data?.icon || payload.notification?.icon || "/icon-192x192.png",
        image: payload.data?.image || payload.notification?.image,
        badge: payload.data?.badge || "/icon-192x192.png",
        tag: payload.data?.tag || "challengers-notification",
        renotify: true,
        requireInteraction: payload.data?.requireInteraction === "true",
        data: {
            url: payload.data?.url || payload.notification?.click_action || "/",
            ...payload.data
        },
        actions: safeParseActions(payload.data?.actions)
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", function (event) {
    console.log("[sw] Notification clicked:", event.notification);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || "/";
    const fullUrl = new URL(urlToOpen, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    return client.focus().then(() => {
                        if ("navigate" in client) {
                            return client.navigate(fullUrl);
                        }
                    });
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});

self.addEventListener("notificationclose", function (event) {
    console.log("[sw] Notification closed:", event.notification);
});
