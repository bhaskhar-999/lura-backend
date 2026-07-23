// =======================================================================
// 👑 LURA STUDIO: ENTERPRISE MICROSERVICE (V8 - MULTIMODAL EDITION)
// =======================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan'); 
const { performance } = require('perf_hooks');
const { OAuth2Client } = require('google-auth-library'); 

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.NVIDIA_API_KEY || process.env.API_KEY;
const API_URL = process.env.API_URL || "https://integrate.api.nvidia.com/v1/chat/completions";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 🛡️ SECURITY & TRAFFIC RADAR
app.use(helmet());
app.use(compression());
app.use(morgan('dev')); 

// 🔒 STRICT CORS
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

// Increased limits because photos and base64 documents require a lot of bandwidth
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// 🛑 SMART RATE LIMITER
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Security Protocol: Network flooded. Try again shortly." }
});
app.use('/api/', apiLimiter);

// 🚨 THE GUARDRAIL SYSTEM 
const blockedWords = ["hack", "illegal", "bypass", "exploit"];
function isMessageSafe(text) {
    if (!text) return true;
    const lowerCaseText = text.toLowerCase();
    return !blockedWords.some(word => lowerCaseText.includes(word));
}

// 🎭 CUSTOM AI PERSONAS
const personas = {
    default: "You are Lura, an elite AI.",
    coder: "You are Lura, an elite master programmer. Provide clean, efficient code.",
    sarcastic: "You are Lura, a highly sarcastic but brilliant AI assistant.",
    roblox: "You are Lura, an expert in Roblox game development and Lua scripting."
};

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

// 🧠 MAIN AI ROUTE (WITH VISION & DOCUMENT SUPPORT)
app.post('/api/chat', async (req, res) => {
    const start_time = performance.now();
    
    // NEW: Added 'documents' to the payload to handle attached text files
    const { idToken, userMessage, persona = "default", imageUrl, documents, model, systemPrompt, messages } = req.body;
    
    let targetModel = model || "meta/llama-3.1-8b-instruct";

    // ✨ VISION AUTO-SWITCH: If an image is present, force a Vision-capable model
    if (imageUrl && !targetModel.includes('vision')) {
        targetModel = "meta/llama-3.2-11b-vision-instruct";
        console.log("👁️ Image detected: Auto-switching to Vision model.");
    }

    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 NEW REQUEST IDENTIFIED: ${targetModel}`);

    if (!API_KEY) return res.status(500).json({ error: "System Fault: Missing API Key." });

    // 1. GUARDRAIL CHECK
    const textToCheck = userMessage || JSON.stringify(messages || []) + JSON.stringify(documents || []);
    if (!isMessageSafe(textToCheck)) {
        console.log(`🛡️ Guardrail triggered. Blocked request.`);
        return res.json({ reply: "I am sorry I can't reply with that" });
    }

    try {
        // 2. GOOGLE LOGIN CHECK
        if (!idToken) {
            return res.status(401).json({ error: "Security Protocol: Missing Google Authorization." });
        }
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID, 
        });
        const payload = ticket.getPayload();
        console.log(`👤 Verified User Request: ${payload.email}`);

        // 3. BUILD AI CONTEXT & PERSONA
        const temporalContext = `\n[SYSTEM CORE: The current year is 2026. Today is ${new Date().toDateString()}. Maintain absolute 2026 accuracy.]`;
        let activePersona = systemPrompt || personas[persona] || personas.default;
        
        let aiMessages = [
            { role: "system", content: activePersona + temporalContext }
        ];

        // ✨ DOCUMENT HANDLER: Inject document contents into the system prompt securely
        if (documents && Array.isArray(documents) && documents.length > 0) {
            let docContext = "\n\n[USER UPLOADED DOCUMENTS]:\n";
            documents.forEach(doc => {
                docContext += `\n--- Document: ${doc.name} ---\n${doc.content}\n------------------------\n`;
            });
            docContext += "\nPlease refer to the above documents to answer the user's prompt.";
            aiMessages[0].content += docContext;
            console.log(`📄 Added ${documents.length} document(s) to AI context.`);
        }

        // 4. ATTACH CHAT & IMAGE VISION HISTORY
        if (imageUrl) {
            // Standard OpenAI/NVIDIA formatting for multimodal image requests
            aiMessages.push({
                role: "user",
                content: [
                    { type: "text", text: userMessage || "Analyze this image." },
                    { type: "image_url", image_url: { url: imageUrl } } // Works with https:// or data:image/png;base64,...
                ]
            });
        } else if (messages && Array.isArray(messages)) {
            aiMessages = aiMessages.concat(messages);
        } else if (userMessage) {
            aiMessages.push({ role: "user", content: userMessage });
        }

        const apiPayload = { model: targetModel, messages: aiMessages, temperature: 0.7, max_tokens: 4000 };
        const config = { headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" }, timeout: 90000 };

        // 5. ♻️ AUTO-RETRY LOGIC 
        let attempts = 0;
        let maxAttempts = 2;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                let response = await axios.post(API_URL, apiPayload, config);
                const aiReply = response.data.choices[0].message.content;
                const end_time = performance.now();
                console.log(`✅ [SUCCESS] AI generated response in ${(end_time - start_time).toFixed(2)}ms`);
                return res.status(200).json({ reply: aiReply });
            } catch (error) {
                console.error(`❌ [API ERROR - Attempt ${attempts}]:`, error.response ? error.response.data : error.message);
                if (attempts >= maxAttempts) {
                    if (error.response?.status === 413) return res.status(413).json({ error: "Payload too massive. Compress assets." });
                    return res.status(error.response?.status || 500).json({ error: `Provider Fault: ${error.message}` });
                }
                console.log(`🔄 Retrying Request...`);
            }
        }
    } catch (authError) {
        console.error("❌ Authentication Error:", authError.message);
        res.status(401).json({ error: "Invalid Google Token. Please log in again." });
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