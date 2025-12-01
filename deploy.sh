#!/bin/bash

# Med Connect Production Deployment Script
# This script handles the deployment of the Med Connect application

set -e  # Exit on error

echo "🚀 Starting Med Connect Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env files exist
check_env_files() {
    echo "📋 Checking environment files..."
    
    if [ ! -f "backend/.env" ]; then
        echo -e "${RED}❌ backend/.env not found!${NC}"
        echo "Please copy backend/.env.production to backend/.env and configure it"
        exit 1
    fi
    
    if [ ! -f "Frontend/.env" ]; then
        echo -e "${RED}❌ Frontend/.env not found!${NC}"
        echo "Please copy Frontend/.env.production to Frontend/.env and configure it"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment files found${NC}"
}

# Check if Docker is running
check_docker() {
    echo "🐳 Checking Docker..."
    
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running!${NC}"
        echo "Please start Docker and try again"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Build Docker images
build_images() {
    echo "🔨 Building Docker images..."
    
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Images built successfully${NC}"
    else
        echo -e "${RED}❌ Image build failed${NC}"
        exit 1
    fi
}

# Stop existing containers
stop_containers() {
    echo "🛑 Stopping existing containers..."
    
    docker-compose down
    
    echo -e "${GREEN}✅ Containers stopped${NC}"
}

# Start containers
start_containers() {
    echo "▶️  Starting containers..."
    
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Containers started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start containers${NC}"
        exit 1
    fi
}

# Check container health
check_health() {
    echo "🏥 Checking container health..."
    
    sleep 10  # Wait for containers to initialize
    
    # Check backend health
    if docker exec medconnect-backend node healthcheck.js > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend health check failed (may still be starting)${NC}"
    fi
    
    # Check if containers are running
    if [ "$(docker ps -q -f name=medconnect-backend)" ]; then
        echo -e "${GREEN}✅ Backend container is running${NC}"
    else
        echo -e "${RED}❌ Backend container is not running${NC}"
    fi
    
    if [ "$(docker ps -q -f name=medconnect-frontend)" ]; then
        echo -e "${GREEN}✅ Frontend container is running${NC}"
    else
        echo -e "${RED}❌ Frontend container is not running${NC}"
    fi
    
    if [ "$(docker ps -q -f name=medconnect-nginx)" ]; then
        echo -e "${GREEN}✅ Nginx container is running${NC}"
    else
        echo -e "${RED}❌ Nginx container is not running${NC}"
    fi
}

# Show logs
show_logs() {
    echo ""
    echo "📊 Recent logs:"
    docker-compose logs --tail=50
}

# Main deployment flow
main() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║   Med Connect Production Deployment   ║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    
    check_env_files
    check_docker
    stop_containers
    build_images
    start_containers
    check_health
    
    echo ""
    echo -e "${GREEN}✅ Deployment completed!${NC}"
    echo ""
    echo "📝 Next steps:"
    echo "  - Check logs: docker-compose logs -f"
    echo "  - Access frontend: http://localhost"
    echo "  - Access backend API: http://localhost/api"
    echo "  - Monitor containers: docker-compose ps"
    echo ""
    
    read -p "Show recent logs? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        show_logs
    fi
}

# Run main function
main
