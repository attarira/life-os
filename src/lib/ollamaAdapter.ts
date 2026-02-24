import { ChatAdapter, ChatMessage, AppContext } from '../components/ChatPanel';

const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'gemma3:1b-it-qat';

// ─── Health Verification ───────────────────────────────────────────────────

/**
 * Checks if the local Ollama service is running.
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_URL);
    // Ollama typically returns "Ollama is running" on the root endpoint.
    return res.ok;
  } catch (err) {
    return false;
  }
}

// ─── System Prompt ──────────────────────────────────────────────────────────

const generateSystemPrompt = (context: AppContext) => {
  // Convert tasks to a compact string to save context window space
  const taskContext = context.tasks.map(t =>
    `[${t.status}] ${t.title} ${t.dueDate ? `(Due: ${new Date(t.dueDate).toLocaleDateString()})` : ''}`
  ).join('\\n');

  return `You are a helpful and concise personal assistant AI for a planning application called LifeOS.
You are chatting with the user.

Here is the current state of the user's tasks and projects from their database:
<tasks>
${taskContext}
</tasks>

Answer the user's questions based on this data. If the answer is not in the data, state that you don't know based on the current context. Keep your answers brief and natural. Do NOT output raw JSON unless specifically asked.`;
};

// ─── Adapter Implementation ────────────────────────────────────────────────

export const ollamaCommandAdapter: ChatAdapter = async (message, history, context) => {
  const isHealthy = await checkOllamaHealth();
  if (!isHealthy) {
    return "Error: Ollama does not appear to be running on http://localhost:11434. Please start the Ollama service.";
  }

  // Format history for Ollama
  // The adapter's `history` contains the current user message as well, but we'll drop it here
  // and pass the latest `message` string as the final user prompt.
  const pastMessages = history.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content
  }));

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: generateSystemPrompt(context) },
          ...pastMessages,
          { role: 'user', content: message },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.message?.content || "No response received.";

  } catch (error: any) {
    console.error("Ollama Request failed", error);
    return `Error communicating with Ollama: ${error.message}`;
  }
};

// ─── Test Suite ────────────────────────────────────────────────────────────

/**
 * Note: Action routing tests disabled as we've switched entirely to conversational UI mode.
 */
export async function runOllamaTests() {
  console.log("=== Action router tests are disabled in conversational mode ===");
}
