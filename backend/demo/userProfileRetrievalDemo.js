#!/usr/bin/env node

/**
 * User Profile Retrieval System Demonstration
 * 
 * This script demonstrates the functionality of the user profile retrieval system
 * implemented in task 2.3, including:
 * 1. Service to fetch user data from IPFS using CIDs
 * 2. Caching mechanism for frequently accessed profiles
 * 3. Error handling for IPFS network issues
 */

import { UserProfileService } from '../src/services/userProfileService.js';

// Mock IPFS service for demonstration
class MockIPFSService {
  constructor() {
    this.storage = new Map();
    this.networkDelay = 100; // Simulate network delay
    this.failureRate = 0.1; // 10% failure rate for demonstration
  }

  async storeUserProfile(profile, username) {
    await this.simulateNetworkDelay();
    const cid = `QmMock${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    this.storage.set(cid, { profile, username });
    console.log(`📦 Stored profile for ${username} with CID: ${cid}`);
    return cid;
  }

  async retrieveUserProfile(cid, username) {
    await this.simulateNetworkDelay();
    
    // Simulate network failures
    if (Math.random() < this.failureRate) {
      throw new Error('IPFS network timeout - simulated failure');
    }

    const stored = this.storage.get(cid);
    if (!stored) {
      throw new Error(`Profile not found for CID: ${cid}`);
    }

    console.log(`📥 Retrieved profile for ${username} from CID: ${cid}`);
    return stored.profile;
  }

  async updateUserProfile(oldCid, updates, username) {
    const existing = await this.retrieveUserProfile(oldCid, username);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    return await this.storeUserProfile(updated, username);
  }

  validateProfile(profile) {
    return profile && profile.username && profile.role;
  }

  async simulateNetworkDelay() {
    await new Promise(resolve => setTimeout(resolve, this.networkDelay));
  }
}

// Mock Firestore service for demonstration
class MockFirestoreService {
  constructor() {
    this.users = new Map();
  }

  async createUserMapping(username, ipfsCid, metadata) {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.users.set(username, {
      id,
      username,
      ipfsCid,
      ...metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log(`🗃️  Created user mapping: ${username} → ${ipfsCid}`);
    return id;
  }

  async getUserCid(username) {
    const user = this.users.get(username);
    return user ? user.ipfsCid : null;
  }

  async getUserByUsername(username) {
    return this.users.get(username) || null;
  }

  async updateUserCid(username, newCid) {
    const user = this.users.get(username);
    if (user) {
      user.ipfsCid = newCid;
      user.updatedAt = new Date().toISOString();
      console.log(`🔄 Updated CID for ${username}: ${newCid}`);
    }
  }

  async updateUserMetadata(username, updates) {
    const user = this.users.get(username);
    if (user) {
      Object.assign(user, updates);
      user.updatedAt = new Date().toISOString();
      console.log(`📝 Updated metadata for ${username}`);
    }
  }

  async isUsernameAvailable(username) {
    return !this.users.has(username);
  }
}

// Mock logger
const mockLogger = {
  info: (msg, data) => console.log(`ℹ️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg, error) => console.error(`❌ ${msg}`, error?.message || error),
  warn: (msg, data) => console.warn(`⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  debug: (msg, data) => console.log(`🐛 ${msg}`, data ? JSON.stringify(data, null, 2) : '')
};

async function demonstrateUserProfileRetrievalSystem() {
  console.log('🚀 User Profile Retrieval System Demonstration\n');

  // Initialize services
  const ipfsService = new MockIPFSService();
  const firestoreService = new MockFirestoreService();
  const userProfileService = new UserProfileService(null, null, mockLogger);
  
  // Inject mock services
  userProfileService.ipfsService = ipfsService;
  userProfileService.firestoreService = firestoreService;

  try {
    console.log('1️⃣  Creating test user profiles...\n');

    // Create test users
    const testUsers = [
      {
        username: 'dr_smith',
        role: 'doctor',
        email: 'dr.smith@hospital.com',
        verified: true,
        personalInfo: {
          fullName: 'Dr. John Smith',
          specialties: ['Cardiology', 'Internal Medicine'],
          experience: 15
        }
      },
      {
        username: 'patient_jane',
        role: 'patient',
        email: 'jane.doe@email.com',
        verified: false,
        personalInfo: {
          fullName: 'Jane Doe',
          dateOfBirth: '1985-03-15',
          allergies: ['Penicillin']
        }
      }
    ];

    // Create user profiles
    const createdUsers = [];
    for (const userData of testUsers) {
      const result = await userProfileService.createUserProfile(userData.username, userData);
      createdUsers.push(result);
      console.log(`✅ Created user: ${result.username} (${result.role})\n`);
    }

    console.log('2️⃣  Demonstrating profile retrieval with caching...\n');

    // Test profile retrieval and caching
    const username = 'dr_smith';
    
    console.log(`📖 First retrieval (cache miss):`);
    const start1 = Date.now();
    const profile1 = await userProfileService.getUserProfile(username);
    const time1 = Date.now() - start1;
    console.log(`   Retrieved in ${time1}ms`);
    console.log(`   Profile: ${profile1.personalInfo.fullName} (${profile1.role})\n`);

    console.log(`📖 Second retrieval (cache hit):`);
    const start2 = Date.now();
    const profile2 = await userProfileService.getUserProfile(username);
    const time2 = Date.now() - start2;
    console.log(`   Retrieved in ${time2}ms (should be much faster!)`);
    console.log(`   Profile: ${profile2.personalInfo.fullName} (${profile2.role})\n`);

    console.log('3️⃣  Demonstrating error handling and retry logic...\n');

    // Increase failure rate to demonstrate retry logic
    ipfsService.failureRate = 0.7; // 70% failure rate
    
    console.log(`🔄 Testing retry logic with high failure rate (70%):`);
    try {
      const start3 = Date.now();
      const profile3 = await userProfileService.getUserProfile('patient_jane', false); // Bypass cache
      const time3 = Date.now() - start3;
      console.log(`   Retrieved after retries in ${time3}ms`);
      console.log(`   Profile: ${profile3.personalInfo.fullName} (${profile3.role})\n`);
    } catch (error) {
      console.log(`   Failed after maximum retries: ${error.message}\n`);
    }

    // Reset failure rate
    ipfsService.failureRate = 0.1;

    console.log('4️⃣  Demonstrating batch profile retrieval...\n');

    const usernames = ['dr_smith', 'patient_jane'];
    console.log(`📦 Batch retrieving profiles for: ${usernames.join(', ')}`);
    const batchResults = await userProfileService.batchGetUserProfiles(usernames);
    
    for (const [username, profile] of Object.entries(batchResults)) {
      if (profile.error) {
        console.log(`   ❌ ${username}: ${profile.error}`);
      } else {
        console.log(`   ✅ ${username}: ${profile.personalInfo?.fullName || profile.username} (${profile.role})`);
      }
    }
    console.log();

    console.log('5️⃣  Demonstrating cache management...\n');

    // Show cache statistics
    const cacheStats = userProfileService.getCacheStats();
    console.log(`📊 Cache Statistics:`);
    console.log(`   Total entries: ${cacheStats.totalEntries}`);
    console.log(`   Valid entries: ${cacheStats.validEntries}`);
    console.log(`   Expired entries: ${cacheStats.expiredEntries}`);
    console.log(`   Max size: ${cacheStats.maxSize}`);
    console.log(`   Cache timeout: ${cacheStats.cacheTimeout}ms\n`);

    // Clear specific user cache
    console.log(`🧹 Clearing cache for ${username}...`);
    userProfileService.clearCache(username);
    
    const cacheStatsAfter = userProfileService.getCacheStats();
    console.log(`   Cache entries after clear: ${cacheStatsAfter.totalEntries}\n`);

    console.log('6️⃣  Demonstrating profile updates...\n');

    const updates = {
      email: 'dr.smith.updated@hospital.com',
      personalInfo: {
        ...profile1.personalInfo,
        experience: 16 // Promoted!
      }
    };

    console.log(`📝 Updating profile for ${username}...`);
    const newCid = await userProfileService.updateUserProfile(username, updates);
    console.log(`   New CID: ${newCid}`);

    // Retrieve updated profile
    const updatedProfile = await userProfileService.getUserProfile(username, false);
    console.log(`   Updated email: ${updatedProfile.email}`);
    console.log(`   Updated experience: ${updatedProfile.personalInfo.experience} years\n`);

    console.log('7️⃣  Demonstrating health check...\n');

    // Mock IPFS for health check
    userProfileService.ipfsService.ipfs = {
      isReady: () => true,
      uploadFile: async () => 'QmHealthCheck',
      getFile: async () => Buffer.from('test')
    };
    
    const healthStatus = await userProfileService.healthCheck();
    console.log(`🏥 Health Check Results:`);
    console.log(`   Status: ${healthStatus.status}`);
    console.log(`   IPFS Ready: ${healthStatus.ipfs?.ready}`);
    console.log(`   IPFS Latency: ${healthStatus.ipfs?.latency}ms`);
    console.log(`   Cache Stats: ${JSON.stringify(healthStatus.cache, null, 2)}\n`);

    console.log('✅ User Profile Retrieval System Demonstration Complete!\n');
    
    console.log('📋 Summary of Implemented Features:');
    console.log('   ✅ Service to fetch user data from IPFS using CIDs');
    console.log('   ✅ Caching mechanism for frequently accessed profiles');
    console.log('   ✅ Error handling for IPFS network issues');
    console.log('   ✅ Retry logic with exponential backoff');
    console.log('   ✅ Batch profile retrieval');
    console.log('   ✅ Cache management and statistics');
    console.log('   ✅ Health monitoring');
    console.log('   ✅ Profile updates with cache invalidation');

  } catch (error) {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  }
}

// Run the demonstration
demonstrateUserProfileRetrievalSystem().catch(console.error);