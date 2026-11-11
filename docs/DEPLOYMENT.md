# PRODUCTION DEPLOYMENT & INSTALLATION GUIDE

## 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- PostgreSQL 14+ (or Docker Compose)

## 2. Environment Variables Configuration
Create `.env` in the root and `backend/.env`:
```ini
PROJECT_NAME="AVD Group Management Platform"
API_V1_STR="/api"
SECRET_KEY="your-production-secret-jwt-key"
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database Configuration
# Local SQLite:
DATABASE_URL="sqlite:///./avd_crm.db"
# Production PostgreSQL (Supabase / AWS RDS):
# DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

UPLOAD_DIR="./uploads"
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
```

## 3. Running with Docker Compose (Recommended)
```bash
docker-compose up --build -d
```
Access points:
- Frontend: `http://localhost:5173`
- Backend API Docs: `http://localhost:8000/api/docs`

## 4. Manual Local Execution

### Backend:
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python run.py       # Seeds initial roles, companies, test users, and projects
python server.py    # Starts FastAPI server on http://127.0.0.1:8000
```

### Frontend:
```bash
cd frontend
npm install
npm run build      # Verifies TypeScript & Vite production bundle
npm run dev        # Launches Vite development server on http://localhost:5173
```

