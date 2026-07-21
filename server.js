// =======================================================================
// 👑 LURA STUDIO: ENTERPRISE MICROSERVICE (V6)
// =======================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan'); 
const os = require('os');
const { performance } = require('perf_hooks');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.NVIDIA_API_KEY || process.env.API_KEY;
const API_URL = process.env.API_URL || "https://integrate.api.nvidia.com/v1/chat/completions";

// 🛡️ SECURITY & TRAFFIC RADAR
app.use(helmet());
app.use(compression());
app.use(morgan('dev')); // Live terminal traffic logging

// 🔒 STRICT CORS (Only Vercel & Local Developer Access)
const allowedOrigins = ['https://lura-psi.vercel.app', 'http://localhost:5500', 'http://127.0.0.1:5500'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Security Protocol: Access Denied by CORS.'));
        }
    }
}));

app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// 🛑 SMART RATE LIMITER
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, // Boosted to 100 for power user access
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Security Protocol: Network flooded. Try again shortly." }
});
app.use('/api/', apiLimiter);

// 📊 HEALTH CHECK PING
app.get(['/api/ping', '/api/health'], (req, res) => {
    const memory = process.memoryUsage();
    res.status(200).json({ 
        status: "LURA CORE ACTIVE", 
        uptime: `${(process.uptime() / 60).toFixed(2)} minutes`,
        hardware: { ram_usage: `${(memory.rss / 1024 / 1024).toFixed(2)} MB` },
        timestamp: new Date().toISOString() 
    });
});

// 🧠 MAIN AI ROUTE (WITH AUTO-HEALING)
app.post('/api/chat', async (req, res) => {
    const start_time = performance.now();
    const { model, systemPrompt, messages } = req.body;
    let targetModel = model || "meta/llama-3.1-8b-instruct";

    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 NEW REQUEST IDENTIFIED: ${targetModel}`);

    if (!API_KEY) return res.status(500).json({ error: "System Fault: Missing API Key." });

    const temporalContext = `\n[SYSTEM CORE: The current year is 2026. Today is ${new Date().toDateString()}. Maintain absolute 2026 accuracy.]`;
    const formattedMessages = [
        { role: "system", content: (systemPrompt || "You are Lura, an elite AI.") + temporalContext },
        ...messages
    ];

    const payload = { model: targetModel, messages: formattedMessages, temperature: 0.7, max_tokens: 4000 };
    const config = { headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" }, timeout: 90000 };

    // ♻️ AUTO-RETRY LOGIC 
    let attempts = 0;
    let maxAttempts = 2;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            let response = await axios.post(API_URL, payload, config);
            const aiReply = response.data.choices[0].message.content;
            const end_time = performance.now();
            console.log(`✅ [SUCCESS] AI generated response in ${(end_time - start_time).toFixed(2)}ms`);
            return res.status(200).json({ reply: aiReply });
        } catch (error) {
            console.error(`❌ [API ERROR - Attempt ${attempts}]:`, error.message);
            if (attempts >= maxAttempts) {
                if (error.response?.status === 413) return res.status(413).json({ error: "Payload too massive. Compress assets." });
                return res.status(error.response?.status || 500).json({ error: `Provider Fault: ${error.message}` });
            }
            console.log(`🔄 Retrying Request...`);
        }
    }
});

// 🛑 GRACEFUL SHUTDOWN SEQUENCE
const server = app.listen(PORT, () => console.log(`👑 LURA STUDIO CLUSTER ACTIVE ON PORT ${PORT}`));

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('💤 Process terminated safely.');
        process.exit(0);
    });
});