import {
  buildAssistantTaskSnapshot,
  buildDailyFocusReply,
  buildGeneralChatSystemPrompt,
  buildStatusSummaryReply,
  buildTaskLookupReply,
  routeAssistantIntent,
} from './assistant';
import type { AppContext, AssistantReply, ChatAdapter, ChatMessage } from './assistant';

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
  } catch {
    return false;
  }
}

// ─── System Prompt ──────────────────────────────────────────────────────────

async function runOllamaChat(message: string, history: ChatMessage[], context: AppContext): Promise<AssistantReply> {
  const isHealthy = await checkOllamaHealth();
  if (!isHealthy) {
    return {
      text: "Error: Ollama does not appear to be running on http://localhost:11434. Please start the Ollama service.",
      intent: 'general_chat',
    };
  }

  // Format history for Ollama
  // The adapter's `history` contains the current user message as well, but we'll drop it here
  // and pass the latest `message` string as the final user prompt.
  const pastMessages = history
    .slice(0, -1)
    .filter(messageItem => messageItem.role !== 'system')
    .slice(-6)
    .map(m => ({
      role: m.role,
      content: m.content
    }));

  const snapshot = buildAssistantTaskSnapshot(context.tasks);

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
          { role: 'system', content: buildGeneralChatSystemPrompt(snapshot) },
          ...pastMessages,
          { role: 'user', content: message },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      text: data.message?.content || 'No response received.',
      intent: 'general_chat',
    };

  } catch (error: unknown) {
    console.error("Ollama Request failed", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      text: `Error communicating with Ollama: ${errorMessage}`,
      intent: 'general_chat',
    };
  }
}

// ─── Adapter Implementation ────────────────────────────────────────────────

export const ollamaCommandAdapter: ChatAdapter = async (message, history, context) => {
  const intent = routeAssistantIntent(message);

  if (intent === 'daily_focus') {
    return buildDailyFocusReply(context.tasks);
  }

  if (intent === 'status_summary') {
    return buildStatusSummaryReply(context.tasks);
  }

  if (intent === 'task_lookup') {
    return buildTaskLookupReply(message, context);
  }

  return runOllamaChat(message, history, context);
};

// ─── Test Suite ────────────────────────────────────────────────────────────

/**
 * Note: Action routing tests disabled as we've switched entirely to conversational UI mode.
 */
export async function runOllamaTests() {
  console.log("=== Action router tests are disabled in conversational mode ===");
}
