import { api } from '../utils/api';

export interface UserProfile {
  id: string;
  username: string;
  role: 'patient' | 'doctor';
  verified: boolean;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
  profileData?: {
    personalInfo?: {
      fullName?: string;
      dateOfBirth?: string;
      location?: string;
      bio?: string;
    };
    medicalInfo?: {
      allergies?: string[];
      medications?: string[];
      conditions?: string[];
      emergencyContact?: object;
    };
    professionalInfo?: {
      licenseNumber?: string;
      specialties?: string[];
      experience?: number;
      education?: object[];
      certifications?: object[];
    };
    bio?: string;
    specializations?: string[];
    experience?: number;
    languages?: string[];
    availability?: object;
  };
}

export class UserProfileService {
  private profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get complete user profile from IPFS
   */
  async getUserProfile(username: string, useCache = true): Promise<UserProfile> {
    try {
      // Check cache first
      if (useCache && this.profileCache.has(username)) {
        const cached = this.profileCache.get(username)!;
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.profile;
        } else {
          this.profileCache.delete(username);
        }
      }

      const response = await api.get(`/users/profile/${username}`);
      const profile = response.user as UserProfile;

      // Cache the profile
      this.profileCache.set(username, {
        profile,
        timestamp: Date.now()
      });

      return profile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw new Error('Failed to load user profile');
    }
  }

  /**
   * Get current user's complete profile from IPFS
   */
  async getCurrentUserProfile(useCache = true): Promise<UserProfile> {
    try {
      const response = await api.get('/users/profile');
      const profile = response.user as UserProfile;

      return profile;
    } catch (error) {
      console.error('Failed to fetch current user profile:', error);
      throw new Error('Failed to load user profile');
    }
  }

  /**
   * Get user metadata (lightweight, from Firestore only)
   */
  async getUserMetadata(username: string): Promise<Partial<UserProfile>> {
    try {
      const response = await api.get(`/users/profile/${username}`);
      return response.user as Partial<UserProfile>;
    } catch (error) {
      console.error('Failed to fetch user metadata:', error);
      throw new Error('Failed to load user metadata');
    }
  }

  /**
   * Clear profile cache
   */
  clearCache(username?: string) {
    if (username) {
      this.profileCache.delete(username);
    } else {
      this.profileCache.clear();
    }
  }

  /**
   * Get display name for user
   */
  getDisplayName(profile: UserProfile): string {
    if (profile.profileData?.personalInfo?.fullName) {
      return profile.profileData.personalInfo.fullName;
    }
    return profile.username;
  }

  /**
   * Get user initials for avatar
   */
  getUserInitials(profile: UserProfile): string {
    const displayName = this.getDisplayName(profile);
    const names = displayName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return displayName.charAt(0).toUpperCase();
  }
}

export const userProfileService = new UserProfileService();