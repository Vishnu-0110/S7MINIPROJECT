import { Bot, Send } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api.js";

const suggestions = [
  "Which vehicles are available tomorrow?",
  "Which vehicle is suitable for 35 students?",
  "Show my pending requests.",
  "How many trips are scheduled today?"
];

export default function AiAssistant() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(text = prompt) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setMessages((current) => [...current, { role: "user", text }]);
    try {
      const result = await api.post("/ai/ask", { prompt: text });
      setMessages((current) => [
        ...current,
        { role: "assistant", text: result.data.answer, data: result.data.data, fallbackMode: result.data.fallbackMode }
      ]);
      setPrompt("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI Assistant</h2>
        </div>
        {error ? <div className="alert alert-error mt-4">{error}</div> : null}
        <div className="mt-5 min-h-[420px] space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={`chat ${message.role === "user" ? "chat-end" : "chat-start"}`}>
              <div className={`chat-bubble break-words ${message.role === "user" ? "chat-bubble-primary" : "bg-slate-100 text-slate-900"}`}>
                <p className="break-words">{message.text}</p>
                {message.fallbackMode ? <p className="mt-2 text-xs opacity-70">Fallback mode</p> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex min-w-0 gap-2">
          <input className="input input-bordered min-w-0 flex-1" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} aria-label="Ask the AI assistant" />
          <button className="btn btn-primary" onClick={() => ask()} disabled={loading}>
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
      <aside className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Suggested prompts</h3>
        <div className="mt-4 space-y-2">
          {suggestions.map((item) => (
            <button key={item} className="btn btn-outline btn-sm h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left" onClick={() => ask(item)}>
              {item}
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
