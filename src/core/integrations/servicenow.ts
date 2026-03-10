import { logger, PerformanceLogger } from '../../utils/logger';
import { ServiceNowError, ErrorCode } from '../../utils/errors';

/**
 * ServiceNow REST API Client
 * Provides interface to ServiceNow instance for incident management and Now Assist
 */

// ============================================================================
// Types
// ============================================================================

export interface ServiceNowConfig {
  instanceUrl: string; // e.g., "https://dev12345.service-now.com"
  username: string;
  password: string;
  timeout?: number; // milliseconds, default 30000
}

export interface ServiceNowIncident {
  sys_id: string;
  number: string;
  short_description: string;
  description?: string;
  priority: '1' | '2' | '3' | '4' | '5'; // 1-Critical, 5-Planning
  state: string;
  impact?: '1' | '2' | '3';
  urgency?: '1' | '2' | '3';
  category?: string;
  assigned_to?: string;
  opened_at?: string;
  updated_at?: string;
}

export interface ServiceNowListResponse<T> {
  result: T[];
}

export interface ServiceNowSingleResponse<T> {
  result: T;
}

export interface ServiceNowHealthResponse {
  status: 'ok' | 'error';
  instance: string;
  version?: string;
}

export interface ServiceNowQueryOptions {
  sysparm_query?: string; // Encoded query string
  sysparm_limit?: number; // Max records to return (default: 100)
  sysparm_offset?: number; // Starting record number
  sysparm_fields?: string; // Comma-separated field names
  sysparm_display_value?: 'true' | 'false' | 'all'; // Display values vs actual values
}

// ============================================================================
// ServiceNow Client
// ============================================================================

export class ServiceNowClient {
  private config: Required<ServiceNowConfig>;
  private authHeader: string;

  constructor(config: ServiceNowConfig) {
    this.config = {
      instanceUrl: config.instanceUrl.replace(/\/$/, ''), // Remove trailing slash
      username: config.username,
      password: config.password,
      timeout: config.timeout ?? 30000,
    };

    // Create Basic Auth header
    const credentials = btoa(`${this.config.username}:${this.config.password}`);
    this.authHeader = `Basic ${credentials}`;

    logger.info('ServiceNow client initialized', {
      instanceUrl: this.config.instanceUrl,
      username: this.config.username,
    });
  }

  /**
   * Test connection to ServiceNow instance
   */
  async healthCheck(): Promise<ServiceNowHealthResponse> {
    const perf = new PerformanceLogger(logger, 'ServiceNow health check');

    try {
      // Use the sys_user table to verify authentication
      const response = await this.fetch('/api/now/table/sys_user', {
        method: 'GET',
        params: {
          sysparm_limit: '1',
          sysparm_fields: 'sys_id',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new ServiceNowError(
            ErrorCode.SERVICENOW_AUTH_FAILED,
            'Authentication failed',
            response.status
          );
        }

        throw new ServiceNowError(
          ErrorCode.SERVICENOW_CONNECTION_FAILED,
          `Health check failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      perf.end({ status: 'ok' });

      return {
        status: 'ok',
        instance: this.config.instanceUrl,
      };
    } catch (error) {
      perf.endWithError(error as Error);

      if (error instanceof ServiceNowError) {
        throw error;
      }

      throw new ServiceNowError(
        ErrorCode.SERVICENOW_CONNECTION_FAILED,
        'Failed to connect to ServiceNow',
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get incident by number
   */
  async getIncident(incidentNumber: string): Promise<ServiceNowIncident | null> {
    const perf = new PerformanceLogger(logger, 'ServiceNow get incident');

    try {
      const response = await this.fetch('/api/now/table/incident', {
        method: 'GET',
        params: {
          sysparm_query: `number=${incidentNumber}`,
          sysparm_limit: '1',
        },
      });

      if (!response.ok) {
        throw this.handleError(response, 'Failed to get incident');
      }

      const data: ServiceNowListResponse<ServiceNowIncident> = await response.json();
      const incident = data.result[0] || null;

      perf.end({ incidentNumber, found: !!incident });
      return incident;
    } catch (error) {
      perf.endWithError(error as Error, { incidentNumber });

      if (error instanceof ServiceNowError) {
        throw error;
      }

      throw new ServiceNowError(
        ErrorCode.SERVICENOW_API_ERROR,
        'Failed to get incident',
        undefined,
        { incidentNumber },
        error as Error
      );
    }
  }

  /**
   * Query incidents with filters
   */
  async queryIncidents(options: ServiceNowQueryOptions = {}): Promise<ServiceNowIncident[]> {
    const perf = new PerformanceLogger(logger, 'ServiceNow query incidents');

    try {
      const response = await this.fetch('/api/now/table/incident', {
        method: 'GET',
        params: {
          sysparm_limit: String(options.sysparm_limit ?? 100),
          ...options,
        },
      });

      if (!response.ok) {
        throw this.handleError(response, 'Failed to query incidents');
      }

      const data: ServiceNowListResponse<ServiceNowIncident> = await response.json();

      perf.end({ count: data.result.length });
      return data.result;
    } catch (error) {
      perf.endWithError(error as Error, { options });

      if (error instanceof ServiceNowError) {
        throw error;
      }

      throw new ServiceNowError(
        ErrorCode.SERVICENOW_API_ERROR,
        'Failed to query incidents',
        undefined,
        { options },
        error as Error
      );
    }
  }

  /**
   * Create a new incident
   */
  async createIncident(
    incident: Partial<Omit<ServiceNowIncident, 'sys_id' | 'number'>>
  ): Promise<ServiceNowIncident> {
    const perf = new PerformanceLogger(logger, 'ServiceNow create incident');

    try {
      const response = await this.fetch('/api/now/table/incident', {
        method: 'POST',
        body: JSON.stringify(incident),
      });

      if (!response.ok) {
        throw this.handleError(response, 'Failed to create incident');
      }

      const data: ServiceNowSingleResponse<ServiceNowIncident> = await response.json();

      perf.end({ incidentNumber: data.result.number });
      return data.result;
    } catch (error) {
      perf.endWithError(error as Error);

      if (error instanceof ServiceNowError) {
        throw error;
      }

      throw new ServiceNowError(
        ErrorCode.SERVICENOW_API_ERROR,
        'Failed to create incident',
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Update an existing incident
   */
  async updateIncident(
    sysId: string,
    updates: Partial<ServiceNowIncident>
  ): Promise<ServiceNowIncident> {
    const perf = new PerformanceLogger(logger, 'ServiceNow update incident');

    try {
      const response = await this.fetch(`/api/now/table/incident/${sysId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw this.handleError(response, 'Failed to update incident');
      }

      const data: ServiceNowSingleResponse<ServiceNowIncident> = await response.json();

      perf.end({ sysId, incidentNumber: data.result.number });
      return data.result;
    } catch (error) {
      perf.endWithError(error as Error, { sysId });

      if (error instanceof ServiceNowError) {
        throw error;
      }

      throw new ServiceNowError(
        ErrorCode.SERVICENOW_API_ERROR,
        'Failed to update incident',
        undefined,
        { sysId },
        error as Error
      );
    }
  }

  /**
   * Generic table query method
   */
  async query<T>(
    table: string,
    options: ServiceNowQueryOptions = {}
  ): Promise<T[]> {
    const perf = new PerformanceLogger(logger, `ServiceNow query ${table}`);

    try {
      const response = await this.fetch(`/api/now/table/${table}`, {
        method: 'GET',
        params: options,
      });

      if (!response.ok) {
        throw this.handleError(response, `Failed to query ${table}`);
      }

      const data: ServiceNowListResponse<T> = await response.json();

      perf.end({ table, count: data.result.length });
      return data.result;
    } catch (error) {
      perf.endWithError(error as Error, { table, options });

      if (error instanceof ServiceNowError) {
        throw error;
      }

      throw new ServiceNowError(
        ErrorCode.SERVICENOW_API_ERROR,
        `Failed to query ${table}`,
        undefined,
        { table, options },
        error as Error
      );
    }
  }

  /**
   * Internal fetch wrapper with auth and timeout
   */
  private async fetch(
    path: string,
    options: {
      method: string;
      params?: Record<string, string>;
      body?: string;
    }
  ): Promise<Response> {
    const url = new URL(`${this.config.instanceUrl}${path}`);

    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: options.method,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new ServiceNowError(
          ErrorCode.SERVICENOW_TIMEOUT,
          `Request timed out after ${this.config.timeout}ms`,
          undefined,
          { url: url.toString(), timeout: this.config.timeout }
        );
      }

      throw error;
    }
  }

  /**
   * Handle HTTP error responses
   */
  private handleError(response: Response, message: string): ServiceNowError {
    if (response.status === 401) {
      return new ServiceNowError(
        ErrorCode.SERVICENOW_AUTH_FAILED,
        'Authentication failed. Check your credentials.',
        response.status
      );
    }

    if (response.status === 403) {
      return new ServiceNowError(
        ErrorCode.SERVICENOW_AUTH_FAILED,
        'Access denied. Check your permissions.',
        response.status
      );
    }

    if (response.status >= 500) {
      return new ServiceNowError(
        ErrorCode.SERVICENOW_API_ERROR,
        `ServiceNow server error: ${response.statusText}`,
        response.status
      );
    }

    return new ServiceNowError(
      ErrorCode.SERVICENOW_API_ERROR,
      `${message}: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  /**
   * Update client configuration (except credentials for security)
   */
  updateConfig(config: { instanceUrl?: string; timeout?: number }): void {
    if (config.instanceUrl) {
      this.config.instanceUrl = config.instanceUrl.replace(/\/$/, '');
    }
    if (config.timeout !== undefined) {
      this.config.timeout = config.timeout;
    }

    logger.info('ServiceNow client config updated', {
      instanceUrl: this.config.instanceUrl,
      timeout: this.config.timeout,
    });
  }

  /**
   * Get current configuration (without password)
   */
  getConfig(): Omit<ServiceNowConfig, 'password'> {
    return {
      instanceUrl: this.config.instanceUrl,
      username: this.config.username,
      timeout: this.config.timeout,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ServiceNow client instance
 */
export function createServiceNowClient(config: ServiceNowConfig): ServiceNowClient {
  return new ServiceNowClient(config);
}

// Export singleton instance (can be reconfigured)
export let servicenowClient: ServiceNowClient | null = null;

/**
 * Initialize the global ServiceNow client
 */
export function initializeServiceNowClient(config: ServiceNowConfig): ServiceNowClient {
  servicenowClient = new ServiceNowClient(config);
  return servicenowClient;
}

/**
 * Get the global ServiceNow client
 */
export function getServiceNowClient(): ServiceNowClient {
  if (!servicenowClient) {
    throw new ServiceNowError(
      ErrorCode.SERVICENOW_CONNECTION_FAILED,
      'ServiceNow client not initialized. Call initializeServiceNowClient() first.'
    );
  }
  return servicenowClient;
}
