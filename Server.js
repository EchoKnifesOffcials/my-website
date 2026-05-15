// server.js - Main backend server for Bloxview
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const axios = require('axios');
const crypto = require('crypto');
const NodeCache = require('node-cache');
const { body, validationResult } = require('express-validator');

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: ['http://localhost:3000', 'https://bloxview.com'],
    credentials: true
}));
app.use(express.json());

// Cache configuration (15 minutes TTL)
const cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

// Rate limiting
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Rate limit exceeded for this action'
});

// Apply rate limiting
app.use('/api/', globalLimiter);
app.use('/api/verify/', strictLimiter);

// In-memory storage (replace with PostgreSQL/Redis in production)
const verificationCodes = new Map(); // userId -> { code, expires, attempts }
const verifiedUsers = new Map(); // userId -> { verified, timestamp, robloxData }
const rateLimitStore = new Map(); // ip -> { count, resetTime }

// Helper: Generate secure verification code
function generateVerificationCode(userId) {
    const adjectives = ['CRIMSON', 'GOLDEN', 'SILVER', 'EMERALD', 'SAPPHIRE', 'RADIANT', 'SHADOW', 'PHANTOM', 'ETERNAL', 'MYSTIC', 'BLAZING', 'FROSTBORN', 'THUNDER', 'NEBULA', 'STARLIGHT', 'MOONLIT'];
    const nouns = ['PHOENIX', 'DRAGON', 'WOLF', 'EAGLE', 'TIGER', 'WIZARD', 'KNIGHT', 'GUARDIAN', 'SENTINEL', 'PROPHET', 'LEGEND', 'MYTH', 'TITAN', 'SPECTRE'];
    const verbs = ['FLIES', 'HUNTS', 'SHINES', 'PROTECTS', 'GUIDES', 'WATCHES', 'DREAMS', 'RISES', 'FALLS', 'ENDURES', 'REIGNS', 'AWAKENS', 'ASCENDS', 'TRANSCENDS'];
    const hash = crypto.createHash('md5').update(userId + Date.now().toString()).digest('hex').substring(0, 4);
    const word1 = adjectives[Math.floor(Math.random() * adjectives.length)];
    const word2 = nouns[Math.floor(Math.random() * nouns.length)];
    const word3 = verbs[Math.floor(Math.random() * verbs.length)];
    const numbers = Math.floor(Math.random() * 9000) + 1000;
    
    return `${word1}_${word2}_${word3}_${numbers}_${hash.toUpperCase()}`;
}

// Helper: HMAC signature for webhook security
function generateHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex');
}

// Helper: Check rate limit for IP
function checkRateLimit(ip, limit = 100, windowMs = 3600000) {
    const now = Date.now();
    const record = rateLimitStore.get(ip);
    
    if (!record || now > record.resetTime) {
        rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }
    
    if (record.count >= limit) {
        return false;
    }
    
    record.count++;
    rateLimitStore.set(ip, record);
    return true;
}

// ============ ROBLOX API ENDPOINTS ============

/**
 * Fetch Roblox user by username
 * GET /api/roblox/user/:username
 */
app.get('/api/roblox/user/:username', async (req, res) => {
    const { username } = req.params;
    const clientIp = req.ip;
    
    // Rate limit check
    if (!checkRateLimit(clientIp, 50, 3600000)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // Check cache
    const cacheKey = `roblox_user_${username.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }
    
    try {
        // Step 1: Search for user by username
        const searchRes = await axios.get(`https://users.roblox.com/v1/users/search`, {
            params: { keyword: username, limit: 1 },
            timeout: 5000
        });
        
        if (!searchRes.data.data || searchRes.data.data.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = searchRes.data.data[0];
        
        // Step 2: Get detailed user info
        const detailRes = await axios.get(`https://users.roblox.com/v1/users/${user.id}`, { timeout: 5000 });
        const userDetail = detailRes.data;
        
        // Step 3: Get avatar thumbnail
        const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot`, {
            params: { userIds: user.id, size: '420x420', format: 'Png', isCircular: false },
            timeout: 5000
        });
        
        const avatarUrl = thumbRes.data.data?.[0]?.imageUrl || null;
        
        // Step 4: Get user's presence (if available)
        let presence = null;
        try {
            const presenceRes = await axios.post('https://presence.roblox.com/v1/presence/users', {
                userIds: [user.id]
            }, { timeout: 5000 });
            presence = presenceRes.data.userPresences?.[0];
        } catch (e) {
            // Presence is optional
        }
        
        // Calculate account age
        const createdDate = new Date(userDetail.created);
        const accountAgeDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 3600 * 24));
        const isAccountOldEnough = accountAgeDays >= 30;
        
        const result = {
            id: userDetail.id,
            username: userDetail.name,
            displayName: userDetail.displayName,
            created: userDetail.created,
            accountAgeDays,
            isAccountOldEnough,
            avatarUrl,
            presence: presence ? {
                userPresenceType: presence.userPresenceType,
                lastLocation: presence.lastLocation,
                placeId: presence.placeId
            } : null,
            profileUrl: `https://www.roblox.com/users/${userDetail.id}/profile`
        };
        
        // Cache for 15 minutes
        cache.set(cacheKey, result);
        
        res.json(result);
        
    } catch (error) {
        console.error('Roblox API error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Roblox user data' });
    }
});

/**
 * Fetch multiple Roblox users
 * POST /api/roblox/users/batch
 */
app.post('/api/roblox/users/batch', async (req, res) => {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length > 100) {
        return res.status(400).json({ error: 'Invalid user IDs (max 100)' });
    }
    
    try {
        const promises = userIds.map(id => 
            axios.get(`https://users.roblox.com/v1/users/${id}`, { timeout: 5000 })
                .then(r => r.data)
                .catch(() => null)
        );
        
        const users = await Promise.all(promises);
        const validUsers = users.filter(u => u !== null);
        
        res.json(validUsers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * Get user's inventory (for specific game)
 * GET /api/roblox/inventory/:userId/:gameId
 */
app.get('/api/roblox/inventory/:userId/:gameId', async (req, res) => {
    const { userId, gameId } = req.params;
    const { limit = 50, cursor } = req.query;
    
    try {
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/items/${gameId}`, {
            params: { limit, cursor },
            timeout: 10000
        });
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// ============ VERIFICATION SYSTEM ============

/**
 * Start verification process
 * POST /api/verify/start
 */
app.post('/api/verify/start', [
    body('robloxId').isInt().withMessage('Valid Roblox ID required'),
    body('robloxUsername').isString().trim().isLength({ min: 3, max: 50 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { robloxId, robloxUsername } = req.body;
    const clientIp = req.ip;
    
    // Check rate limit for this user
    if (!checkRateLimit(`verify_${robloxId}`, 3, 3600000)) {
        return res.status(429).json({ error: 'Too many verification attempts. Try again in 1 hour.' });
    }
    
    // Check if already verified
    if (verifiedUsers.has(robloxId)) {
        return res.status(400).json({ error: 'User already verified' });
    }
    
    // Generate verification code
    const code = generateVerificationCode(robloxId);
    const expires = Date.now() + 30 * 60 * 1000; // 30 minutes
    
    verificationCodes.set(robloxId, {
        code,
        expires,
        attempts: 0,
        robloxUsername,
        createdAt: Date.now()
    });
    
    // Log for audit
    console.log(`Verification started for ${robloxUsername} (${robloxId})`);
    
    res.json({
        success: true,
        message: 'Verification code generated',
        code: code, // In production, this would be displayed in UI only
        expiresIn: 1800 // seconds
    });
});

/**
 * Check verification status by reading Roblox bio
 * POST /api/verify/check
 */
app.post('/api/verify/check', [
    body('robloxId').isInt(),
    body('robloxUsername').isString()
], async (req, res) => {
    const { robloxId, robloxUsername } = req.body;
    
    // Get pending verification
    const pending = verificationCodes.get(robloxId);
    if (!pending) {
        return res.status(400).json({ error: 'No pending verification for this user' });
    }
    
    // Check expiration
    if (Date.now() > pending.expires) {
        verificationCodes.delete(robloxId);
        return res.status(400).json({ error: 'Verification code expired. Please restart the process.' });
    }
    
    // Increment attempt counter
    pending.attempts++;
    verificationCodes.set(robloxId, pending);
    
    if (pending.attempts > 10) {
        verificationCodes.delete(robloxId);
        return res.status(400).json({ error: 'Too many failed attempts. Please restart verification.' });
    }
    
    try {
        // Fetch user's profile to read bio
        // Note: Roblox API doesn't expose bio directly without authentication
        // This would require a backend with a Roblox cookie or using their Open Cloud API
        
        const userResponse = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`, { timeout: 5000 });
        const userData = userResponse.data;
        
        // For production with Open Cloud API:
        // const bioResponse = await axios.get(`https://apis.roblox.com/cloud/v2/users/${robloxId}`, {
        //     headers: { 'x-api-key': process.env.ROBLOX_OPEN_CLOUD_KEY }
        // });
        // const userBio = bioResponse.data.description;
        
        // Since bio isn't available via public API, we'll use a different method:
        // Option 1: Have user join a specific Roblox group
        // Option 2: Have user set a specific game pass/asset
        // Option 3: Use Roblox's Open Cloud API with proper authentication
        
        // For demo, we simulate successful verification
        // In production, you would check for the exact code in their bio
        
        const isVerified = true; // Replace with actual bio check
        
        if (isVerified) {
            // Mark user as verified
            verifiedUsers.set(robloxId, {
                verifiedAt: Date.now(),
                robloxUsername: userData.name,
                robloxDisplayName: userData.displayName,
                verificationMethod: 'bio_code',
                verificationCode: pending.code,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            // Clean up
            verificationCodes.delete(robloxId);
            
            // Generate JWT token for the user
            const token = crypto.randomBytes(32).toString('hex');
            
            console.log(`User verified: ${userData.name} (${robloxId})`);
            
            res.json({
                success: true,
                verified: true,
                token,
                user: {
                    id: robloxId,
                    username: userData.name,
                    displayName: userData.displayName,
                    avatarUrl: `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=200&height=200&format=png`,
                    verifiedAt: new Date().toISOString()
                }
            });
        } else {
            res.json({
                success: false,
                verified: false,
                message: 'Verification code not found in bio. Please add the exact code and try again.'
            });
        }
        
    } catch (error) {
        console.error('Verification check error:', error);
        res.status(500).json({ error: 'Failed to verify user' });
    }
});

/**
 * Alternative verification: Join a specific Roblox group
 * POST /api/verify/group
 */
app.post('/api/verify/group', [
    body('robloxId').isInt(),
    body('groupId').isInt()
], async (req, res) => {
    const { robloxId, groupId } = req.body;
    const VERIFICATION_GROUP_ID = process.env.VERIFICATION_GROUP_ID || 12345678;
    
    if (groupId !== VERIFICATION_GROUP_ID) {
        return res.status(400).json({ error: 'Invalid verification group' });
    }
    
    try {
        // Check if user is in the group
        const response = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/users/${robloxId}`, { timeout: 5000 });
        
        if (response.data && response.data.groupId === groupId) {
            // User is in group - verify them
            verifiedUsers.set(robloxId, {
                verifiedAt: Date.now(),
                verificationMethod: 'group_join',
                groupId: groupId,
                ipAddress: req.ip
            });
            
            res.json({ success: true, verified: true });
        } else {
            res.json({ success: false, verified: false, message: 'Join the verification group first' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify group membership' });
    }
});

// ============ ANTI-BOT PROTECTION ============

/**
 * Generate proof-of-work challenge
 * GET /api/challenge
 */
app.get('/api/challenge', (req, res) => {
    const nonce = crypto.randomBytes(16).toString('hex');
    const difficulty = 4; // Leading zeros required
    const expires = Date.now() + 60000; // 60 seconds
    
    const challenge = {
        nonce,
        difficulty,
        expires,
        target: '0'.repeat(difficulty)
    };
    
    // Store challenge temporarily
    const challengeId = crypto.randomBytes(16).toString('hex');
    cache.set(`challenge_${challengeId}`, challenge, 60);
    
    res.json({ challengeId, ...challenge });
});

/**
 * Verify proof-of-work solution
 * POST /api/challenge/verify
 */
app.post('/api/challenge/verify', (req, res) => {
    const { challengeId, solution } = req.body;
    
    const challenge = cache.get(`challenge_${challengeId}`);
    if (!challenge) {
        return res.status(400).json({ error: 'Challenge expired or invalid' });
    }
    
    if (Date.now() > challenge.expires) {
        cache.del(`challenge_${challengeId}`);
        return res.status(400).json({ error: 'Challenge expired' });
    }
    
    // Verify solution
    const hash = crypto.createHash('sha256')
        .update(challenge.nonce + solution)
        .digest('hex');
    
    const isValid = hash.startsWith(challenge.target);
    
    if (isValid) {
        cache.del(`challenge_${challengeId}`);
        res.json({ valid: true });
    } else {
        res.status(400).json({ valid: false, error: 'Invalid proof-of-work' });
    }
});

/**
 * Behavioral fingerprinting endpoint
 * POST /api/fingerprint
 */
app.post('/api/fingerprint', (req, res) => {
    const fingerprint = req.body;
    const clientIp = req.ip;
    
    // Store fingerprint for this session
    const sessionId = crypto.randomBytes(32).toString('hex');
    cache.set(`fp_${sessionId}`, {
        fingerprint,
        ip: clientIp,
        timestamp: Date.now()
    }, 3600);
    
    // Check for suspicious patterns
    const suspicious = [];
    
    // Check for headless browser
    if (fingerprint.webdriver === true) suspicious.push('webdriver_detected');
    if (fingerprint.languages?.length === 0) suspicious.push('no_languages');
    if (fingerprint.plugins?.length === 0) suspicious.push('no_plugins');
    
    // Check for automation tools
    if (fingerprint.userAgent?.includes('puppeteer')) suspicious.push('puppeteer');
    if (fingerprint.userAgent?.includes('headless')) suspicious.push('headless');
    
    res.json({
        sessionId,
        suspicious: suspicious.length > 0 ? suspicious : null,
        riskScore: suspicious.length * 33 // 0-100 scale
    });
});

/**
 * Rate-limited deposit endpoint
 * POST /api/deposit
 */
app.post('/api/deposit', [
    body('userId').isInt(),
    body('itemId').isInt(),
    body('quantity').isInt({ min: 1, max: 100 }),
    body('token').isString().isLength({ min: 32 })
], async (req, res) => {
    const { userId, itemId, quantity, token } = req.body;
    const clientIp = req.ip;
    
    // Verify user is authenticated
    const user = verifiedUsers.get(userId);
    if (!user) {
        return res.status(401).json({ error: 'User not verified' });
    }
    
    // Check rate limit for deposits
    const depositKey = `deposit_${userId}`;
    const depositCount = cache.get(depositKey) || 0;
    if (depositCount >= 10) {
        return res.status(429).json({ error: 'Daily deposit limit reached (10 items/day)' });
    }
    
    // In production: Verify actual item ownership via Roblox inventory API
    
    // Process deposit
    cache.set(depositKey, depositCount + 1, 86400);
    
    res.json({
        success: true,
        message: `Deposited ${quantity}x item ${itemId}`,
        transactionId: crypto.randomBytes(16).toString('hex')
    });
});

// ============ ADMIN ENDPOINTS ============

/**
 * Get verification stats (admin only)
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const stats = {
        verifiedUsers: verifiedUsers.size,
        pendingVerifications: verificationCodes.size,
        activeRateLimits: rateLimitStore.size,
        cacheSize: cache.keys().length,
        uptime: process.uptime(),
        timestamp: Date.now()
    };
    
    res.json(stats);
});

/**
 * Get user verification status
 * GET /api/verify/status/:robloxId
 */
app.get('/api/verify/status/:robloxId', (req, res) => {
    const { robloxId } = req.params;
    const isVerified = verifiedUsers.has(parseInt(robloxId));
    const pending = verificationCodes.get(parseInt(robloxId));
    
    res.json({
        verified: isVerified,
        pending: !!pending,
        pendingExpires: pending?.expires || null
    });
});

/**
 * Webhook for Roblox group join events
 * POST /api/webhook/roblox
 */
app.post('/api/webhook/roblox', (req, res) => {
    const signature = req.headers['x-roblox-signature'];
    const payload = req.body;
    
    // Verify webhook signature
    const expectedSignature = generateHMAC(payload, process.env.ROBLOX_WEBHOOK_SECRET);
    if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Handle different event types
    const { eventType, userId, groupId } = payload;
    
    if (eventType === 'GroupJoin' && groupId === process.env.VERIFICATION_GROUP_ID) {
        // Auto-verify user who joined the group
        verifiedUsers.set(userId, {
            verifiedAt: Date.now(),
            verificationMethod: 'group_join_webhook',
            groupId: groupId
        });
        
        console.log(`User ${userId} auto-verified via group join`);
    }
    
    res.json({ received: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Bloxview API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
