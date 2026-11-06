import { useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

function App() {
  const [userPrompt, setUserPrompt] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGiftRequest(e) {
    e.preventDefault();

    const prompt = userPrompt.trim();
    if (!prompt) return;

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5050/api/gift-genie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrompt: prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      setSuggestions("");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setSuggestions(fullText);
      }
    } catch (error) {
      console.error(error);
      setSuggestions("Sorry, I can't access what I need right now. Please try again.");
    } finally {
      setLoading(false);
    }




    
  }

  const html = marked.parse(suggestions);
  const safeHTML = DOMPurify.sanitize(html);

  return (
    <div>
      <h1>Gift Genie</h1>

      <form onSubmit={handleGiftRequest}>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Describe the person you're buying a gift for..."
        />
        <br></br>
        <button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Get gifts"}
        </button>
      </form>

      <div dangerouslySetInnerHTML={{ __html: safeHTML }}></div>
    </div>
  );
}

export default App;