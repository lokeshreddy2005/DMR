# Document Management Repository (DMR)

A centralized, intelligent document management system that automatically classifies and routes documents into organized vaults using keyword-based auto-tagging.

## 🚀 Sprint 2 — Smart Upload System

The Smart Upload workflow accepts raw PDF documents, analyzes their content, and automatically stores them in the correct vault (Finance, HR, or Project) without manual sorting.

### Deliverables

| Feature | Description |
|---|---|
| **Smart Upload Interface** | React-based drag-and-drop zone for PDF uploads |
| **Auto-Tagging Service** | Node.js utility using `pdf-parse` to scan files for keywords and classify them |
| **Vault Router** | Backend logic that maps tags to MongoDB collections |
| **Prototype Dashboard** | Dashboard showing documents grouped by their assigned vault categories |

### Architecture

```
User uploads PDF
       ↓
  [Auto-Tagger]  ← pdf-parse extracts text → keyword matching
       ↓
  [Vault Router] ← maps tag → vault (Finance / HR / Project)
       ↓
  [MongoDB]      ← stores document metadata + classification
       ↓
  [Dashboard]    ← displays documents by vault
```

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **Database**: MongoDB (in-memory via `mongodb-memory-server` for development)
- **File Processing**: `pdf-parse` for text extraction
- **File Upload**: `multer` for multipart form handling

## 📦 Project Structure

```
DMR/
├── server/
│   ├── server.js              # Express server (port 5000)
│   ├── config/db.js           # MongoDB connection
│   ├── models/Document.js     # Document schema
│   ├── services/
│   │   ├── autoTagger.js      # PDF keyword scanner
│   │   └── vaultRouter.js     # Tag-to-vault routing
│   └── routes/documents.js    # API routes
├── client/
│   ├── src/
│   │   ├── App.jsx            # Main app with tab navigation
│   │   └── components/
│   │       ├── SmartUpload.jsx # Drag-and-drop upload
│   │       └── Dashboard.jsx  # Vault dashboard
│   └── vite.config.js         # Vite config with API proxy
└── SWE___Sprint_0.pdf         # Sprint documentation
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+ (recommended: v20)
- npm

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
npm start
# Server runs on http://localhost:5000

# Terminal 2 — Start client
cd client
npm run dev
# App runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a PDF — auto-tags and routes to vault |
| `GET` | `/api/documents` | List all documents (filter with `?vault=finance`) |
| `GET` | `/api/documents/stats` | Get document count per vault |
| `GET` | `/api/health` | Health check |

## 🏷 Auto-Tagging Keywords

| Vault | Keywords |
|---|---|
| **Finance** | invoice, receipt, budget, expense, revenue, payment, tax, financial, accounting, billing... |
| **HR** | employee, salary, leave, hiring, resume, onboarding, payroll, benefits, recruitment... |
| **Project** | project, milestone, deadline, deliverable, sprint, task, timeline, scope, requirement... |

## 👥 Team

- Ujwal
- Madhava
- Rakesh
- Lokesh
- Bhuvan
- Mohit

## 📄 License

This project is for academic purposes.
