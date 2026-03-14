import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ask", async (req, res) => {
    const question = req.body.question;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                max_tokens: 1000,
                stream: true,
                messages: [
                    {
                        role: "system",
                        content: "You are Health-Bridge's medical AI assistant. Answer health questions clearly. Always recommend consulting a doctor for serious conditions, and remove stars from your answer and replace it with ()."
                    },
                    {
                        role: "user",
                        content: question
                    }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            const msg = err.error?.message || "API error";
            if (msg.includes("429") || msg.includes("rate-limited")) {
                res.write(`data: ${JSON.stringify({ error: "⏳ Too many requests! Please wait 10 seconds and try again." })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
            }
            res.end();
            return;
        }

        for await (const chunk of response.body) {
            const lines = chunk.toString().split("\n").filter(l => l.trim());
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.replace("data: ", "").trim();
                if (raw === "[DONE]") { res.write("data: [DONE]\n\n"); res.end(); return; }
                try {
                    const parsed = JSON.parse(raw);
                    const token = parsed.choices?.[0]?.delta?.content;
                    if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
                } catch { }
            }
        }

        res.write("data: [DONE]\n\n");
        res.end();

    } catch (err) {
        console.error("Error:", err.message);
        res.write(`data: ${JSON.stringify({ error: "Error connecting to AI API" })}\n\n`);
        res.end();
    }
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on("error", (err) => console.error("Server error:", err.message));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err.message));