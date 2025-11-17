# Railway Deployment Guide

This guide will help you deploy the Boundary Explorer application to Railway with separate frontend and backend services.

## Overview

The application consists of two services:
- **Backend**: FastAPI + Python (wkls library)
- **Frontend**: React + Vite + TypeScript

Railway uses **Railpack** (released March 2025) as its build system, which provides zero-config deployments with smaller image sizes and better performance than the deprecated Nixpacks.

### What is Railpack?

Railpack is Railway's newest build system that:
- Automatically detects your application type and dependencies
- Produces container images 38-77% smaller than Nixpacks
- Supports granular version control (major.minor.patch)
- Uses BuildKit for faster, more efficient builds
- Works with zero configuration for most projects

The `railway.json` files in this project configure Railpack explicitly, but Railway will use Railpack by default for new deployments.

## Prerequisites

1. A [Railway](https://railway.app) account (free tier available)
2. Railway CLI installed (optional): `npm i -g @railway/cli`
3. Your code pushed to a GitHub repository

## Deployment Steps

### Option 1: Deploy via Railway Dashboard (Recommended)

#### Step 1: Create a New Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will detect the project

#### Step 2: Deploy the Backend Service

1. Railway should auto-detect the Python app and use the `railway.json` configuration
2. Configure the service:
   - **Service Name**: `boundary-explorer-backend`
   - **Root Directory**: `/` (or leave empty)
   - **Builder**: Railpack (auto-detected from `railway.json`)
   - **Start Command**: Configured in `railway.json` as `/app/venv/bin/uvicorn server.app.main:app --host 0.0.0.0 --port $PORT`

3. Add Environment Variables:
   - Go to the service settings → Variables
   - Add `CORS_ORIGINS` with your frontend URL (you'll update this after deploying frontend)
   - Example: `https://your-frontend.railway.app`

4. Deploy the service
5. Note the public URL (e.g., `https://boundary-explorer-backend-production.up.railway.app`)

#### Step 3: Deploy the Frontend Service

1. In the same Railway project, click "New Service"
2. Select "Deploy from GitHub repo" and choose the same repository
3. Configure the service:
   - **Service Name**: `boundary-explorer-frontend`
   - **Root Directory**: `web`
   - **Builder**: Railpack (auto-detected from `web/railway.json`)
   - **Build Command**: Auto-detected by Railpack (`pnpm install && pnpm build`)
   - **Start Command**: Configured in `web/railway.json` as `pnpm preview --host 0.0.0.0 --port $PORT`

4. Add Environment Variables:
   - Go to the service settings → Variables
   - Add `VITE_API_BASE` with your backend URL + `/api`
   - Example: `https://boundary-explorer-backend-production.up.railway.app/api`

5. Deploy the service
6. Note the public URL for your frontend

#### Step 4: Update Backend CORS

1. Go back to your backend service
2. Update the `CORS_ORIGINS` environment variable to include your frontend URL
3. Example: `https://boundary-explorer-frontend-production.up.railway.app`
4. The service will automatically redeploy

### Option 2: Deploy via Railway CLI

```bash
# Login to Railway
railway login

# Link to your project (or create new)
railway link

# Deploy backend
railway up --service backend

# Set backend environment variables
railway variables set CORS_ORIGINS=https://your-frontend.railway.app

# Deploy frontend in a new service
railway service create frontend
railway up --service frontend

# Set frontend environment variables
railway variables set VITE_API_BASE=https://your-backend.railway.app/api
```

## Environment Variables Reference

### Backend Service
| Variable | Description | Example |
|----------|-------------|---------|
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://myapp.railway.app` |
| `PORT` | Auto-set by Railway | `8000` |

### Frontend Service
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE` | Backend API URL with /api path | `https://backend.railway.app/api` |
| `PORT` | Auto-set by Railway | `3000` |

## Configuration Files

The following files have been added for Railway deployment:

- `railway.json` - Backend service configuration for Railpack
- `web/railway.json` - Frontend service configuration for Railpack
- `.env.example` - Example environment variables
- `web/.env.example` - Frontend environment variables

**Note**: Railway now uses Railpack (as of March 2025) instead of the deprecated Nixpacks. The `railway.json` files configure the build and deployment settings for each service.

## Verifying Deployment

1. Visit your frontend URL
2. Check that the app loads
3. Test the country selector - it should fetch data from the backend
4. Search for a place and load a boundary to verify the full flow

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` on backend includes your exact frontend URL (with https://)
- Check Railway logs for the backend service

### API Connection Issues
- Verify `VITE_API_BASE` is set correctly on the frontend
- Ensure it includes the full backend URL with `/api` path
- Check that backend service is running (view logs in Railway dashboard)

### Build Failures
- Check Railway build logs
- Ensure all dependencies are in `package.json` and `pyproject.toml`
- Verify Python version is >= 3.10

### Service Crashes
- View Railway logs for error messages
- Check healthcheck endpoint: `https://your-backend.railway.app/api/health`
- Ensure `PORT` environment variable is being used

### Railpack-Specific Issues

#### "uvicorn: command not found" Error
Railpack installs Python packages into `/app/venv`, and the venv's bin folder may not be in PATH by default. The `railway.json` configuration uses the full path `/app/venv/bin/uvicorn` to resolve this.

If you encounter this error:
1. Verify the `startCommand` in `railway.json` uses the full path: `/app/venv/bin/uvicorn`
2. Check the Railway build logs to confirm dependencies installed correctly
3. You can also modify your start command to activate the venv first: `source /app/venv/bin/activate && uvicorn ...`

#### Python Version Issues
Railpack automatically detects Python version from your project. You can specify a version by:
1. Adding a `.python-version` file with the version number (e.g., `3.11`)
2. Using `runtime.txt` with format `python-3.11`
3. Specifying in `pyproject.toml` under `[project]` → `requires-python`

## Cost Optimization

Railway free tier includes:
- $5 credit per month
- 500 hours of execution time
- 100 GB egress

To optimize:
- Use Railway's sleep feature for inactive services
- Monitor usage in Railway dashboard
- Consider upgrading for production workloads

## Custom Domains

To add a custom domain:
1. Go to service settings → Domains
2. Click "Add Domain"
3. Follow Railway's instructions to configure DNS
4. Update `CORS_ORIGINS` and `VITE_API_BASE` accordingly

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: [Your GitHub Issues URL]
