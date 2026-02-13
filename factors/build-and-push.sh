#!/bin/bash

# Factor API - Build and Push to GitHub Container Registry
# Usage: ./build-and-push.sh [version]
# Example: ./build-and-push.sh v1.0.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="ghcr.io"
OWNER="artemis-xyz"
IMAGE_NAME="factor-api"
VERSION=${1:-"latest"}

echo -e "${GREEN}Building Factor API Docker Image${NC}"
echo "Registry: $REGISTRY"
echo "Image: $OWNER/$IMAGE_NAME"
echo "Version: $VERSION"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Build the image
echo -e "${YELLOW}Step 1: Building Docker image...${NC}"
docker build -t $REGISTRY/$OWNER/$IMAGE_NAME:$VERSION .

# Tag as latest if version is specified
if [ "$VERSION" != "latest" ]; then
    echo -e "${YELLOW}Step 2: Tagging as latest...${NC}"
    docker tag $REGISTRY/$OWNER/$IMAGE_NAME:$VERSION $REGISTRY/$OWNER/$IMAGE_NAME:latest
fi

# Check if logged in to GitHub Container Registry
echo -e "${YELLOW}Step 3: Checking GitHub Container Registry authentication...${NC}"
if ! docker info 2>&1 | grep -q "ghcr.io"; then
    echo -e "${YELLOW}Not logged in to GHCR. Please login:${NC}"
    echo "Run: echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin"
    echo ""
    read -p "Press enter after logging in to continue..."
fi

# Push the image
echo -e "${YELLOW}Step 4: Pushing to GitHub Container Registry...${NC}"
docker push $REGISTRY/$OWNER/$IMAGE_NAME:$VERSION

if [ "$VERSION" != "latest" ]; then
    docker push $REGISTRY/$OWNER/$IMAGE_NAME:latest
fi

echo ""
echo -e "${GREEN}✓ Successfully built and pushed image!${NC}"
echo ""
echo "Images pushed:"
echo "  - $REGISTRY/$OWNER/$IMAGE_NAME:$VERSION"
if [ "$VERSION" != "latest" ]; then
    echo "  - $REGISTRY/$OWNER/$IMAGE_NAME:latest"
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Go to Railway Dashboard: https://railway.app/dashboard"
echo "2. Create new project → Deploy Docker Image"
echo "3. Enter: $REGISTRY/$OWNER/$IMAGE_NAME:$VERSION"
echo "4. Add environment variable: ARTEMIS_API_KEY"
echo "5. Deploy!"
echo ""
echo -e "${GREEN}Image URL for Railway:${NC} $REGISTRY/$OWNER/$IMAGE_NAME:$VERSION"
