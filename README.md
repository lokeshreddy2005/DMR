# Document Management Repository (DMR)

A centralized, intelligent document management system that automatically classifies, tags, and routes documents using AI, while providing robust access control, organization management, and a modern user interface.

## Key Features

- **AI-Powered Auto-Tagging**: Integrates with the Groq API (LLaMA 3) to automatically extract metadata from uploaded PDFs, including primary domain, sensitivity level, document type, and contextual keywords.
- **Robust Access Control**:
  - **Public Space**: Open access for sharing institutional documents (read-only for non-authenticated users).
  - **Private Space**: Personal repository for user-specific files.
  - **Organizations**: Collaborative spaces with role-based access control (Admin, Member, Viewer).
- **Storage Quotas**: Enforced storage limits per space (500MB Public, 100MB Private per user, 200MB per Organization).
- **Secure File Storage**: Documents are securely uploaded and retrieved using AWS S3.
- **Advanced Search & Filtering**: Search across titles, descriptions, and AI-generated tags via an intuitive UI.
- **Responsive UI/UX**: Completely redesigned using Tailwind CSS, featuring a responsive layout, and a fully supported Dark/Light mode toggle.

## Tech Stack

- **Frontend**: React 18 + Vite, Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **Storage**: AWS S3 (via `@aws-sdk/client-s3`)
- **AI Integration**: Groq API (LLaMA 3) for advanced text analysis and classification
- **File Processing**: `pdf-parse` for text extraction, `multer` for multipart form handling

## Project Structure

```
DMR/
├── server/
│   ├── server.js              # Express app and route mounting
│   ├── config/db.js           # MongoDB connection
│   ├── models/                # Mongoose models (User, Document, Organization)
│   ├── routes/                # API endpoints (auth, documents, orgs, public)
│   ├── services/
│   │   ├── s3Service.js       # AWS S3 upload/download/delete handlers
│   │   ├── autoTagger.js      # Groq API integration for metadata extraction
│   │   └── storageQuota.js    # Quota validation logic
├── client/
│   ├── src/
│   │   ├── App.jsx            # Main app router & theme provider
│   │   ├── context/           # Theme and Auth Context providers
│   │   └── components/        # React components (Dashboard, Login, Signup, UploadModal)
│   ├── index.css              # Tailwind global directives
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   └── vite.config.js         # Vite config with backend proxy
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
| `/api/documents` | Protected routes for uploading, retrieving, deleting, and making documents public |
| `/api/orgs` | Creating organizations, managing members and access roles |
| `/api/public` | Read-only endpoints for accessing public documents and global tags without authentication |

## Team

- Sri Ujwal Srinivas Varma Gunturi
- Gullapalli Madhava Asrith Murthy 
- Divvela Rakesh 
- Bolla Lokesh Reddy
- Kodavatikanti Bhuvan Chandra
- Rongali Mohit Naidu 
