# Deployment Configuration Fixes

## Issues Fixed

### 1. CORS Configuration ✅
- Added support for your Netlify frontend: `https://medconnect124.netlify.app`
- Configured proper CORS headers for production
- Added support for multiple origins (dev + production)

### 2. Port Configuration ✅
- Changed default port from 5001 to 3001 (Render's expected port)
- Added HOST configuration for proper binding to 0.0.0.0

### 3. Plugin Timeout Protection ✅
- Increased Fastify plugin timeout to 30 seconds
- Made Ceramic plugin initialization non-blocking
- IPFS plugin already uses background initialization

### 4. Environment Variables ✅
- Updated `.env.production` files for both frontend and backend
- Set correct CORS_ORIGIN
- Set correct PUBLIC_API_URL for frontend

## Required Environment Variables on Render

You need to set these environment variables in your Render dashboard:

### Backend (https://med-qkh3.onrender.com)

```bash
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# JWT
JWT_SECRET=<your-secure-random-string-at-least-32-chars>
JWT_EXPIRES_IN=1h

# Firebase/Firestore
VITE_FIREBASE_API_KEY=<your-firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<your-project>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>

# IPFS (Optional - uses local Helia if not set)
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_API_KEY=<your-ipfs-key>
IPFS_API_SECRET=<your-ipfs-secret>
IPFS_GATEWAY_URL=https://ipfs.infura.io/ipfs/

# HuggingFace
HUGGINGFACE_API_KEY=<your-huggingface-key>
HUGGINGFACE_MODEL_URL=https://api-inference.huggingface.co/models
HUGGINGFACE_REFINER_MODEL=blaze999/Medical-NER
HUGGINGFACE_MEDICAL_MODEL=sethuiyer/Medichat-Llama3-8B

# CORS
CORS_ORIGIN=https://medconnect124.netlify.app

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### Frontend (Netlify)

Set these in Netlify's environment variables:

```bash
# API
PUBLIC_API_URL=https://med-qkh3.onrender.com

# Firebase (same as backend)
VITE_FIREBASE_API_KEY=<your-firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<your-project>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>

# App Config
VITE_APP_NAME=MedConnect
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production
```

## Deployment Steps

### Backend (Render)

1. **Push the updated code to your repository**
   ```bash
   git add .
   git commit -m "Fix CORS and deployment configuration"
   git push
   ```

2. **Set environment variables in Render Dashboard**
   - Go to https://dashboard.render.com
   - Select your backend service
   - Go to "Environment" tab
   - Add all the variables listed above

3. **Trigger a manual deploy**
   - Click "Manual Deploy" → "Deploy latest commit"

4. **Monitor the logs**
   - Watch for: `🚀 Server running at http://0.0.0.0:3001`
   - Should see: `✅ Using Firestore as database`
   - Should see: `IPFS client initialized (background)`

### Frontend (Netlify)

1. **Set environment variables in Netlify**
   - Go to your Netlify dashboard
   - Select your site
   - Go to "Site settings" → "Environment variables"
   - Add all the variables listed above

2. **Trigger a rebuild**
   - Go to "Deploys" tab
   - Click "Trigger deploy" → "Deploy site"

3. **Test the deployment**
   - Visit https://medconnect124.netlify.app
   - Check browser console for any errors
   - Try logging in/signing up

## Testing the Fix

### 1. Check Backend Health
```bash
curl https://med-qkh3.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

### 2. Check CORS
Open browser console on https://medconnect124.netlify.app and run:
```javascript
fetch('https://med-qkh3.onrender.com/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Should see the health response, not a CORS error.

### 3. Check API Documentation
Visit: https://med-qkh3.onrender.com/docs

Should see Swagger UI with all your API endpoints.

## Common Issues & Solutions

### Issue: "Plugin did not start in time"
**Solution**: The plugin timeout has been increased to 30 seconds. If still occurring:
- Check if Firebase credentials are correct
- Check if HuggingFace API is responding
- Ceramic plugin now runs in background and won't block startup

### Issue: "Port scan timeout"
**Solution**: 
- Ensure PORT=3001 is set in Render environment
- Ensure HOST=0.0.0.0 is set
- Code now defaults to 3001 instead of 5001

### Issue: CORS errors in browser
**Solution**:
- Verify CORS_ORIGIN is set to `https://medconnect124.netlify.app`
- Check that frontend PUBLIC_API_URL is set correctly
- Clear browser cache and try again

### Issue: "IPFS not yet initialized"
**Solution**: This is normal! IPFS initializes in the background. Wait a few seconds after server starts, or the error will resolve itself.

## Monitoring

After deployment, monitor:

1. **Render Logs**: Check for any errors or warnings
2. **Netlify Deploy Logs**: Ensure build completes successfully
3. **Browser Console**: Check for API connection errors
4. **Network Tab**: Verify API calls are going to the correct URL

## Rollback Plan

If issues persist:

1. **Backend**: Use Render's "Rollback" feature to previous deployment
2. **Frontend**: Use Netlify's "Rollback" feature
3. **Check logs** to identify the specific issue
4. **Contact support** if needed with error logs

## Next Steps

After successful deployment:

1. Test all major features:
   - User signup/login
   - Q&A system
   - AI chat
   - Video consultations
   - Doctor verification

2. Set up monitoring:
   - Add error tracking (Sentry)
   - Set up uptime monitoring
   - Configure alerts

3. Performance optimization:
   - Enable CDN for static assets
   - Configure caching headers
   - Optimize database queries

## Support

If you encounter issues:
- Check Render logs: https://dashboard.render.com
- Check Netlify logs: https://app.netlify.com
- Review this document for common issues
- Check Firebase console for authentication issues
