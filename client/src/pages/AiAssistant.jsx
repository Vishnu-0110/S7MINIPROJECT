import { Bot, Send } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

const assistantProfiles = {
  FACULTY_STAFF: {
    description: "Ask about your vehicle requests and upcoming trips.",
    placeholder: "For example: Show my pending requests",
    suggestions: ["Show my pending requests.", "What is the status of my requests?", "Show my upcoming trips.", "When is my next scheduled trip?"]
  },
  DRIVER: {
    description: "Ask about your assigned trips, active trip, and driving work.",
    placeholder: "For example: Show my trips for today",
    suggestions: ["Show my trips for today.", "Do I have an active trip?", "What is my next assigned trip?", "Show my scheduled trips."]
  },
  DEPARTMENT_COORDINATOR: {
    description: "Ask about department requests, approvals, and trips.",
    placeholder: "For example: Show pending department approvals",
    suggestions: ["Show pending department approvals.", "How many department requests are pending?", "Show department trips scheduled today.", "What requests need my approval?"]
  },
  TRANSPORT_ADMIN: {
    description: "Ask about fleet availability, requests, allocations, and scheduled trips.",
    placeholder: "For example: Which vehicles are available?",
    suggestions: ["Which vehicles are available?", "Which vehicle is suitable for 35 students?", "Show pending requests.", "How many trips are scheduled today?"]
  }
};

export default function AiAssistant() {
  const user = useAuthStore((state) => state.user);
  const profile = assistantProfiles[user?.role] || assistantProfiles.FACULTY_STAFF;
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
          <div><h2 className="text-lg font-semibold">Help Assistant</h2><p className="text-sm text-slate-500">{profile.description}</p></div>
        </div>
        {error ? <div className="alert alert-error mt-4">{error}</div> : null}
        <div className="mt-5 min-h-[420px] space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={`chat ${message.role === "user" ? "chat-end" : "chat-start"}`}>
              <div className={`chat-bubble break-words ${message.role === "user" ? "chat-bubble-primary" : "bg-slate-100 text-slate-900"}`}>
                <p className="break-words whitespace-pre-wrap">{message.text}</p>
                {message.fallbackMode ? <p className="mt-2 text-xs opacity-70">Fallback mode</p> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex min-w-0 gap-2">
          <input className="input input-bordered min-w-0 flex-1" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} aria-label="Ask for help" placeholder={profile.placeholder} />
          <button className="btn btn-primary" onClick={() => ask()} disabled={loading}>
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
      <aside className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Try one of these</h3>
        <div className="mt-4 space-y-2">
          {profile.suggestions.map((item) => (
            <button key={item} className="btn btn-outline btn-sm h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left" onClick={() => ask(item)}>
              {item}
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
