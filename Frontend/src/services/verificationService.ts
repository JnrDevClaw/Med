import { api } from '../utils/api';
import type { User } from '$types';

/**
 * Verification Service
 * Handles verification status checks and user guidance
 */
export class VerificationService {
  /**
   * Check if user is verified
   */
  static isVerified(user: User | null): boolean {
    return user?.verified === true;
  }

  /**
   * Check if user is a verified doctor
   */
  static isVerifiedDoctor(user: User | null): boolean {
    return user?.role === 'doctor' && user?.verified === true;
  }

  /**
   * Check if user is an unverified doctor
   */
  static isUnverifiedDoctor(user: User | null): boolean {
    return user?.role === 'doctor' && user?.verified === false;
  }

  /**
   * Get verification status message for user
   */
  static getVerificationStatusMessage(user: User | null): string {
    if (!user) return '';
    
    if (user.role === 'doctor') {
      return user.verified 
        ? 'Your doctor account is verified' 
        : 'Your doctor account requires verification';
    }
    
    return user.verified 
      ? 'Your account is verified' 
      : 'Your account requires verification';
  }

  /**
   * Get verification redirect path for user
   */
  static getVerificationRedirectPath(user: User | null): string {
    if (!user) return '/auth/login';
    
    if (user.role === 'doctor') {
      return '/credentials/upload';
    }
    
    return '/profile/verify';
  }

  /**
   * Get verification requirements for doctors
   */
  static getDoctorVerificationRequirements(): string[] {
    return [
      'Valid medical license',
      'Professional identification',
      'Board certification (recommended)',
      'Residency completion certificate (recommended)'
    ];
  }

  /**
   * Check if user can access doctor-only features
   */
  static canAccessDoctorFeatures(user: User | null): boolean {
    return this.isVerifiedDoctor(user);
  }

  /**
   * Check if user can access verification-required features
   */
  static canAccessVerifiedFeatures(user: User | null): boolean {
    return this.isVerified(user);
  }

  /**
   * Get verification prompt data for unverified users
   */
  static getVerificationPrompt(user: User | null): {
    show: boolean;
    title: string;
    message: string;
    actionText: string;
    actionPath: string;
  } {
    if (!user || user.verified) {
      return {
        show: false,
        title: '',
        message: '',
        actionText: '',
        actionPath: ''
      };
    }

    if (user.role === 'doctor') {
      return {
        show: true,
        title: 'Doctor Verification Required',
        message: 'To access doctor features like consultations and discussions, you need to verify your medical credentials.',
        actionText: 'Upload Credentials',
        actionPath: '/credentials/upload'
      };
    }

    return {
      show: true,
      title: 'Account Verification Required',
      message: 'Some features require account verification. Please complete your profile verification.',
      actionText: 'Verify Account',
      actionPath: '/profile/verify'
    };
  }

  /**
   * Get verification status for display
   */
  static getVerificationStatus(user: User | null): {
    status: 'verified' | 'unverified' | 'pending' | 'unknown';
    label: string;
    color: string;
    icon: string;
  } {
    if (!user) {
      return {
        status: 'unknown',
        label: 'Unknown',
        color: 'gray',
        icon: 'question-mark'
      };
    }

    if (user.verified) {
      return {
        status: 'verified',
        label: user.role === 'doctor' ? 'Verified Doctor' : 'Verified',
        color: 'green',
        icon: 'check-circle'
      };
    }

    return {
      status: 'unverified',
      label: user.role === 'doctor' ? 'Unverified Doctor' : 'Unverified',
      color: 'yellow',
      icon: 'exclamation-triangle'
    };
  }

  /**
   * Handle verification error responses from API
   */
  static handleVerificationError(error: any): {
    isVerificationError: boolean;
    message: string;
    redirectPath?: string;
  } {
    if (error?.error === 'VERIFICATION_REQUIRED') {
      return {
        isVerificationError: true,
        message: error.message || 'Verification required to access this feature',
        redirectPath: error.details?.redirectTo
      };
    }

    return {
      isVerificationError: false,
      message: error?.message || 'An error occurred'
    };
  }

  /**
   * Refresh user verification status from server
   */
  static async refreshVerificationStatus(): Promise<User | null> {
    try {
      const response = await api.get('/users/profile');
      return response.user;
    } catch (error) {
      console.error('Failed to refresh verification status:', error);
      return null;
    }
  }
}

export default VerificationService;