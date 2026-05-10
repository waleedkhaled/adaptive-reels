/** A call the agent cannot honour: an unknown id, or an action on an item that is not on screen. */
export class AgentError extends Error {
  override name = 'AgentError';
}
