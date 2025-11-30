import { writable, derived } from 'svelte/store';
import type { Notification, NotificationCounts } from '../services/notificationService';
import NotificationService from '../services/notificationService';
import { browser } from '$app/environment';

interface NotificationState {
  notifications: Notification[];
  counts: NotificationCounts | null;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
}

const initialState: NotificationState = {
  notifications: [],
  counts: null,
  loading: false,
  error: null,
  lastFetch: null
};

function createNotificationStore() {
  const { subscribe, set, update } = writable<NotificationState>(initialState);

  return {
    subscribe,

    async loadNotifications(options: {
      unreadOnly?: boolean;
      category?: string;
      priority?: string;
      limit?: number;
      force?: boolean;
    } = {}) {
      if (!browser) return;

      // Check if we need to fetch (avoid too frequent requests)
      const currentState = get(this);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (!options.force && currentState.lastFetch && (now - currentState.lastFetch) < fiveMinutes) {
        return;
      }

      update(state => ({ ...state, loading: true, error: null }));

      try {
        const notifications = await NotificationService.getNotifications(options);
        
        update(state => ({
          ...state,
          notifications,
          loading: false,
          lastFetch: now
        }));
      } catch (error: any) {
        console.error('Failed to load notifications:', error);
        update(state => ({
          ...state,
          loading: false,
          error: error.message || 'Failed to load notifications'
        }));
      }
    },

    async loadCounts(force = false) {
      if (!browser) return;

      const currentState = get(this);
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      
      if (!force && currentState.counts && currentState.lastFetch && (now - currentState.lastFetch) < twoMinutes) {
        return;
      }

      try {
        const counts = await NotificationService.getNotificationCounts();
        
        update(state => ({
          ...state,
          counts,
          lastFetch: now
        }));
      } catch (error: any) {
        console.error('Failed to load notification counts:', error);
        update(state => ({
          ...state,
          error: error.message || 'Failed to load notification counts'
        }));
      }
    },

    async markAsRead(notificationId: string) {
      if (!browser) return;

      try {
        await NotificationService.markAsRead(notificationId);
        
        update(state => ({
          ...state,
          notifications: state.notifications.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true, readAt: new Date().toISOString() }
              : notification
          )
        }));

        // Reload counts to reflect the change
        await this.loadCounts(true);
      } catch (error: any) {
        console.error('Failed to mark notification as read:', error);
        update(state => ({
          ...state,
          error: error.message || 'Failed to mark notification as read'
        }));
      }
    },

    async markAllAsRead(category?: string) {
      if (!browser) return;

      try {
        const result = await NotificationService.markAllAsRead(category);
        
        update(state => ({
          ...state,
          notifications: state.notifications.map(notification =>
            (!category || notification.category === category)
              ? { ...notification, read: true, readAt: new Date().toISOString() }
              : notification
          )
        }));

        // Reload counts to reflect the change
        await this.loadCounts(true);
        
        return result.count;
      } catch (error: any) {
        console.error('Failed to mark all notifications as read:', error);
        update(state => ({
          ...state,
          error: error.message || 'Failed to mark all notifications as read'
        }));
        return 0;
      }
    },

    async refresh() {
      await Promise.all([
        this.loadNotifications({ force: true }),
        this.loadCounts(true)
      ]);
    },

    addNotification(notification: Notification) {
      update(state => ({
        ...state,
        notifications: [notification, ...state.notifications]
      }));
    },

    removeNotification(notificationId: string) {
      update(state => ({
        ...state,
        notifications: state.notifications.filter(n => n.id !== notificationId)
      }));
    },

    clearError() {
      update(state => ({ ...state, error: null }));
    },

    reset() {
      set(initialState);
    }
  };
}

// Helper function to get current state
function get(store: any) {
  let value: any;
  store.subscribe((v: any) => value = v)();
  return value;
}

export const notificationStore = createNotificationStore();

// Derived stores for specific notification types
export const unreadNotifications = derived(
  notificationStore,
  $notifications => $notifications.notifications.filter(n => !n.read)
);

export const unreadCount = derived(
  notificationStore,
  $notifications => $notifications.counts?.unread || 0
);

export const urgentNotifications = derived(
  notificationStore,
  $notifications => $notifications.notifications.filter(n => !n.read && n.priority === 'urgent')
);

export const notificationsByCategory = derived(
  notificationStore,
  $notifications => {
    const groups: Record<string, Notification[]> = {};
    $notifications.notifications.forEach(notification => {
      const category = notification.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(notification);
    });
    return groups;
  }
);

// Auto-refresh notifications periodically
if (browser) {
  setInterval(() => {
    notificationStore.loadCounts();
  }, 2 * 60 * 1000); // Every 2 minutes

  setInterval(() => {
    notificationStore.loadNotifications();
  }, 5 * 60 * 1000); // Every 5 minutes
}