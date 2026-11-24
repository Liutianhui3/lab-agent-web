let sequence = 0

// Temporary UI keys only; these IDs are not authentication tokens.
export function createMessageId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  sequence += 1
  return `message-${Date.now().toString(36)}-${sequence}`
}
