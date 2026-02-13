# Factor API Deployment Guide

This guide covers containerization and deployment of the Factor API to Railway using GitHub Container Registry.

## Prerequisites

- Docker installed locally
- GitHub account with container registry access
- Railway account
- ARTEMIS_API_KEY environment variable

## Option 1: Deploy to Railway via GitHub Container Registry (Recommended)

### Step 1: Build and Push to GitHub Container Registry

```bash
# Navigate to the factors directory
cd factors

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build the Docker image
docker build -t ghcr.io/artemis-xyz/factor-api:latest .

# Tag with version (optional)
docker tag ghcr.io/artemis-xyz/factor-api:latest ghcr.io/artemis-xyz/factor-api:v1.0.0

# Push to GitHub Container Registry
docker push ghcr.io/artemis-xyz/factor-api:latest
docker push ghcr.io/artemis-xyz/factor-api:v1.0.0
```

### Step 2: Configure Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Create a new project
3. Select "Deploy from Docker Image"
4. Enter: `ghcr.io/artemis-xyz/factor-api:latest`
5. Add environment variables:
   - `ARTEMIS_API_KEY`: Your Artemis API key
   - `PORT`: Railway auto-sets this, but you can verify
6. Deploy!

Railway will automatically:
- Pull the image from GHCR
- Set up the PORT environment variable
- Create a public URL
- Monitor health checks

## Option 2: Deploy to Railway via GitHub Repository

1. Push your code to GitHub
2. Go to Railway Dashboard
3. Create new project from GitHub repo
4. Select the `portfolio-analytics` repository
5. Railway will detect the Dockerfile in `factors/`
6. Add environment variables:
   - `ARTEMIS_API_KEY`: Your Artemis API key
7. Deploy!

## Option 3: Docker Hub (Alternative Registry)

```bash
# Login to Docker Hub
docker login

# Build and tag
docker build -t YOUR_DOCKERHUB_USERNAME/factor-api:latest .

# Push to Docker Hub
docker push YOUR_DOCKERHUB_USERNAME/factor-api:latest
```

Then deploy to Railway using `YOUR_DOCKERHUB_USERNAME/factor-api:latest`

## Local Testing with Docker

### Build and run locally:

```bash
# Build the image
docker build -t factor-api:local .

# Run with environment variables
docker run -p 8000:8000 \
  -e ARTEMIS_API_KEY="your-api-key" \
  factor-api:local

# Or use docker-compose
docker-compose up
```

### Test the API:

```bash
# Health check
curl http://localhost:8000/health

# List factors
curl http://localhost:8000/factors

# Get factor logs
curl http://localhost:8000/factors/smb/logs
```

## GitHub Actions CI/CD (Optional)

Create `.github/workflows/deploy-factor-api.yml`:

```yaml
name: Build and Push Factor API

on:
  push:
    branches: [main]
    paths:
      - 'factors/**'
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: artemis-xyz/factor-api

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./factors
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

## Environment Variables for Railway

Required:
- `ARTEMIS_API_KEY`: Your Artemis API key

Auto-configured by Railway:
- `PORT`: Railway automatically sets this

Optional:
- Add any CORS origins if needed (modify `api.py` CORS settings)

## Monitoring

Railway provides:
- Automatic health checks at `/health` endpoint
- Logs dashboard
- Metrics (CPU, memory, network)
- Restart policies

## Troubleshooting

### Container fails to start
- Check Railway logs for errors
- Verify ARTEMIS_API_KEY is set
- Ensure port binding is correct ($PORT)

### Health check failing
- Verify `/health` endpoint is accessible
- Check if uvicorn is starting correctly
- Review application logs

### Image pull errors
- Ensure GitHub Container Registry package is public or Railway has access
- Verify image name is correct
- Check authentication tokens

## Production Considerations

1. **Logging**: Mount persistent volume for `factor_logs/` directory
2. **Secrets**: Use Railway's secret management for API keys
3. **Scaling**: Configure Railway horizontal scaling if needed
4. **Monitoring**: Set up external monitoring (e.g., UptimeRobot, Datadog)
5. **CORS**: Update allowed origins in `api.py` for production domains
6. **Rate Limiting**: Consider adding rate limiting middleware
7. **Caching**: Add Redis for caching factor computations

## Costs

Railway pricing:
- Free tier: $5 credit/month
- Pro: Pay-as-you-go starting at $5/month
- This API should run ~$5-10/month depending on usage

## Support

- Railway Docs: https://docs.railway.app
- GitHub Container Registry: https://docs.github.com/packages
