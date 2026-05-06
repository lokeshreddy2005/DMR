# Document Management Repository (DMR)

A centralized, intelligent document management system that automatically classifies, tags, and routes documents using AI, while providing robust access control, organization management, system governance, and a modern user interface.

## Key Features

- **AI-Powered Auto-Tagging**: Integrates with the Groq API (LLaMA 3) to automatically extract metadata from uploaded PDFs. Features an on-demand AI toggle for triggering analysis across any space.
- **Dynamic Vault Routing**: AI automatically categorizes and routes documents into predefined but dynamically manageable Vaults based on semantic relevance.
- **Zero-Memory Compression**: Text-based files are compressed on-the-fly using `zlib` directly to AWS S3, drastically reducing cloud storage costs.
- **Redis Caching**: Built-in graceful Redis caching for AWS S3 pre-signed URLs to drastically improve TTFB on document previews and downloads.
- **Robust Access & Spaces**:
  - **Public Space**: Open access for sharing institutional documents (read-only for non-authenticated users).
  - **Private Space**: Personal repository for user-specific files.
  - **Organizations**: Collaborative spaces with secure role-based access control (Admin, Member, Viewer).
- **Google Docs-Style Link Sharing**: Generate secure, tokenized URLs for documents with configurable access modes (`Restricted`, `Organization`, `Anyone`) and roles (`Viewer`, `Collaborator`).
- **System Governance & Administration**: 
  - Centralized **Super Admin Dashboard** providing system-wide analytics.
  - Full CRUD control over Users, Organizations, and Vault Categories.
  - Ability to override storage limits per user or per organization globally.
  - Content moderation with authorized access to view and delete private space documents.
- **Storage Quotas**: Enforced storage limits per space (defaulting to 100MB Private, 500MB Organization), managed natively via MongoDB aggregation.
- **Soft Deletion & Trash**: Documents are soft-deleted to a Trash bin and automatically purged permanently after 30 days via a background `node-cron` job.
- **Developer API**: Secure `x-api-key` programmatic ingress endpoints. Allows applications to upload documents directly via scripts.
- **Advanced Dashboard & UI/UX**: Responsive Tailwind CSS UI featuring visual storage analytics charts, aggregated document metrics, modal-driven workflows, and robust Dark/Light mode.

## Tech Stack

- **Frontend**: React 18 + Vite, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **Caching Layer**: Redis (ioredis)
- **Storage**: AWS S3 (via `@aws-sdk/client-s3`)
- **AI Integration**: Groq API (LLaMA 3) for advanced text analysis and classification
- **File Processing**: `pdf-parse` for text extraction, `multer` for multipart form handling, `zlib` for compression

## Project Structure

```text
DMR/
├── server/
│   ├── server.js              # Express app entry and cron job init
│   ├── config/db.js           # MongoDB connection setup
│   ├── config/redisClient.js  # Redis connection and graceful fallback
│   ├── middleware/
│   │   ├── auth.js            # JWT, Role enforcement & API Key validation
│   │   └── upload.js          # Multer memory storage configuration
│   ├── models/                # Mongoose schemas (User, Document, Organization, Vault)
│   ├── routes/                
│   │   ├── admin.js           # System Governance and Super Admin workflows
│   │   ├── auth.js            # Authentication workflows
│   │   ├── documents.js       # Core document management, link sharing & spaces
│   │   ├── organizations.js   # Organization & collaboration management
│   │   ├── external.js        # Developer API endpoints via x-api-key
│   │   └── public.js          # Unauthenticated public document access
│   └── services/
│       ├── s3Service.js       # AWS S3 upload/download and streaming compression
│       ├── autoTagger.js      # Groq AI prompt and LLM metadata generation
│       └── storageQuota.js    # Strict space-based data quota validations
├── client/
│   ├── src/
│   │   ├── App.jsx            # Main app router
│   │   ├── context/           # Theme Context and Auth Context providers
│   │   ├── components/        # Reusable UI (Modals, Sidebar, Navbar, Toast)
│   │   ├── pages/             
│   │   │   ├── Dashboard.jsx  # Aggregated metrics & usage charts (User)
│   │   │   ├── SuperAdminDashboard.jsx # System Governance Hub (Admin)
│   │   │   ├── Workspace.jsx  # Primary document hub (Public/Private/Orgs)
│   │   │   └── Auth.jsx       # Login & Signup flows
│   │   └── utils/api.js       # Global Axios instance with Client-Side caching
│   ├── index.css              # Tailwind global styling directives
│   └── tailwind.config.js     # Tailwind setup (colors, dark mode toggle)
```

## Getting Started

### Prerequisites

- Node.js v18+ (recommended: v20)
- MongoDB instance (local or Atlas)
- Redis instance (optional, degrades gracefully)
- AWS Account (S3 Bucket credentials)
- Groq API Key

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
REDIS_URL=your_redis_connection_string
JWT_SECRET=your_jwt_secret
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
S3_BUCKET_NAME=your_s3_bucket_name
GROQ_API_KEY=your_groq_api_key
```

### Installation

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Running the Application

```bash
# Terminal 1 — Start server
cd server
npm run dev
# Server runs on http://localhost:5000

# Terminal 2 — Start client
cd client
npm run dev
# App runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## Core API Structure

| Route Prefix | Description |
|---|---|
| `/api/auth` | User registration, login, profile updates |
| `/api/admin` | Protected routes for System Admins (Users, Orgs, Vaults CRUD & Stats) |
| `/api/documents` | Protected routes handling file uploads, space moves, sharing, soft deletions |
| `/api/organizations` | Creating organizations, managing collaborative members |
| `/api/external` | Programmatic secure endpoints for external scripts (`x-api-key`) |
| `/api/public` | Read-only endpoints for exposing public documents securely |

## Team

- Sri Ujwal Srinivas Varma Gunturi
- Gullapalli Madhava Asrith Murthy 
- Divvela Rakesh 
- Bolla Lokesh Reddy
- Kodavatikanti Bhuvan Chandra
- Rongali Mohit Naidu 

