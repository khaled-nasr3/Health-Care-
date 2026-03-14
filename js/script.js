async function askAI() {
    const question = document.getElementById("question").value;

    if (!question) {
        alert("Please type a question!");
        return;
    }

    const resultEl = document.getElementById("result");
    resultEl.innerText = "";

    try {
        const response = await fetch("http://localhost:4000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });

        if (!response.ok) {
            resultEl.innerText = `Server error: ${response.status}`;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value).split("\n").filter(l => l.trim());
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.replace("data: ", "").trim();
                if (raw === "[DONE]") return;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.error) {
                        resultEl.innerText = parsed.error;
                        return;
                    }
                    if (parsed.token) {
                        resultEl.innerText += parsed.token;
                    }
                } catch { }
            }
        }

    } catch (err) {
        console.error("Fetch error:", err);
        resultEl.innerText = "Cannot connect to server. Make sure the backend is running.";
    }
}

function goToAssistant() {
    const q = document.getElementById("question").value.trim();
    if (!q) { alert("Please type a question!"); return; }
    window.location.href = `ai_assistant.html?q=${encodeURIComponent(q)}`;
}