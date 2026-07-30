# CloudData Guardian
Intelligent Data Redundancy Detection System — Enterprise SaaS

## Tech Stack
- Frontend: React + TypeScript + Vite + Tailwind CSS + TanStack Query
- Backend: Node.js + Express + TypeScript + Mongoose
- Database: MongoDB Atlas
- Cache: Redis
- Deployment: Vercel (Frontend) + Render (Backend)

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB Atlas cluster
- Redis (local or managed)

### Setup
```bash
# Clone and install
git clone <repo-url>
cd "Cloud Data Guardian"

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your MongoDB Atlas URI

# Start development
docker-compose up -d mongodb redis
cd server && npm run dev
cd client && npm run dev
```

### Environment Variables
See `server/.env.example` for all required variables.

## API Documentation
Base URL: `http://localhost:3001/api/v1`

## Features
- Exact duplicate detection via SHA-256 hashing
- Fuzzy matching (Jaro-Winkler, Levenshtein, Cosine)
- Schema validation with Zod/Joi
- Real-time analytics dashboard
- CSV/JSON bulk ingestion
- PDF/Excel/CSV report generation
- Multi-tenant isolation
- Role-based access control

## License
MIT
