# Document Management Repository (DMR)

A centralized, intelligent document management system that automatically classifies, tags, and routes documents using AI, while providing robust access control, organization management, and a modern user interface.

## Key Features

- **AI-Powered Auto-Tagging**: Integrates with the Groq API (LLaMA 3) to automatically extract metadata from uploaded PDFs. Features an on-demand AI toggle for triggering analysis across any space.
- **Advanced Manual Tagging**: Granular tag manipulation engine supporting UI input and natively robust multipart form arrays, enabling comprehensive document labeling.
- **Developer API**: Secure `x-api-key` programmatic ingress endpoints. Allows applications to upload documents directly via scripts, utilizing natively parsed automated tagging parameters.
- **Robust Access & Spaces**:
  - **Public Space**: Open access for sharing institutional documents (read-only for non-authenticated users).
  - **Private Space**: Personal repository for user-specific files.
  - **Organizations**: Collaborative spaces with secure role-based access control (Admin, Member, Viewer).
- **Space Transitions & Movement**: Transition documents fluently across Public and Organization spaces with integrated on-demand re-tag workflows.
- **Storage Quotas**: Enforced storage limits per space (500MB Public, 100MB Private per user, 200MB per Organization).
- **Secure File Storage**: Documents are securely uploaded and retrieved natively via AWS S3 interfaces.
- **Advanced Dashboard & UI/UX**: Completely redesigned using responsive Tailwind CSS. Includes visual storage analytics charts, aggregated document metrics, explicit document action routing, and robust Dark/Light mode execution.

## Tech Stack

- **Frontend**: React 18 + Vite, Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **Storage**: AWS S3 (via `@aws-sdk/client-s3`)
- **AI Integration**: Groq API (LLaMA 3) for advanced text analysis and classification
- **File Processing**: `pdf-parse` for text extraction, `multer` for multipart form handling

## Project Structure

```text
DMR/
├── server/
│   ├── server.js              # Express app entry and global middleware
│   ├── config/db.js           # MongoDB connection setup
│   ├── middleware/
│   │   ├── auth.js            # JWT & Dev API Key validation
│   │   └── upload.js          # Multer memory storage configuration
│   ├── models/                # Mongoose models (User, Document, Organization)
│   ├── routes/                # API endpoints
│   │   ├── auth.js            # Authentication workflows
│   │   ├── documents.js       # Core document management & space moves
│   │   ├── orgs.js            # Organization & collaboration management
│   │   ├── public.js          # Unauthenticated public document access
│   │   └── apiKeys.js         # Developer API key provisioning
│   └── services/
│       ├── s3Service.js       # AWS S3 upload/download logic
│       ├── autoTagger.js      # Groq AI prompt and LLM metadata generation
│       └── storageQuota.js    # Strict space-based data quota validations
├── client/
│   ├── src/
│   │   ├── App.jsx            # Main app router
│   │   ├── context/           # Theme Context and Auth Context providers
│   │   ├── components/        # Reusable UI (UploadModal, Sidebar, Navbar)
│   │   ├── pages/             # Route views
│   │   │   ├── Dashboard.jsx  # Aggregated metrics & usage charts
│   │   │   ├── Workspace.jsx  # Primary document hub (Public/Private/Orgs)
│   │   │   ├── Profile.jsx    # User settings and Developer API portal
│   │   │   └── Auth.jsx       # Login & Signup flows
│   │   └── config/api.js      # Global API base URL constants
│   ├── index.css              # Tailwind global styling directives
│   └── tailwind.config.js     # Tailwind setup (colors, dark mode toggle)
```

## Getting Started

### Prerequisites

- Node.js v18+ (recommended: v20)
- MongoDB instance (local or Atlas)
- AWS Account (S3 Bucket credentials)
- Groq API Key

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
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
| `/api/auth` | User registration, login, profile updates, password changes |
| `/api/api-keys` | Generation and destruction of secure Developer upload keys |
| `/api/documents` | Protected routes handling file uploads, space moves, manual/AI re-tagging, deletions |
| `/api/orgs` | Creating organizations, managing collaborative members and access schemas |
| `/api/public` | Read-only endpoints for exposing public documents and global tags securely |

## Team

- Sri Ujwal Srinivas Varma Gunturi
- Gullapalli Madhava Asrith Murthy 
- Divvela Rakesh 
- Bolla Lokesh Reddy
- Kodavatikanti Bhuvan Chandra
- Rongali Mohit Naidu 
