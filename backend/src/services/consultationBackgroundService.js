/**
 * Consultation Background Service
 * Handles background tasks for consultation system like auto-assignment and cleanup
 */
export class ConsultationBackgroundService {
  constructor(doctorAvailabilityService, consultationRequestService, logger) {
    this.doctorAvailabilityService = doctorAvailabilityService;
    this.consultationRequestService = consultationRequestService;
    this.logger = logger;
    
    this.autoAssignInterval = null;
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  /**
   * Start background services
   * @param {Object} config - Configuration options
   * @param {number} config.autoAssignIntervalMs - Auto-assignment interval in milliseconds
   * @param {number} config.cleanupIntervalMs - Cleanup interval in milliseconds
   */
  start(config = {}) {
    if (this.isRunning) {
      this.logger.warn('Background service is already running');
      return;
    }

    const {
      autoAssignIntervalMs = 30000, // 30 seconds
      cleanupIntervalMs = 300000    // 5 minutes
    } = config;

    this.isRunning = true;

    // Auto-assign pending requests
    this.autoAssignInterval = setInterval(async () => {
      try {
        const assignedCount = await this.consultationRequestService.autoAssignPendingRequests();
        if (assignedCount > 0) {
          this.logger.info(`Background auto-assignment completed`, { assignedCount });
        }
      } catch (error) {
        this.logger.error('Background auto-assignment failed:', error);
      }
    }, autoAssignIntervalMs);

    // Cleanup stale availability records
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleanedCount = await this.doctorAvailabilityService.cleanupStaleAvailability(10);
        if (cleanedCount > 0) {
          this.logger.info(`Background cleanup completed`, { cleanedCount });
        }
      } catch (error) {
        this.logger.error('Background cleanup failed:', error);
      }
    }, cleanupIntervalMs);

    this.logger.info('Consultation background service started', {
      autoAssignIntervalMs,
      cleanupIntervalMs
    });
  }

  /**
   * Stop background services
   */
  stop() {
    if (!this.isRunning) {
      this.logger.warn('Background service is not running');
      return;
    }

    if (this.autoAssignInterval) {
      clearInterval(this.autoAssignInterval);
      this.autoAssignInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isRunning = false;
    this.logger.info('Consultation background service stopped');
  }

  /**
   * Get service status
   * @returns {Object} - Service status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      autoAssignInterval: this.autoAssignInterval !== null,
      cleanupInterval: this.cleanupInterval !== null
    };
  }
}

export default ConsultationBackgroundService;