import { logDebug } from './logger.js';

/**
 * List of AI agent names to be replaced with "Droid"
 * Case-insensitive matching
 */
const AI_AGENT_PATTERNS = [
  /GitHub\s*Copilot/gi,
  /Claude\s*Code/gi,
  /Kilo\s*Code/gi,
  /Claude\s*CLI/gi,
  /Anthropic\s*CLI/gi,
  /OpenAI\s*CLI/gi,
  /Replit\s*Agent/gi,
  /Amazon\s*Q/gi,
  /Zed\s*AI/gi,
  /ChatGPT/gi,
  /Cursor/gi,
  /Copilot/gi,
  /Windsurf/gi,
  /Cline/gi,
  /Aider/gi,
  /Devin/gi,
  /Bolt/gi,
  /v0/gi,
  /Continue/gi,
  /Tabnine/gi,
  /Codeium/gi,
  /CodeWhisperer/gi
];

/**
 * Replace AI agent names in text with "Droid"
 * @param {string} text - Text to filter
 * @returns {string} Filtered text
 */
export function filterText(text) {
  if (typeof text !== 'string' || !text) {
    return text;
  }

  let filtered = text;
  let hasReplacement = false;

  for (const pattern of AI_AGENT_PATTERNS) {
    const beforeReplace = filtered;
    filtered = filtered.replace(pattern, 'Droid');
    if (beforeReplace !== filtered) {
      hasReplacement = true;
    }
  }

  if (hasReplacement) {
    logDebug('Message filtered: AI agent names replaced with Droid');
  }

  return filtered;
}

/**
 * Filter content in a message content block
 * Handles both string and array content formats
 * @param {string|Array} content - Message content
 * @returns {string|Array} Filtered content
 */
export function filterMessageContent(content) {
  if (typeof content === 'string') {
    return filterText(content);
  }

  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') {
        return filterText(part);
      }
      if (part && typeof part === 'object') {
        const filtered = { ...part };
        if (filtered.text) {
          filtered.text = filterText(filtered.text);
        }
        if (filtered.content && typeof filtered.content === 'string') {
          filtered.content = filterText(filtered.content);
        }
        return filtered;
      }
      return part;
    });
  }

  return content;
}

/**
 * Filter all messages in an array
 * @param {Array} messages - Array of messages
 * @returns {Array} Filtered messages
 */
export function filterMessages(messages) {
  if (!Array.isArray(messages)) {
    return messages;
  }

  return messages.map(msg => {
    if (!msg || typeof msg !== 'object') {
      return msg;
    }

    const filtered = { ...msg };
    
    if (filtered.content) {
      filtered.content = filterMessageContent(filtered.content);
    }

    return filtered;
  });
}

/**
 * Filter system content (can be string or array)
 * @param {string|Array} system - System content
 * @returns {string|Array} Filtered system content
 */
export function filterSystemContent(system) {
  if (typeof system === 'string') {
    return filterText(system);
  }

  if (Array.isArray(system)) {
    return system.map(part => {
      if (typeof part === 'string') {
        return filterText(part);
      }
      if (part && typeof part === 'object') {
        const filtered = { ...part };
        if (filtered.text) {
          filtered.text = filterText(filtered.text);
        }
        return filtered;
      }
      return part;
    });
  }

  return system;
}
