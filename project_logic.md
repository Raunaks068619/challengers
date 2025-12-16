# Project Logic & Gamification System

This document outlines the core logic, data structures, and workflows for the Challengers application.

## 1. Points System (Gamification)

The application uses a points-based system to incentivize consistency.

### Earning Points
*   **Joining a Challenge:** +500 points (Initial buy-in/starting capital).
*   **Creating a Challenge:** +500 points (Creator bonus).
*   **Daily Check-in:**
    *   **Base:** 0 points (Standard check-in maintains the streak).
    *   **Streak Bonus:** +100 points every **3 days** of consecutive streak (e.g., Day 3, Day 6, Day 9).

### Losing Points
*   **Missed Task:** -100 points.
    *   This is calculated daily by the `checkMissedLogs` function.
    *   If a user fails to check in by the deadline (or end of day), 100 points are deducted.
    *   **Streak Reset:** Missing a task resets the `streak_current` to 0.

## 2. Daily Progress Tracking

The Dashboard displays a circular progress indicator for the current day.

### Calculation Logic
*   **Numerator (Completed):** Count of `daily_logs` where:
    *   `date` matches today.
    *   `status` is 'completed'.
    *   `challenge_id` belongs to a challenge that is **active today** (i.e., not a rest day).
*   **Denominator (Total):** Count of **Active Challenges** that are scheduled for today (excluding rest days).

### Rest Days
*   Challenges can have defined "Rest Days" (e.g., Sundays).
*   On these days, the challenge is excluded from the "Total Tasks" count, so users are not penalized for not checking in.

## 3. Chart Visualization

The Dashboard features an Area Chart comparing user progress.

### Data Source
*   **Primary:** `challenge_participants` collection -> `points_history` field.
*   **Fallback:** `profiles` collection -> `points_history` field (Global history).

### Comparison Logic
1.  The app fetches the **first active challenge**.
2.  It retrieves all participants for that challenge.
3.  It extracts the `points_history` array for each participant.
4.  It merges these histories into a single timeline (by date).
5.  **Gap Filling:** If a user has data for Day 1 and Day 3 but not Day 2, the chart logic carries forward the Day 1 value to Day 2 to ensure continuous lines.

## 4. Check-in Functionality

The Check-in process verifies user activity.

### Workflow
1.  **Image Upload:**
    *   User captures/selects a photo.
    *   Image is uploaded directly to **Supabase Storage** (Client-side) in the `checkins/{challengeId}` bucket.
    *   Returns a public URL.
2.  **Log Creation:**
    *   A document is created in the `daily_logs` Firestore collection.
    *   Fields: `challenge_id`, `user_id`, `date`, `status: 'completed'`, `proof_url`, `verified: true`.
3.  **Gamification Update:**
    *   The user's document in `challenge_participants` is updated:
        *   `streak_current` increments by 1.
        *   `streak_best` updates if current > best.
        *   `current_points` increases ONLY if the streak bonus applies (Day % 3 == 0).
        *   `points_history` array is appended with the new entry.
    *   **Global Profile Update:**
        *   If points were added, the global `profiles` document is also updated (`total_earned`, `current_points`, `points_history`).

## 5. User Profile & Data Storage

Data is denormalized across collections for performance.

### Collections

#### `profiles` (Global User Data)
*   **Purpose:** Stores global stats and identity.
*   **Key Fields:**
    *   `current_points`: Total points across ALL challenges.
    *   `total_earned`: Lifetime points earned.
    *   `total_lost`: Lifetime points lost (penalties).
    *   `points_history`: Array of `{ date, points, taskStatus }`. Used for the Dashboard chart when no specific challenge is selected.

#### `challenges` (Challenge Metadata)
*   **Purpose:** Stores rules and settings.
*   **Key Fields:** `title`, `description`, `start_date`, `end_date`, `rest_days`, `join_code`.

#### `challenge_participants` (Link Table)
*   **Purpose:** Links Users to Challenges and stores context-specific progress.
*   **Key Fields:**
    *   `user_id`, `challenge_id`.
    *   `current_points`: Points earned *in this specific challenge*.
    *   `streak_current`: Active streak for this challenge.
    *   `points_history`: Array of point changes specific to this challenge. Used for the Chart comparison.

#### `daily_logs` (Activity Records)
*   **Purpose:** Immutable record of every action.
*   **Key Fields:** `date`, `status` ('completed' | 'missed'), `proof_url`.

### Denormalization Strategy
*   **`points_history`** is stored in BOTH `profiles` and `challenge_participants`.
    *   **Why?**
        *   `profiles`: Allows fast rendering of the global dashboard chart without querying every single past challenge.
        *   `challenge_participants`: Allows fast rendering of challenge-specific leaderboards and comparison charts without filtering a massive global history.

## 6. Theme & UI Logic

### Theme Persistence
*   **Storage:** Theme preference (`'light' | 'dark' | 'system'`) is stored in the `profiles` collection under the `theme` field.
*   **Synchronization:**
    *   **Initial Load:** The app checks the DB preference. If it differs from the local `next-themes` state, it updates the local state to match the DB.
    *   **User Change:** When the user toggles the theme, the new value is saved to the DB (debounced to prevent excessive writes).
    *   **Conflict Resolution:** A `lastDbTheme` ref tracks the last value synced from the DB to prevent local changes from being overwritten by background refetches.

### UI Components
*   **Challenge Cards:**
    *   Designed for high affordance with hover effects (border highlight, scale).
    *   Includes a visual consistency tracker (checkmarks/crosses) derived from `points_history` and `daily_logs`.
    *   Uses a "traffic light" system for status: Green (Completed), Red (Missed), Dashed (Pending), Gray (Rest/Future).
