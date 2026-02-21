# Deploy (Backend on Render, Frontend on Vercel)

## 1) Push code to GitHub
This repo already has remote `origin` configured.

## 2) Deploy backend on Render (single service)
1. Open Render Dashboard.
2. Click **New +** -> **Blueprint**.
3. Select this GitHub repo.
4. Render will detect `render.yaml` and create only one service:
   - `ai-resume-analyzer-api` (Node backend)

## 3) Set backend environment variables (Render)
In `ai-resume-analyzer-api` service:
- `MONGO_URI`
- `OPENAI_API_KEY`

## 4) Verify backend
- Health: `https://<your-backend-service>.onrender.com/health`
- API base to use in frontend: `https://<your-backend-service>.onrender.com/api`

## 5) Deploy frontend on Vercel
1. Import the same GitHub repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite** (auto-detected usually).
4. Add Environment Variable:
   - `VITE_API_BASE_URL` = `https://<your-backend-service>.onrender.com/api`
5. Deploy.

## 6) Verify frontend
- Open Vercel URL.
- Upload a resume and confirm API calls are hitting Render backend.
