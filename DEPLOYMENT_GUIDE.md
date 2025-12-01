# Med Connect Production Deployment Guide

## Prerequisites

Before deploying Med Connect to production, ensure you have:

1. **Docker & Docker Compose** installed
   - Docker version 20.10 or higher
   - Docker Compose version 2.0 or higher

2. **Required Services**
   - Firebase/Firestore project configured
   - IPFS storage (Infura or self-hosted)
   - HuggingFace API access
   - (Optional) TURN server for WebRTC

3. **Domain & SSL Certificate** (for HTTPS)
   - Domain name configured
   - SSL certificate (Let's Encrypt recommended)

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url>
cd med-connect

# Copy environment files
cp backend/.env.production backend/.env
cp Frontend/.env.production Frontend/.env

# Edit the .env files with your actual credentials
nano backend/.env
nano Frontend/.env
```

### 2. Configure Environment Variables

#### Backend (.env)

**Critical variables to change:**
- `JWT_SECRET` - Use a strong random string (32+ characters)
- `ENCRYPTION_KEY` - Use a 32-character random string
- `REDIS_PASSWORD` - Use a strong password
- Firebase credentials (all `VITE_FIREBASE_*` variables)
- `IPFS_API_KEY` and `IPFS_API_SECRET`
- `HUGGINGFACE_API_KEY`
- `CORS_ORIGIN` - Your production domain

#### Frontend (.env)

- `VITE_API_URL` - Your backend API URL
- Firebase credentials (must match backend)
- `VITE_IPFS_GATEWAY_URL`

### 3. Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## Manual Deployment

If you prefer manual deployment:

```bash
# Build images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## SSL/HTTPS Configuration

### Using Let's Encrypt (Recommended)

1. Install Certbot:
```bash
sudo apt-get install certbot
```

2. Generate certificate:
```bash
sudo certbot certonly --standalone -d your-domain.com
```

3. Copy certificates:
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

4. Update `nginx/nginx.conf`:
   - Uncomment the HTTPS server block
   - Update `server_name` with your domain
   - Uncomment the HTTP to HTTPS redirect

5. Restart Nginx:
```bash
docker-compose restart nginx
```

## Health Checks

### Backend Health
```bash
curl http://localhost/api/health
```

### Frontend Health
```bash
curl http://localhost/
```

### Container Status
```bash
docker-compose ps
```

## Monitoring

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Resource Usage
```bash
docker stats
```

## Backup & Recovery

### Backup Redis Data
```bash
docker exec medconnect-redis redis-cli SAVE
docker cp medconnect-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

### Backup Uploaded Files
```bash
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz backend/uploads/
```

### Backup Environment Files
```bash
tar -czf backups/env-$(date +%Y%m%d).tar.gz backend/.env Frontend/.env
```

## Scaling

### Horizontal Scaling (Multiple Instances)

Update `docker-compose.prod.yml`:

```yaml
services:
  backend:
    deploy:
      replicas: 3
```

### Vertical Scaling (More Resources)

Update resource limits in `docker-compose.prod.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check if port is in use
sudo lsof -i :3001

# Restart container
docker-compose restart backend
```

### Database Connection Issues

1. Verify Firebase credentials in `.env`
2. Check Firestore security rules
3. Verify network connectivity

### IPFS Upload Failures

1. Verify IPFS credentials
2. Check IPFS service status
3. Verify file size limits

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart containers
docker-compose restart

# Clear Redis cache
docker exec medconnect-redis redis-cli FLUSHALL
```

## Security Checklist

- [ ] Changed all default passwords
- [ ] JWT_SECRET is strong and unique
- [ ] ENCRYPTION_KEY is 32 characters
- [ ] HTTPS/SSL configured
- [ ] Firestore security rules configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] File upload limits set
- [ ] Security headers configured in Nginx
- [ ] Non-root user in Docker containers
- [ ] Secrets not committed to git

## Maintenance

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
./deploy.sh
```

### Update Dependencies

```bash
# Backend
cd backend
npm update
npm audit fix

# Frontend
cd Frontend
npm update
npm audit fix

# Rebuild containers
docker-compose build --no-cache
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove stopped containers
docker container prune
```

## Performance Optimization

### Enable Redis Caching

Ensure Redis is properly configured in backend:
- User profile caching
- Session storage
- API response caching

### CDN Integration

For static assets, consider using a CDN:
1. Upload built frontend assets to CDN
2. Update `VITE_API_URL` to point to CDN
3. Configure cache headers

### Database Optimization

- Create Firestore indexes for common queries
- Implement pagination for large datasets
- Use IPFS for large file storage

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review this guide
3. Check GitHub issues
4. Contact support team

## Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] SSL/HTTPS enabled
- [ ] Firestore security rules set
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Team trained on deployment process
