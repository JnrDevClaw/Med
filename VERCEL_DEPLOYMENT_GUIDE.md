# Vercel Deployment Guide for Med Connect

## Fixed Issues

✅ **Node.js Version Error**: Fixed by:
- Removed incorrect runtime specification from `svelte.config.js`
- Added `.nvmrc` and `.node-version` files specifying Node.js 20
- Added proper `engines` field to `package.json` files
- Created proper `vercel.json` configuration

## Required Environment Variables

You need to set these environment variables in your Vercel dashboard:

### Firebase Configuration
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### API Configuration
```
PUBLIC_API_URL=https://med-qkh3.onrender.com
PUBLIC_CERAMIC_API_URL=https://ceramic-clay.3boxlabs.com
PUBLIC_IPFS_GATEWAY_URL=https://ipfs.infura.io/ipfs/
```

### Application Configuration
```
VITE_APP_NAME=MedConnect
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production
```

## Deployment Steps

1. **Push your changes to GitHub**:
   ```bash
   git add .
   git commit -m "Fix Node.js version and deployment configuration"
   git push origin main
   ```

2. **In Vercel Dashboard**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add all the variables listed above
   - Make sure to use your actual Firebase configuration values

3. **Trigger a new deployment**:
   - Either push a new commit or manually trigger deployment in Vercel

## Files Created/Modified

- ✅ `vercel.json` - Vercel deployment configuration
- ✅ `package.json` - Root package.json with Node.js engine specification
- ✅ `.nvmrc` - Node.js version specification
- ✅ `.node-version` - Alternative Node.js version specification
- ✅ `Frontend/package.json` - Added Node.js engine specification
- ✅ `Frontend/svelte.config.js` - Removed incorrect runtime specification
- ✅ `Frontend/.env` - Updated with production environment variables

## Next Steps

1. Get your Firebase configuration values from Firebase Console
2. Add them to Vercel environment variables
3. Deploy and test

The Node.js version error should now be resolved!