import { writable, derived } from 'svelte/store';
import type { UserProfile } from '../services/userProfileService';
import { userProfileService } from '../services/userProfileService';
import { authStore } from './auth';
import type { User } from '$types';

interface UserProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: UserProfileState = {
  profile: null,
  loading: false,
  error: null,
  lastUpdated: null
};

function createUserProfileStore() {
  const { subscribe, set, update } = writable<UserProfileState>(initialState);

  return {
    subscribe,

    async loadCurrentUserProfile() {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const profile = await userProfileService.getCurrentUserProfile();
        
        update(state => ({
          ...state,
          profile,
          loading: false,
          error: null,
          lastUpdated: Date.now()
        }));

        return profile;
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to load profile';
        
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage,
          lastUpdated: Date.now()
        }));

        throw error;
      }
    },

    async loadUserProfile(username: string) {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const profile = await userProfileService.getUserProfile(username);
        
        update(state => ({
          ...state,
          profile,
          loading: false,
          error: null,
          lastUpdated: Date.now()
        }));

        return profile;
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to load profile';
        
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage,
          lastUpdated: Date.now()
        }));

        throw error;
      }
    },

    clearProfile() {
      set(initialState);
    },

    clearError() {
      update(state => ({ ...state, error: null }));
    },

    // Helper method to refresh profile if it's stale
    async refreshIfStale(maxAge = 5 * 60 * 1000) { // 5 minutes default
      const currentState = get(this);
      
      if (!currentState.lastUpdated || 
          Date.now() - currentState.lastUpdated > maxAge) {
        await this.loadCurrentUserProfile();
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

export const userProfileStore = createUserProfileStore();

// Derived store for display information
export const userDisplayInfo = derived(
  [authStore, userProfileStore],
  ([$authStore, $userProfileStore]) => {
    const user = $authStore.user;
    const profile = $userProfileStore.profile;

    if (!user) {
      return {
        displayName: 'User',
        initials: 'U',
        email: '',
        role: 'patient',
        verified: false,
        loading: false
      };
    }

    // If we have IPFS profile data, use it
    if (profile?.profileData) {
      const displayName = userProfileService.getDisplayName(profile);
      const initials = userProfileService.getUserInitials(profile);
      
      return {
        displayName,
        initials,
        email: profile.email || user.email || '',
        role: profile.role,
        verified: profile.verified,
        loading: $userProfileStore.loading,
        bio: profile.profileData.bio,
        specializations: profile.profileData.specializations,
        experience: profile.profileData.experience
      };
    }

    // Fallback to basic auth store data
    return {
      displayName: user.username,
      initials: user.username.charAt(0).toUpperCase(),
      email: user.email || '',
      role: user.role,
      verified: user.verified,
      loading: $userProfileStore.loading
    };
  }
);