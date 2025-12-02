import Redis from 'ioredis';

// Note: The user provided host:port. Usually there's a password. 
// If the user didn't provide one, we might need to ask or check if it's open (unlikely).
// For now, I'll structure it to accept a URL or host/port/password from env.

let redis: Redis | null = null;

try {
    // Using the credentials provided in the screenshot
    redis = new Redis({
        host: process.env.REDIS_URL,
        port: 16967,
        username: 'default',
        password: process.env.REDIS_PASSWORD,
    });
    console.log(redis);
    

    redis.on('error', (err) => {
        // Suppress NOAUTH errors to prevent log spam if env var is missing
        if (err.message.includes('NOAUTH')) {
            console.warn('Redis Auth Error: Check REDIS_PASSWORD');
        } else {
            console.error('Redis Client Error:', err);
        }
    });

} catch (error) {
    console.error("Failed to initialize Redis client:", error);
}

export default redis;
