# Database Fallback Implementation

## Overview
The Med Connect application now automatically selects between Firestore and MongoDB based on configuration availability.

## How It Works

### Automatic Database Selection
The new `database.js` plugin checks for Firebase/Firestore credentials at startup:

1. **If Firestore credentials are configured** (Firebase API key and Project ID exist in `.env`):
   - Uses Firestore as the database
   - Logs: `✅ Using Firestore as database`

2. **If Firestore credentials are NOT configured**:
   - Automatically falls back to local MongoDB
   - Connects to `mongodb://localhost:27017` (or `MONGO_URL` from `.env`)
   - Logs: `ℹ️  No Firestore configuration found, using MongoDB`

3. **If Firestore initialization fails**:
   - Automatically falls back to MongoDB
   - Logs: `⚠️  Firestore configuration found but initialization failed, falling back to MongoDB`

## Configuration

### For Firestore (Production)
Keep these variables in your `.env`:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### For MongoDB (Local Development)
Either:
- **Remove or comment out** the Firebase variables above, OR
- **Set MongoDB explicitly**:
```env
MONGO_URL=mongodb://localhost:27017
MONGO_DB=medplatform
```

## Benefits

1. **Easier Local Development**: No need to set up Firebase for local testing
2. **Automatic Fallback**: If Firestore fails, the app continues with MongoDB
3. **Zero Configuration**: Works out of the box with local MongoDB
4. **Production Ready**: Seamlessly uses Firestore when properly configured

## Files Changed

1. **`backend/src/plugins/database.js`** (NEW)
   - Unified database plugin with automatic selection logic
   - Registered as 'firebase' plugin for backward compatibility

2. **`backend/src/index.js`**
   - Imports and registers the new `databasePlugin` (which replaces `firebasePlugin`)

3. **`backend/src/plugins/webrtc.js`**
   - Fixed undefined `preHandler` issue with `fastify.authenticate`

4. **`.env.example`**
   - Updated documentation to explain automatic database selection

5. **`.kiro/specs/web-application/requirements.md`**
   - Updated Requirement 1 to include MongoDB fallback criteria
   - Updated Glossary to include Database_Layer and MongoDB_Database

## Technical Notes

The new database plugin is registered with the name 'firebase' to maintain backward compatibility with existing plugins that declare `dependencies: ['firebase']`. This means no other plugin files need to be modified.

## Usage

The database is accessible via:
- `fastify.firestore` (when using Firestore)
- `fastify.mongo` (when using MongoDB)
- `fastify.dbType` (returns 'firestore' or 'mongodb')

Services should check `fastify.dbType` if they need database-specific logic.

## Next Steps

To use MongoDB locally:
1. Install MongoDB: https://www.mongodb.com/try/download/community
2. Start MongoDB: `mongod` (or it may start automatically)
3. Remove Firebase credentials from `.env` or comment them out
4. Restart the backend server

The app will automatically detect and use MongoDB!
