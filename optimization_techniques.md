# Optimization Techniques & Best Practices

This document outlines the performance optimization strategies implemented in the **Challengers** application to ensure scalability, responsiveness, and a smooth user experience.

## 1. Dashboard Caching & Data Fetching

### Scenario
The Dashboard was becoming slow because it fetched data for every single component independently. For example, if a user had 5 active challenges, the app would make:
- 1 request for the list of challenges.
- 5 separate requests to count participants for each challenge (N+1 problem).
- 5 separate requests to get the user's specific progress in each challenge.

### Technique: Batch Fetching (Server-Side)
Instead of fetching related data in a loop, we now fetch all required data in parallel batches using Firestore's `in` query.

**Implementation:**
- **Before:** Loop through `challengeIds` -> `await db.collection('...').count().get()`
- **After:** Fetch all relevant documents in one go using `where('challenge_id', 'in', [id1, id2, ...])` and aggregate counts in memory.

**Benefit:** Reduced Firestore reads from **O(N)** to **O(1)** (constant number of queries regardless of challenge count).

### Technique: Client-Side Caching (RTK Query)
We configured Redux Toolkit Query to cache dashboard data for **5 minutes**.

**Implementation:**
```typescript
getActiveChallenges: builder.query({
    // ...
    keepUnusedDataFor: 300, // 5 minutes
    refetchOnMountOrArgChange: false
})
```

**Benefit:** Navigating between tabs (e.g., Dashboard -> Chat -> Dashboard) is instant and requires zero network requests.

---

## 2. Chat Performance (Virtualization & Pagination)

### Scenario
Loading a chat with 1000+ messages caused significant lag because the browser had to render thousands of DOM nodes at once.

### Technique: Pagination (Infinite Scroll)
We implemented a "Load More" strategy using `IntersectionObserver`.

**Implementation:**
1.  **Initial Load:** Fetch only the latest **50 messages**.
2.  **Sentinel:** Place a hidden `div` at the top of the message list.
3.  **Observer:** When the user scrolls up and the sentinel becomes visible, fetch the next batch of 50 messages.
4.  **Scroll Anchoring:** Calculate the scroll position difference before and after loading to ensure the user's view doesn't jump.

### Technique: Simplified Virtualization (Memoization)
To prevent the entire message list from re-rendering whenever the user types a character in the input box.

**Implementation:**
```typescript
const messageList = useMemo(() => {
    return messages.map((msg) => <MessageBubble ... />);
}, [messages]);
```

**Benefit:** Typing is buttery smooth because the heavy list of messages ignores updates that don't affect it.

---

## 3. User Experience Optimizations

### Scenario
Opening a chat room showed the top (oldest) messages first, forcing the user to manually scroll down to see the latest conversation.

### Technique: Instant Scroll Anchoring
We improved the initial load behavior to mimic native apps like WhatsApp.

**Implementation:**
- **First Load:** We use `scrollTop = scrollHeight` synchronously to instantly jump to the bottom *before* the browser paints the next frame.
- **New Messages:** We use `scrollIntoView({ behavior: 'smooth' })` for a pleasant animation when a new message arrives while viewing.

---

## 4. Optimistic UI Updates

### Scenario
Waiting for the server to confirm a "Send Message" action makes the app feel sluggish.

### Technique: Optimistic Updates
(Implemented in Chat Input)
- **Action:** When user hits "Send", we immediately clear the input field.
- **Background:** The network request happens in the background.
- **Benefit:** The app feels instantly responsive.
