# Challengers

**Push your limits. Bet on yourself.**

Challengers is a social productivity app that helps you build habits through friendly competition. Join challenges, track your progress, and compete with friends.

## Features

### 🏆 Challenges
- **Join & Create:** Participate in public challenges or create your own.
- **Progress Tracking:** Log your daily activity with photo proof.
- **Leaderboards:** Compete for the top spot based on consistency and points.
- **Verification:** AI-powered or community verification of logs.

### 💬 Chat & Social
- **Real-time Messaging:** Chat with participants in challenge groups or via Direct Messages.
- **Instagram-Style UI:** Immersive, fullscreen chat experience.
- **Media Support:** Send text and view shared media.

### 🔔 Notifications
- **Push Notifications:** Native web push notifications for new messages and challenge reminders.
- **In-App Alerts:** Real-time badges and toast notifications.
- **Smart Reminders:** Get notified before your challenge window closes.

### 🛡️ Security & Performance
- **Rate Limiting:** Redis-backed rate limiting protects all API endpoints from abuse.
  - Chat: 30 requests/minute
  - Mutations: 20 requests/minute
  - Reads: 60 requests/minute
- **Automatic Throttling:** Returns 429 status with `Retry-After` headers when limits are exceeded.
- **Smart Identification:** Tracks limits per authenticated user or IP address.

### 🎨 Personalization
- **Theme Sync:** Dark/Light mode preference is saved to your profile and synced across devices.
- **Profile Customization:** Update your avatar and display name.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth
- **Caching & Rate Limiting:** Redis (ioredis)
- **State Management:** Redux Toolkit (RTK Query)
- **PWA:** Fully installable Progressive Web App

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/challengers.git
    cd challengers
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env.local` file in the root directory and add your Firebase and Redis configuration:

    ```env
    # Firebase Client SDK
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key

    # Firebase Admin SDK (Required for Push Notifications)
    FIREBASE_CLIENT_EMAIL=your_client_email
    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

    # Redis (Required for Rate Limiting & Caching)
    REDIS_URL=your_redis_host
    REDIS_PASSWORD=your_redis_password
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the app:**
    Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

This project is optimized for deployment on [Vercel](https://vercel.com).

1.  Push your code to a Git repository.
2.  Import the project into Vercel.
3.  Add the environment variables in the Vercel dashboard.
4.  Deploy!

## License

MIT
