import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { ConfigurationProfile } from '../../core/storage/schema';
import type { NowAssistTool } from '../../core/services/now-assist-mcp-client';
import type { ProviderId, ProviderStatus } from '../../core/services/credential-provider';

/**
 * Global application state using Zustand
 * Provides reactive state management across components
 */

// ============================================================================
// State Types
// ============================================================================

export interface AppState {
  // Configuration
  activeProfile: ConfigurationProfile | null;
  profiles: ConfigurationProfile[];

  // UI State
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';

  // Connection Status
  ollamaConnected: boolean;
  servicenowConnected: boolean;
  lastHealthCheck: Date | null;

  // Session State
  currentSessionId: string | null;
  isTyping: boolean;

  // Loading States
  loading: {
    profiles: boolean;
    credentials: boolean;
    session: boolean;
  };

  // Error State
  lastError: {
    message: string;
    code?: string;
    timestamp: Date;
  } | null;

  // Now Assist MCP Connection State (T008 — 002-security-nowassist-docs)
  nowAssistConnected: boolean;
  nowAssistTools: NowAssistTool[];
  nowAssistError: string | null;

  // Credential Provider Config (T012 — multi-vault)
  providerConfig: {
    defaultProvider: ProviderId;
    overrides: Record<string, ProviderId>;
    providerStatuses: ProviderStatus[];
  };
}

export interface AppActions {
  // Configuration Actions
  setActiveProfile: (profile: ConfigurationProfile | null) => void;
  setProfiles: (profiles: ConfigurationProfile[]) => void;
  addProfile: (profile: ConfigurationProfile) => void;
  updateProfile: (id: string, updates: Partial<ConfigurationProfile>) => void;
  removeProfile: (id: string) => void;

  // UI Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Connection Actions
  setOllamaConnected: (connected: boolean) => void;
  setServiceNowConnected: (connected: boolean) => void;
  updateHealthCheck: () => void;

  // Session Actions
  setCurrentSessionId: (sessionId: string | null) => void;
  setIsTyping: (typing: boolean) => void;

  // Loading Actions
  setLoading: (key: keyof AppState['loading'], loading: boolean) => void;

  // Error Actions
  setError: (message: string, code?: string) => void;
  clearError: () => void;

  // Reset Actions
  reset: () => void;

  // Now Assist Actions
  setNowAssistConnected: (connected: boolean) => void;
  setNowAssistTools: (tools: NowAssistTool[]) => void;
  setNowAssistError: (error: string | null) => void;

  // Provider Config Actions (T012 — multi-vault)
  setDefaultProvider: (id: ProviderId) => void;
  setOverride: (key: string, id: ProviderId) => void;
  removeOverride: (key: string) => void;
  setProviderStatuses: (statuses: ProviderStatus[]) => void;
}

export type AppStore = AppState & AppActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: AppState = {
  // Configuration
  activeProfile: null,
  profiles: [],

  // UI State
  sidebarOpen: true,
  theme: 'system',

  // Connection Status
  ollamaConnected: false,
  servicenowConnected: false,
  lastHealthCheck: null,

  // Session State
  currentSessionId: null,
  isTyping: false,

  // Loading States
  loading: {
    profiles: false,
    credentials: false,
    session: false,
  },

  // Error State
  lastError: null,

  // Now Assist MCP Connection State
  nowAssistConnected: false,
  nowAssistTools: [],
  nowAssistError: null,

  // Credential Provider Config
  providerConfig: {
    defaultProvider: 'keychain' as ProviderId,
    overrides: {} as Record<string, ProviderId>,
    providerStatuses: [] as ProviderStatus[],
  },
};

// ============================================================================
// Store Definition
// ============================================================================

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, _get) => ({
        ...initialState,

        // Configuration Actions
        setActiveProfile: (profile) => set({ activeProfile: profile }),

        setProfiles: (profiles) => set({ profiles }),

        addProfile: (profile) =>
          set((state) => ({
            profiles: [...state.profiles, profile],
          })),

        updateProfile: (id, updates) =>
          set((state) => ({
            profiles: state.profiles.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
            activeProfile:
              state.activeProfile?.id === id
                ? { ...state.activeProfile, ...updates }
                : state.activeProfile,
          })),

        removeProfile: (id) =>
          set((state) => ({
            profiles: state.profiles.filter((p) => p.id !== id),
            activeProfile:
              state.activeProfile?.id === id ? null : state.activeProfile,
          })),

        // UI Actions
        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        setTheme: (theme) => set({ theme }),

        // Connection Actions
        setOllamaConnected: (connected) =>
          set({ ollamaConnected: connected }),

        setServiceNowConnected: (connected) =>
          set({ servicenowConnected: connected }),

        updateHealthCheck: () => set({ lastHealthCheck: new Date() }),

        // Session Actions
        setCurrentSessionId: (sessionId) =>
          set({ currentSessionId: sessionId }),

        setIsTyping: (typing) => set({ isTyping: typing }),

        // Loading Actions
        setLoading: (key, loading) =>
          set((state) => ({
            loading: { ...state.loading, [key]: loading },
          })),

        // Error Actions
        setError: (message, code) =>
          set({
            lastError: {
              message,
              code,
              timestamp: new Date(),
            },
          }),

        clearError: () => set({ lastError: null }),

        // Reset Actions
        reset: () => set(initialState),

        // Now Assist Actions
        setNowAssistConnected: (connected) => set({ nowAssistConnected: connected }),
        setNowAssistTools: (tools) => set({ nowAssistTools: tools }),
        setNowAssistError: (error) => set({ nowAssistError: error }),

        // Provider Config Actions (T012 — multi-vault)
        setDefaultProvider: (id) =>
          set((state) => ({
            providerConfig: { ...state.providerConfig, defaultProvider: id },
          })),

        setOverride: (key, id) =>
          set((state) => ({
            providerConfig: {
              ...state.providerConfig,
              overrides: { ...state.providerConfig.overrides, [key]: id },
            },
          })),

        removeOverride: (key) =>
          set((state) => {
            const { [key]: _removed, ...rest } = state.providerConfig.overrides;
            return {
              providerConfig: { ...state.providerConfig, overrides: rest },
            };
          }),

        setProviderStatuses: (statuses) =>
          set((state) => ({
            providerConfig: { ...state.providerConfig, providerStatuses: statuses },
          })),
      }),
      {
        name: 'servicenow-mcp-bridge-storage',
        // Only persist certain keys
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
        }),
      }
    ),
    { name: 'AppStore' }
  )
);

// ============================================================================
// Selectors (for optimized component re-renders)
// ============================================================================

// Now Assist selectors
export const useNowAssistConnected = () => useAppStore((state) => state.nowAssistConnected);
export const useNowAssistTools = () => useAppStore((state) => state.nowAssistTools);
export const useNowAssistError = () => useAppStore((state) => state.nowAssistError);

// Provider Config selectors (T012 — multi-vault)
// useShallow prevents infinite re-render from new object reference on every call
export const useProviderConfig = () =>
  useAppStore(useShallow((state) => state.providerConfig));
export const useProviderStatuses = () =>
  useAppStore((state) => state.providerConfig.providerStatuses);
export const useDefaultProvider = () =>
  useAppStore((state) => state.providerConfig.defaultProvider);

export const useActiveProfile = () => useAppStore((state) => state.activeProfile);
export const useProfiles = () => useAppStore((state) => state.profiles);
export const useSidebarOpen = () => useAppStore((state) => state.sidebarOpen);
export const useTheme = () => useAppStore((state) => state.theme);
export const useOllamaConnected = () => useAppStore((state) => state.ollamaConnected);
export const useServiceNowConnected = () => useAppStore((state) => state.servicenowConnected);
export const useCurrentSessionId = () => useAppStore((state) => state.currentSessionId);
export const useIsTyping = () => useAppStore((state) => state.isTyping);
export const useLoading = () => useAppStore((state) => state.loading);
export const useLastError = () => useAppStore((state) => state.lastError);

// ============================================================================
// Computed Selectors
// ============================================================================

/**
 * Check if both Ollama and ServiceNow are connected
 */
export const useFullyConnected = () =>
  useAppStore(
    (state) => state.ollamaConnected && state.servicenowConnected
  );

/**
 * Check if any loading is in progress
 */
export const useIsLoading = () =>
  useAppStore((state) =>
    Object.values(state.loading).some((loading) => loading)
  );

/**
 * Get connection status summary
 * useShallow prevents infinite re-render from new object reference on every call
 */
export const useConnectionStatus = () =>
  useAppStore(useShallow((state) => ({
    ollama: state.ollamaConnected,
    servicenow: state.servicenowConnected,
    lastCheck: state.lastHealthCheck,
    fullyConnected: state.ollamaConnected && state.servicenowConnected,
  })));

// ============================================================================
// Actions (for use outside React components)
// ============================================================================

export const appActions = {
  setActiveProfile: (profile: ConfigurationProfile | null) =>
    useAppStore.getState().setActiveProfile(profile),

  setProfiles: (profiles: ConfigurationProfile[]) =>
    useAppStore.getState().setProfiles(profiles),

  addProfile: (profile: ConfigurationProfile) =>
    useAppStore.getState().addProfile(profile),

  updateProfile: (id: string, updates: Partial<ConfigurationProfile>) =>
    useAppStore.getState().updateProfile(id, updates),

  removeProfile: (id: string) =>
    useAppStore.getState().removeProfile(id),

  setError: (message: string, code?: string) =>
    useAppStore.getState().setError(message, code),

  clearError: () =>
    useAppStore.getState().clearError(),

  setLoading: (key: keyof AppState['loading'], loading: boolean) =>
    useAppStore.getState().setLoading(key, loading),

  setOllamaConnected: (connected: boolean) =>
    useAppStore.getState().setOllamaConnected(connected),

  setServiceNowConnected: (connected: boolean) =>
    useAppStore.getState().setServiceNowConnected(connected),

  updateHealthCheck: () =>
    useAppStore.getState().updateHealthCheck(),

  setNowAssistConnected: (connected: boolean) =>
    useAppStore.getState().setNowAssistConnected(connected),

  setNowAssistTools: (tools: NowAssistTool[]) =>
    useAppStore.getState().setNowAssistTools(tools),

  setNowAssistError: (error: string | null) =>
    useAppStore.getState().setNowAssistError(error),

  setDefaultProvider: (id: ProviderId) =>
    useAppStore.getState().setDefaultProvider(id),

  setOverride: (key: string, id: ProviderId) =>
    useAppStore.getState().setOverride(key, id),

  removeOverride: (key: string) =>
    useAppStore.getState().removeOverride(key),

  setProviderStatuses: (statuses: ProviderStatus[]) =>
    useAppStore.getState().setProviderStatuses(statuses),
};

export default useAppStore;
