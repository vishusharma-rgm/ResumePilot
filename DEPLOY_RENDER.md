# Deploy on Render

## 1) Push code to GitHub
This repo already has remote `origin` configured.

## 2) Create Render Blueprint
1. Open Render Dashboard.
2. Click **New +** -> **Blueprint**.
3. Select this GitHub repo.
4. Render will detect `render.yaml` and create 2 services:
   - `ai-resume-analyzer-api` (Node backend)
   - `ai-resume-analyzer-frontend` (Static Vite frontend)

## 3) Set environment variables
In Render dashboard:

### Backend service (`ai-resume-analyzer-api`)
- `MONGO_URI`
- `OPENAI_API_KEY`

### Frontend service (`ai-resume-analyzer-frontend`)
- `VITE_API_BASE_URL` = `https://<your-backend-service>.onrender.com/api`

## 4) Trigger deploy
Click **Manual Deploy -> Deploy latest commit** for both services (or wait for auto deploy).

## 5) Verify
- Backend health: `https://<backend>.onrender.com/health`
- Frontend: `https://<frontend>.onrender.com`
