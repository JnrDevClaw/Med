import DoctorAvailabilityService from '../services/doctorAvailabilityService.js';
import ConsultationRequestService from '../services/consultationRequestService.js';

const consultationRoutes = async (fastify, opts) => {
  // Initialize services
  const doctorAvailabilityService = new DoctorAvailabilityService(
    fastify.firestore,
    fastify.log
  );
  
  const consultationRequestService = new ConsultationRequestService(
    fastify.firestore,
    fastify.log,
    doctorAvailabilityService
  );

  // Get available doctors
  fastify.get('/doctors/available', {
    schema: {
      tags: ['consultations'],
      description: 'Get available doctors for consultation',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          specialties: { 
            type: 'array',
            items: { type: 'string' }
          },
          category: { type: 'string' },
          maxLoad: { type: 'number', minimum: 1, maximum: 10 },
          limit: { type: 'number', minimum: 1, maximum: 50 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            doctors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  doctorUsername: { type: 'string' },
                  isOnline: { type: 'boolean' },
                  specialties: { 
                    type: 'array',
                    items: { type: 'string' }
                  },
                  currentLoad: { type: 'number' },
                  lastSeen: { type: 'string' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { specialties, category, maxLoad = 5, limit = 10 } = request.query;
      
      const filters = {
        specialties: specialties || [],
        maxLoad,
        limit
      };

      const availableDoctors = await doctorAvailabilityService.getAvailableDoctors(filters);

      return {
        success: true,
        doctors: availableDoctors,
        total: availableDoctors.length
      };

    } catch (error) {
      fastify.log.error('Failed to get available doctors:', error);
      return reply.code(500).send({
        error: 'AVAILABILITY_ERROR',
        message: 'Failed to retrieve available doctors'
      });
    }
  });

  // Find best matching doctor
  fastify.post('/doctors/find-match', {
    schema: {
      tags: ['consultations'],
      description: 'Find best matching doctor for consultation',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['category'],
        properties: {
          category: { type: 'string' },
          preferredSpecialties: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            doctor: {
              type: 'object',
              properties: {
                doctorUsername: { type: 'string' },
                specialties: {
                  type: 'array',
                  items: { type: 'string' }
                },
                currentLoad: { type: 'number' },
                matchScore: { type: 'number' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { category, preferredSpecialties = [] } = request.body;

      const bestDoctor = await doctorAvailabilityService.findBestMatchingDoctor(
        category,
        preferredSpecialties
      );

      if (!bestDoctor) {
        return reply.code(404).send({
          error: 'NO_DOCTORS_AVAILABLE',
          message: 'No doctors are currently available for this consultation'
        });
      }

      return {
        success: true,
        doctor: bestDoctor
      };

    } catch (error) {
      fastify.log.error('Failed to find matching doctor:', error);
      return reply.code(500).send({
        error: 'MATCHING_ERROR',
        message: 'Failed to find matching doctor'
      });
    }
  });

  // Get consultation requests for user
  fastify.get('/requests', {
    schema: {
      tags: ['consultations'],
      description: 'Get consultation requests for user',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          status: { 
            type: 'string',
            enum: ['pending', 'assigned', 'accepted', 'rejected', 'completed', 'cancelled']
          },
          category: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100 },
          offset: { type: 'number', minimum: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            requests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  patientUsername: { type: 'string' },
                  assignedDoctorUsername: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  urgency: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string' },
                  scheduledAt: { type: 'string' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = request.user;
      const { status, category, limit = 20, offset = 0 } = request.query;

      const filters = { status, category, limit, offset };
      const requests = await consultationRequestService.getConsultationRequests(
        user.username,
        user.role,
        filters
      );

      return {
        success: true,
        requests,
        total: requests.length
      };

    } catch (error) {
      fastify.log.error('Failed to get consultation requests:', error);
      return reply.code(500).send({
        error: 'REQUEST_RETRIEVAL_ERROR',
        message: 'Failed to retrieve consultation requests'
      });
    }
  });

  // Create consultation request
  fastify.post('/requests', {
    schema: {
      tags: ['consultations'],
      description: 'Create new consultation request',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['category', 'description'],
        properties: {
          category: { type: 'string' },
          description: { type: 'string', minLength: 10 },
          preferredSpecialties: {
            type: 'array',
            items: { type: 'string' }
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'emergency']
          },
          preferredDoctorUsername: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            request: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                patientUsername: { type: 'string' },
                assignedDoctorUsername: { type: 'string' },
                category: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = request.user;
      
      // Only patients can create consultation requests
      if (user.role !== 'patient') {
        return reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Only patients can create consultation requests'
        });
      }

      const requestData = request.body;
      const consultationRequest = await consultationRequestService.createConsultationRequest(
        user.username,
        requestData
      );

      return reply.code(201).send({
        success: true,
        request: consultationRequest
      });

    } catch (error) {
      fastify.log.error('Failed to create consultation request:', error);
      return reply.code(500).send({
        error: 'REQUEST_CREATION_ERROR',
        message: error.message || 'Failed to create consultation request'
      });
    }
  });

  // Update consultation request status (for doctors)
  fastify.patch('/requests/:requestId/status', {
    schema: {
      tags: ['consultations'],
      description: 'Update consultation request status',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          requestId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['accepted', 'rejected', 'completed']
          },
          scheduledAt: { type: 'string', format: 'date-time' },
          rejectionReason: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            request: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    try {
      const user = request.user;
      const { requestId } = request.params;
      const { status, scheduledAt, rejectionReason } = request.body;

      const additionalData = {};
      if (scheduledAt) additionalData.scheduledAt = scheduledAt;
      if (rejectionReason) additionalData.rejectionReason = rejectionReason;

      const updatedRequest = await consultationRequestService.updateRequestStatus(
        requestId,
        status,
        user.username,
        additionalData
      );

      return {
        success: true,
        request: updatedRequest
      };

    } catch (error) {
      fastify.log.error('Failed to update request status:', error);
      return reply.code(500).send({
        error: 'STATUS_UPDATE_ERROR',
        message: error.message || 'Failed to update request status'
      });
    }
  });

  // Set doctor availability (for doctors)
  fastify.post('/doctors/availability', {
    schema: {
      tags: ['consultations'],
      description: 'Set doctor availability status',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['isOnline'],
        properties: {
          isOnline: { type: 'boolean' },
          specialties: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    try {
      const user = request.user;
      const { isOnline, specialties = [] } = request.body;

      await doctorAvailabilityService.setDoctorAvailability(
        user.username,
        isOnline,
        specialties
      );

      return {
        success: true,
        message: `Availability status set to ${isOnline ? 'online' : 'offline'}`
      };

    } catch (error) {
      fastify.log.error('Failed to set doctor availability:', error);
      return reply.code(500).send({
        error: 'AVAILABILITY_ERROR',
        message: error.message || 'Failed to set availability status'
      });
    }
  });

  // Get health categories
  fastify.get('/categories', {
    schema: {
      tags: ['consultations'],
      description: 'Get available health categories',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  specialties: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const categories = consultationRequestService.getHealthCategories();

      return {
        success: true,
        categories
      };

    } catch (error) {
      fastify.log.error('Failed to get health categories:', error);
      return reply.code(500).send({
        error: 'CATEGORIES_ERROR',
        message: 'Failed to retrieve health categories'
      });
    }
  });

  // Get suggested specialties for a category
  fastify.get('/categories/:category/specialties', {
    schema: {
      tags: ['consultations'],
      description: 'Get suggested specialties for a health category',
      params: {
        type: 'object',
        properties: {
          category: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            specialties: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { category } = request.params;
      const specialties = consultationRequestService.getSuggestedSpecialties(category);

      if (specialties.length === 0) {
        return reply.code(404).send({
          error: 'CATEGORY_NOT_FOUND',
          message: `Health category '${category}' not found`
        });
      }

      return {
        success: true,
        specialties
      };

    } catch (error) {
      fastify.log.error('Failed to get category specialties:', error);
      return reply.code(500).send({
        error: 'SPECIALTIES_ERROR',
        message: 'Failed to retrieve category specialties'
      });
    }
  });

  // Schedule consultation
  fastify.patch('/requests/:requestId/schedule', {
    schema: {
      tags: ['consultations'],
      description: 'Schedule a consultation',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          requestId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['scheduledAt'],
        properties: {
          scheduledAt: { type: 'string', format: 'date-time' },
          notes: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            request: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                scheduledAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    try {
      const user = request.user;
      const { requestId } = request.params;
      const { scheduledAt, notes } = request.body;

      // Update request with scheduled time
      const updatedRequest = await consultationRequestService.updateRequestStatus(
        requestId,
        'accepted',
        user.username,
        { scheduledAt }
      );

      // Add scheduling note if provided
      if (notes) {
        await consultationRequestService.addRequestNote(
          requestId,
          `Consultation scheduled for ${new Date(scheduledAt).toLocaleString()}. ${notes}`,
          user.username,
          'administrative'
        );
      }

      return {
        success: true,
        request: updatedRequest
      };

    } catch (error) {
      fastify.log.error('Failed to schedule consultation:', error);
      return reply.code(500).send({
        error: 'SCHEDULING_ERROR',
        message: error.message || 'Failed to schedule consultation'
      });
    }
  });

  // Add note to consultation request
  fastify.post('/requests/:requestId/notes', {
    schema: {
      tags: ['consultations'],
      description: 'Add note to consultation request',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          requestId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1 },
          type: {
            type: 'string',
            enum: ['general', 'medical', 'administrative']
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = request.user;
      const { requestId } = request.params;
      const { content, type = 'general' } = request.body;

      await consultationRequestService.addRequestNote(
        requestId,
        content,
        user.username,
        type
      );

      return {
        success: true,
        message: 'Note added successfully'
      };

    } catch (error) {
      fastify.log.error('Failed to add request note:', error);
      return reply.code(500).send({
        error: 'NOTE_ERROR',
        message: error.message || 'Failed to add note'
      });
    }
  });

  // Reassign consultation request
  fastify.patch('/requests/:requestId/reassign', {
    schema: {
      tags: ['consultations'],
      description: 'Reassign consultation request to different doctor',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          requestId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['newDoctorUsername'],
        properties: {
          newDoctorUsername: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            request: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                assignedDoctorUsername: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    try {
      const user = request.user;
      const { requestId } = request.params;
      const { newDoctorUsername } = request.body;

      const updatedRequest = await consultationRequestService.reassignRequest(
        requestId,
        newDoctorUsername,
        user.username
      );

      return {
        success: true,
        request: updatedRequest
      };

    } catch (error) {
      fastify.log.error('Failed to reassign request:', error);
      return reply.code(500).send({
        error: 'REASSIGNMENT_ERROR',
        message: error.message || 'Failed to reassign request'
      });
    }
  });

  // Get consultation statistics (for admin/monitoring)
  fastify.get('/stats', {
    schema: {
      tags: ['consultations'],
      description: 'Get consultation statistics',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            availability: {
              type: 'object',
              properties: {
                totalDoctors: { type: 'number' },
                onlineDoctors: { type: 'number' },
                totalActiveConsultations: { type: 'number' }
              }
            },
            requests: {
              type: 'object',
              properties: {
                pendingRequests: { type: 'number' },
                assignedRequests: { type: 'number' },
                completedRequests: { type: 'number' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const [availabilityStats, requestStats] = await Promise.all([
        doctorAvailabilityService.getAvailabilityStats(),
        consultationRequestService.getRequestStats()
      ]);

      return {
        success: true,
        availability: availabilityStats,
        requests: requestStats
      };

    } catch (error) {
      fastify.log.error('Failed to get consultation statistics:', error);
      return reply.code(500).send({
        error: 'STATS_ERROR',
        message: 'Failed to retrieve consultation statistics'
      });
    }
  });
};
/* TODO: Make an interface like stack overflow where patients can upload questions 
that the ai chatbot/other doctors couldn't answer. Allow upvoting of questions
Questions will be passed through a bot to determine if its a useful question and not a hate speech 
Doctors can also upload questions (Doctors side) patients can't view this
There will be an advice section where doctors can post advice that patients can listen to
*/  
export default consultationRoutes;
