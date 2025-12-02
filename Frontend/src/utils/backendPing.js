// Utility for backend ping functionality
import { env } from '$env/dynamic/public';

class BackendPingService {
    constructor() {
        this.baseUrl = env.PUBLIC_API_URL || 'http://localhost:3001';
        this.pingInterval = null;
        this.isOnline = navigator.onLine;
        this.setupNetworkListeners();
    }

    setupNetworkListeners() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.isOnline = true;
                console.log('🌐 Network: Back online - resuming backend pings');
                this.startPinging();
            });

            window.addEventListener('offline', () => {
                this.isOnline = false;
                console.log('🌐 Network: Offline - stopping backend pings');
                this.stopPinging();
            });

            // Ping when page becomes visible (user returns to tab)
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.isOnline) {
                    this.ping();
                }
            });
        }
    }

    async ping() {
        if (!this.isOnline) {
            console.log('🏓 Skipping ping - offline');
            return false;
        }

        try {
            const startTime = Date.now();
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Add timeout to prevent hanging requests
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            const responseTime = Date.now() - startTime;
            
            if (response.ok) {
                const data = await response.json();
                console.log(`🏓 Backend ping successful (${responseTime}ms)`, {
                    status: data.status,
                    uptime: Math.round(data.uptime / 60) + 'm',
                    environment: data.environment
                });
                return true;
            } else {
                console.warn(`🏓 Backend ping failed with status: ${response.status}`);
                return false;
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.warn('🏓 Backend ping timeout (>10s)');
            } else if (error.name === 'AbortError') {
                console.warn('🏓 Backend ping aborted');
            } else {
                console.warn('🏓 Backend ping error:', error.message);
            }
            return false;
        }
    }

    startPinging() {
        if (this.pingInterval) {
            return; // Already pinging
        }

        // Ping immediately
        this.ping();
        
        // Set up periodic pings every 10 minutes
        this.pingInterval = setInterval(() => {
            this.ping();
        }, 10 * 60 * 1000); // 10 minutes

        console.log('🏓 Backend ping service started (10min intervals)');
    }

    stopPinging() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            console.log('🏓 Backend ping service stopped');
        }
    }

    // Method to manually trigger a ping (useful for testing)
    async testConnection() {
        console.log('🧪 Testing backend connection...');
        const success = await this.ping();
        return success;
    }
}

// Create singleton instance
export const backendPing = new BackendPingService();

// Auto-start pinging when module loads
if (typeof window !== 'undefined') {
    backendPing.startPinging();
}