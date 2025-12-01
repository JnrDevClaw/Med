#!/usr/bin/env node

/**
 * Environment Variable Checker
 * Run this script to verify all required environment variables are set
 */

const requiredVars = {
  backend: [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'HUGGINGFACE_API_KEY',
    'CORS_ORIGIN'
  ],
  optional: [
    'IPFS_API_KEY',
    'IPFS_API_SECRET',
    'CERAMIC_SEED',
    'TURN_SERVER_URL'
  ]
};

console.log('🔍 Checking Backend Environment Variables...\n');

let missingRequired = [];
let missingOptional = [];

// Check required variables
console.log('Required Variables:');
requiredVars.backend.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`);
  } else {
    console.log(`  ❌ ${varName}: NOT SET`);
    missingRequired.push(varName);
  }
});

console.log('\nOptional Variables:');
requiredVars.optional.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`);
  } else {
    console.log(`  ⚠️  ${varName}: NOT SET (optional)`);
    missingOptional.push(varName);
  }
});

console.log('\n' + '='.repeat(60));

if (missingRequired.length > 0) {
  console.log('\n❌ MISSING REQUIRED VARIABLES:');
  missingRequired.forEach(v => console.log(`   - ${v}`));
  console.log('\n⚠️  Your application may not work correctly!');
  console.log('Please set these variables in your .env file or Render dashboard.\n');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
  
  if (missingOptional.length > 0) {
    console.log('\n⚠️  Optional variables not set:');
    missingOptional.forEach(v => console.log(`   - ${v}`));
    console.log('\nThese are optional but may enhance functionality.');
  }
  
  console.log('\n🚀 Your backend is ready to deploy!\n');
  process.exit(0);
}
