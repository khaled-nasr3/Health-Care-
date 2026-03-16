// ── Imports ──
import express from "express";   // Creates the server and defines routes
import fetch from "node-fetch";  // Makes requests to external APIs like Groq
import cors from "cors";         // Allows the frontend to communicate with the server
import dotenv from "dotenv";     // Reads variables from .env file like the API Key

// ── Server Setup ──
dotenv.config();                 // Load the .env file
const app = express();           // Create the server
app.use(cors());                 // Allow any website to talk to the server
app.use(express.json());         // Allow the server to understand incoming JSON

// ── Route: /ask ──
app.post("/ask", async (req, res) => {
    const question = req.body.question; // Get the question sent from the frontend

    // Set headers to enable streaming (send response word by word)
    res.setHeader("Content-Type", "text/event-stream"); // Tell the browser the response is a stream
    res.setHeader("Cache-Control", "no-cache");         // Don't cache the response
    res.setHeader("Connection", "keep-alive");          // Keep the connection open until response is done

    try {
        // Send the question to Groq AI API
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.API_KEY}`, // API Key from .env
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant", // AI model to use
                max_tokens: 1000,              // Maximum length of the response
                stream: true,                  // Enable streaming (word by word)
                messages: [
                    {
                        role: "system",
                        // Define the AI's personality and behavior
                        content: "You are Health-Bridge's medical AI assistant. Answer health questions clearly. Always recommend consulting a doctor for serious conditions, and remove stars from your answer and replace it with ()."
                    },
                    {
                        role: "user",
                        content: question // The user's question
                    }
                ]
            })
        });

        // ── Handle API Errors ──
        if (!response.ok) {
            const err = await response.json();
            const msg = err.error?.message || "API error";

            // If too many requests were sent in a short time
            if (msg.includes("429") || msg.includes("rate-limited")) {
                res.write(`data: ${JSON.stringify({ error: "⏳ Too many requests! Please wait 10 seconds and try again." })}\n\n`);
            } else {
                // Any other API error
                res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
            }
            res.end(); // Close the connection
            return;
        }

        // ── Handle Streaming Response ──
        for await (const chunk of response.body) {
            // Convert chunk from bytes to string, split into lines, remove empty lines
            const lines = chunk.toString().split("\n").filter(l => l.trim());

            for (const line of lines) {
                // Skip any line that doesn't start with "data: "
                if (!line.startsWith("data: ")) continue;

                // Remove "data: " prefix to get the raw JSON string
                const raw = line.replace("data: ", "").trim();

                // If Groq signals the stream is done, notify the frontend and close the connection
                if (raw === "[DONE]") { res.write("data: [DONE]\n\n"); res.end(); return; }

                try {
                    // Parse the JSON string into an object
                    const parsed = JSON.parse(raw);

                    // Extract the new word/token from the response
                    const token = parsed.choices?.[0]?.delta?.content;

                    // If a token exists, send it immediately to the frontend
                    if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
                } catch { } // Ignore any malformed JSON chunks
            }
        }

        // Stream finished, notify the frontend and close the connection
        res.write("data: [DONE]\n\n");
        res.end();

    } catch (err) {
        // Handle any unexpected errors (e.g. network issues)
        console.error("Error:", err.message);
        res.write(`data: ${JSON.stringify({ error: "Error connecting to AI API" })}\n\n`);
        res.end();
    }
});

// ── Start the Server ──
const PORT = process.env.PORT || 4000; // Use port from .env, default to 4000
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle server-level errors
server.on("error", (err) => console.error("Server error:", err.message));

// Handle any uncaught exceptions to prevent the server from crashing
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err.message));