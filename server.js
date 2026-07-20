// =======================================================================
// 👑 LURA STUDIO: THE ULTIMATE REAL-TIME ENTERPRISE BACKEND
// =======================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.NVIDIA_API_KEY || process.env.API_KEY; // Fallback in case variable names change
const API_URL = process.env.API_URL || "https://integrate.api.nvidia.com/v1/chat/completions";

// 🛡️ ====================================================================
// 1. ENTERPRISE SECURITY & MIDDLEWARE
// =======================================================================
app.use(helmet()); // Secures HTTP headers against malicious attacks
app.use(compression()); // Zips the payload for hyper-fast response times
app.use(cors({ origin: '*' })); 

// 🚀 100MB PAYLOAD UPGRADE (Fixes high-res photo crashing)
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// 🛑 THE FIREWALL (API Token Saver)
// Blocks spam attacks. Max 50 requests per 15 minutes per IP.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50, 
    message: { error: "Security Protocol: Too many requests. Please wait." }
});
app.use('/api/', apiLimiter); // Applies firewall to all /api/ routes


// 🟢 ====================================================================
// 2. ECOSYSTEM HEALTH & ANTI-SLEEP PING
// =======================================================================
// Use this for cron-jobs to prevent server sleep, or for local phone pinging
app.get(['/api/ping', '/api/health'], (req, res) => {
    res.status(200).json({ 
        status: "LURA SYSTEM ACTIVE", 
        timestamp: new Date().toISOString() 
    });
});


// 🧠 ====================================================================
// 3. MAIN AI NEURAL CORE (CHAT & VISION)
// =======================================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { model, systemPrompt, messages, role } = req.body;
        console.log(`[${new Date().toLocaleTimeString()}] INCOMING PAYLOAD - Model: ${model || "Default"}`);

        if (!API_KEY) {
            console.error("❌ [ERROR] Missing API Key in Render Environment.");
            return res.status(500).json({ error: "Server misconfiguration: Missing API Key." });
        }

        // 🕒 THE TIME MACHINE: Real-Time Chronological Injection
        const temporalContext = `\n[REAL-TIME SYSTEM INFO: The current local date and time is ${new Date().toString()}. The current year is 2026. You have native access to real-time chronological data. Respond accurately to time-sensitive queries using this reference.]`;

        const formattedMessages = [
            { role: "system", content: (systemPrompt || "You are a helpful AI assistant.") + temporalContext },
            ...messages
        ];

        // ⚡ FIRE THE REQUEST TO NVIDIA VIA AXIOS
        const response = await axios.post(
            API_URL,
            {
                model: model || "meta/llama-3.1-8b-instruct", 
                messages: formattedMessages,
                temperature: 0.7,
                max_tokens: 4000,
            },
            {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 90000 // ⏱️ 90-Second Kill Switch
            }
        );

        const aiReply = response.data.choices[0].message.content;
        console.log(`[${new Date().toLocaleTimeString()}] SUCCESS - Response sent to client.`);
        res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("❌ [API FATAL ERROR]:", error.message);
        
        // 🛡️ INDUSTRIAL ERROR CATCHING
        if (error.response) {
            // Check specifically for massive image payloads that break the 100mb barrier
            if (error.response.status === 413) {
                return res.status(413).json({ error: "Image file is too massive for the neural net. Please compress the photo." });
            }
            res.status(error.response.status).json({ 
                error: `Provider Error: ${error.response.data?.error?.message || "Unknown API failure"}` 
            });
        } else if (error.request) {
            // Caught by the 90-second Axios timeout
            res.status(504).json({ error: "AI Provider timed out. Please try again." });
        } else {
            // General server crash
            res.status(500).json({ error: "Internal Server Engine Failure: " + error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`👑 LURA STUDIO FUSION BACKEND ONLINE ON PORT ${PORT}`);
});