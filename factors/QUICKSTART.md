# Factor API - Quick Start Guide

## 🚀 Deploy to Railway (5 minutes)

### Method 1: Automated via GitHub Actions (Recommended)

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Add Factor API containerization"
   git push origin main
   ```

2. **GitHub Actions will automatically**:
   - Build the Docker image
   - Push to GitHub Container Registry at `ghcr.io/artemis-xyz/factor-api:latest`
   - Make it available for Railway deployment

3. **Deploy to Railway**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from Docker Image"
   - Enter: `ghcr.io/artemis-xyz/factor-api:latest`
   - Add environment variable:
     - Key: `ARTEMIS_API_KEY`
     - Value: Your Artemis API key
   - Click "Deploy"
   - Railway will assign a public URL (e.g., `https://your-app.up.railway.app`)

### Method 2: Manual Docker Build & Push

1. **Start Docker Desktop**

2. **Login to GitHub Container Registry**:
   ```bash
   # Create a GitHub Personal Access Token with 'write:packages' scope at:
   # https://github.com/settings/tokens

   echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

3. **Build and Push**:
   ```bash
   cd factors
   chmod +x build-and-push.sh
   ./build-and-push.sh v1.0.0
   ```

4. **Deploy to Railway** (same as Method 1, step 3)

### Method 3: Deploy from GitHub Repo (Easiest)

1. **Push code to GitHub** (if not done)

2. **Connect Railway to GitHub**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `portfolio-analytics` repository
   - Railway auto-detects `factors/Dockerfile`
   - Add environment variable: `ARTEMIS_API_KEY`
   - Deploy!

## 🧪 Test Locally First

### Using Docker:

```bash
cd factors

# Build image
docker build -t factor-api:local .

# Run container
docker run -p 8000:8000 \
  -e ARTEMIS_API_KEY="your-api-key-here" \
  factor-api:local

# Test in another terminal
curl http://localhost:8000/health
curl http://localhost:8000/factors
```

### Using Docker Compose:

```bash
cd factors

# Set environment variable
export ARTEMIS_API_KEY="your-api-key-here"

# Start services
docker-compose up

# Stop services
docker-compose down
```

### Without Docker (Development):

```bash
cd factors

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variable
export ARTEMIS_API_KEY="your-api-key-here"

# Run API
uvicorn api:app --reload --port 8000
```

## 📊 Test the Deployed API

Once deployed on Railway, you'll get a URL like `https://your-app.up.railway.app`

```bash
# Health check
curl https://your-app.up.railway.app/health

# List available factors
curl https://your-app.up.railway.app/factors

# Get factor logs
curl https://your-app.up.railway.app/factors/smb/logs?limit=5

# Get latest factor performance
curl https://your-app.up.railway.app/factors/momentum/latest

# Compare all factors
curl https://your-app.up.railway.app/factors/compare

# Get time series data
curl "https://your-app.up.railway.app/factors/time-series?factors=smb,momentum,value"
```

## 🔧 Update Frontend to Use Deployed API

Update your frontend code to point to the Railway URL:

```typescript
// In src/hooks/useFactorAnalysis.ts or wherever you call the API
const FACTOR_API_URL = import.meta.env.VITE_FACTOR_API_URL || 'https://your-app.up.railway.app';

// Example fetch call
const response = await fetch(`${FACTOR_API_URL}/factors/smb/latest`);
```

Add to your `.env` or `.env.local`:
```
VITE_FACTOR_API_URL=https://your-app.up.railway.app
```

## 🔄 Update Deployment

### To deploy new version:

**Via GitHub Actions (automatic)**:
```bash
git add .
git commit -m "Update factor API"
git push origin main
# GitHub Actions builds and pushes automatically
# Railway auto-deploys if connected to GitHub
```

**Via manual Docker push**:
```bash
cd factors
./build-and-push.sh v1.0.1
# Then redeploy in Railway dashboard or it auto-updates
```

## 🐛 Troubleshooting

### Image won't build
- Check Docker is running: `docker info`
- Check Dockerfile syntax
- Review build logs

### Railway deployment fails
- Verify `ARTEMIS_API_KEY` is set in Railway environment variables
- Check Railway logs for errors
- Ensure image is public or Railway has access to private registry

### API returns 500 errors
- Check Railway logs: Railway Dashboard → Your Project → Deployments → View Logs
- Verify `ARTEMIS_API_KEY` is valid
- Check if API endpoints are accessible

### CORS errors in frontend
- Update CORS origins in `factors/api.py`:
  ```python
  allow_origins=[
      "https://your-frontend-domain.com",
      "https://your-app.up.railway.app",
      "http://localhost:5173",
  ]
  ```
- Rebuild and redeploy

## 💰 Cost Estimates

**Railway Pricing**:
- Hobby Plan: $5/month for 500 hours (enough for 24/7 uptime)
- Pro Plan: $20/month + usage (for production)

This Factor API should run on Hobby plan comfortably.

## 📚 Additional Resources

- [Full Deployment Guide](./DEPLOYMENT.md)
- [Railway Documentation](https://docs.railway.app)
- [GitHub Container Registry Docs](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [FastAPI Documentation](https://fastapi.tiangolo.com)

## 🆘 Support

If you encounter issues:
1. Check Railway logs
2. Review GitHub Actions logs (if using automated deployment)
3. Test locally with Docker first
4. Verify environment variables are set correctly
