import { writable } from 'svelte/store';
import type { AuthState, User } from '$types';
import { api } from '../utils/api';
import { browser } from '$app/environment';

const initialState: AuthState = {
	isAuthenticated: false,
	user: null,
	accessToken: null,
	refreshToken: null
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	return {
		subscribe,
		
		initialize() {
			if (!browser) return;
			
			const accessToken = localStorage.getItem('accessToken');
			const refreshToken = localStorage.getItem('refreshToken');
			const user = localStorage.getItem('user');
			
			if (accessToken && refreshToken && user) {
				try {
					const parsedUser = JSON.parse(user);
					set({
						isAuthenticated: true,
						user: parsedUser,
						accessToken,
						refreshToken
					});
					
					// Set API token
					api.setAuthToken(accessToken);
				} catch (error) {
					console.error('Failed to parse stored user data:', error);
					this.logout();
				}
			}
		},

		async login(username: string, password: string) {
			try {
				const response = await api.post('/auth/login', {
					username,
					password
				});

				const { accessToken, refreshToken, user } = response;

				if (browser) {
					localStorage.setItem('accessToken', accessToken);
					localStorage.setItem('refreshToken', refreshToken);
					localStorage.setItem('user', JSON.stringify(user));
				}

				api.setAuthToken(accessToken);

				set({
					isAuthenticated: true,
					user,
					accessToken,
					refreshToken
				});

				// Load user profile from IPFS after successful login
				try {
					const { userProfileStore } = await import('./userProfile');
					await userProfileStore.loadCurrentUserProfile();
				} catch (profileError) {
					console.warn('Failed to load user profile after login:', profileError);
					// Don't fail login if profile loading fails
				}

				return { success: true };
			} catch (error: any) {
				console.error('Login failed:', error);
				return { 
					success: false, 
					error: error.message || 'Login failed' 
				};
			}
		},

		async loginWithDID(did: string, signature: string, challenge: string) {
			try {
				const response = await api.post('/auth/login-did', {
					did,
					signature,
					challenge
				});

				const { accessToken, refreshToken, user } = response;

				if (browser) {
					localStorage.setItem('accessToken', accessToken);
					localStorage.setItem('refreshToken', refreshToken);
					localStorage.setItem('user', JSON.stringify(user));
				}

				api.setAuthToken(accessToken);

				set({
					isAuthenticated: true,
					user,
					accessToken,
					refreshToken
				});

				return { success: true };
			} catch (error: any) {
				console.error('DID login failed:', error);
				return { 
					success: false, 
					error: error.message || 'Login failed' 
				};
			}
		},

		async signup(username: string, password: string, profile: { role: 'patient' | 'doctor'; email?: string; [key: string]: any }) {
			try {
				const response = await api.post('/auth/signup', {
					username,
					password,
					profile
				});

				return { success: true, user: response.user };
			} catch (error: any) {
				console.error('Signup failed:', error);
				return { 
					success: false, 
					error: error.message || 'Signup failed' 
				};
			}
		},

		async refreshToken() {
			const currentState = get(this);
			if (!currentState.refreshToken) {
				this.logout();
				return false;
			}

			try {
				const response = await api.post('/auth/refresh', {
					refreshToken: currentState.refreshToken
				});

				const { accessToken, refreshToken } = response;

				if (browser) {
					localStorage.setItem('accessToken', accessToken);
					localStorage.setItem('refreshToken', refreshToken);
				}

				api.setAuthToken(accessToken);

				update(state => ({
					...state,
					accessToken,
					refreshToken
				}));

				return true;
			} catch (error) {
				console.error('Token refresh failed:', error);
				this.logout();
				return false;
			}
		},

		async logout() {
			const currentState = get(this);
			
			if (currentState.refreshToken) {
				try {
					await api.post('/auth/logout', {
						refreshToken: currentState.refreshToken
					});
				} catch (error) {
					console.error('Logout API call failed:', error);
				}
			}

			if (browser) {
				localStorage.removeItem('accessToken');
				localStorage.removeItem('refreshToken');
				localStorage.removeItem('user');
			}

			api.clearAuthToken();
			set(initialState);

			// Clear user profile store on logout
			try {
				const { userProfileStore } = await import('./userProfile');
				userProfileStore.clearProfile();
			} catch (error) {
				console.warn('Failed to clear user profile on logout:', error);
			}
		},

		updateUser(user: User) {
			if (browser) {
				localStorage.setItem('user', JSON.stringify(user));
			}

			update(state => ({
				...state,
				user
			}));
		},

		async refreshUserData() {
			const currentState = get(this);
			if (!currentState.isAuthenticated || !currentState.user) {
				return false;
			}

			try {
				const response = await api.get('/users/profile');
				const updatedUser = response.user;

				this.updateUser(updatedUser);
				return true;
			} catch (error) {
				console.error('Failed to refresh user data:', error);
				return false;
			}
		}
	};
}

// Helper function to get current state
function get(store: any) {
	let value: any;
	store.subscribe((v: any) => value = v)();
	return value;
}

export const authStore = createAuthStore();
