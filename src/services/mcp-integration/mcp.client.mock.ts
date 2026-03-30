/**
 * Mock MCP Client for Testing
 * 
 * This is a mock implementation of the MCP client for testing purposes.
 */

export class MCPClient {
  private initialized: boolean;
  private connected: boolean;

  constructor() {
    this.initialized = true;
    this.connected = true;
  }

  /**
   * Checks if the MCP client is initialized.
   * 
   * @returns True if the client is initialized, false otherwise.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Checks the connectivity of the MCP client.
   * 
   * @returns A promise that resolves to an object indicating the connectivity status.
   */
  async checkConnectivity(): Promise<{ connected: boolean }> {
    return { connected: this.connected };
  }

  /**
   * Sets the initialization status of the MCP client.
   * 
   * @param initialized The initialization status to set.
   */
  setInitialized(initialized: boolean): void {
    this.initialized = initialized;
  }

  /**
   * Sets the connectivity status of the MCP client.
   * 
   * @param connected The connectivity status to set.
   */
  setConnected(connected: boolean): void {
    this.connected = connected;
  }
}
