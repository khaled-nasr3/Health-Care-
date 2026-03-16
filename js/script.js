// ── Ask AI Function ──
async function askAI() {
    // Get the question from the input field
    const question = document.getElementById("question").value;

    // If the input is empty, alert the user and stop
    if (!question) {
        alert("Please type a question!");
        return;
    }

    // Get the result element and clear any previous response
    const resultEl = document.getElementById("result");
    resultEl.innerText = "";

    try {
        // Send the question to the backend server
        const response = await fetch("http://localhost:4000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });

        // If the server returned an error, display it and stop
        if (!response.ok) {
            resultEl.innerText = `Server error: ${response.status}`;
            return;
        }

        // Set up a reader to receive the streaming response word by word
        const reader = response.body.getReader();

        // Decoder to convert bytes into readable text
        const decoder = new TextDecoder();

        // Keep reading until the stream is done
        while (true) {
            const { done, value } = await reader.read();

            // If the stream is finished, exit the loop
            if (done) break;

            // Convert bytes to string, split into lines, remove empty lines
            const lines = decoder.decode(value).split("\n").filter(l => l.trim());

            for (const line of lines) {
                // Skip any line that doesn't start with "data: "
                if (!line.startsWith("data: ")) continue;

                // Remove "data: " prefix to get the raw JSON string
                const raw = line.replace("data: ", "").trim();

                // If the stream is done, stop
                if (raw === "[DONE]") return;

                try {
                    // Parse the JSON string into an object
                    const parsed = JSON.parse(raw);

                    // If the server sent an error message, display it and stop
                    if (parsed.error) {
                        resultEl.innerText = parsed.error;
                        return;
                    }

                    // If a token exists, append it to the result element
                    if (parsed.token) {
                        resultEl.innerText += parsed.token;
                    }
                } catch { } // Ignore any malformed JSON chunks
            }
        }

    } catch (err) {
        // Handle any network or connection errors
        console.error("Fetch error:", err);
        resultEl.innerText = "Cannot connect to server. Make sure the backend is running.";
    }
}

// ── Navigate to AI Assistant Page ──
function goToAssistant() {
    // Get the question and remove extra spaces
    const q = document.getElementById("question").value.trim();

    // If the input is empty, alert the user and stop
    if (!q) { alert("Please type a question!"); return; }

    // Redirect to the assistant page with the question as a URL parameter
    window.location.href = `ai_assistant.html?q=${encodeURIComponent(q)}`;
}