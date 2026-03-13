// ==========================================
// Cobble Quest Backend - Type Definitions
// ==========================================

// ---- Store ----
export type StoreCategory = 'keys' | 'breeding' | 'battlepass' | 'extras';

export interface StoreItem {
  id: string;
  name: string;
  image: string;
  price: number;
  category: StoreCategory;
  description: string;
  discount?: number;
  /** Server commands to execute on purchase. Use {username} placeholder. */
  commands: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreItemDTO {
  name: string;
  image: string;
  price: number;
  category: StoreCategory;
  description: string;
  discount?: number;
  commands?: string[];
  active?: boolean;
}

export interface UpdateStoreItemDTO extends Partial<CreateStoreItemDTO> {}

// ---- Events ----
export type EventTag = 'pvp' | 'capture' | 'exploration' | 'tournament' | 'seasonal' | 'special';

export interface ServerEvent {
  id: string;
  title: string;
  description: string;
  image: string;
  startDate: string;
  endDate: string;
  tags: EventTag[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventDTO {
  title: string;
  description: string;
  image: string;
  startDate: string;
  endDate: string;
  tags: EventTag[];
  active?: boolean;
}

export interface UpdateEventDTO extends Partial<CreateEventDTO> {}

// ---- Auth ----
export interface LoginDTO {
  username: string;
  password: string;
}

export interface AuthPayload {
  id: string;
  username: string;
  role: 'admin';
}

// ---- Whitelist ----
export interface WhitelistCheckResponse {
  whitelisted: boolean;
  username: string;
  uuid: string | null;
}

// ---- API Responses ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
