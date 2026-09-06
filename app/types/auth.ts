export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: number;
  updatedAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}
