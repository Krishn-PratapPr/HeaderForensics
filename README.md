# Email Header Analyzer (EHA)

🛡️ **Email Header Analyzer** is a lightweight, responsive, and laser-printer-friendly forensic tool designed to parse electronic mail headers, map server relay hop chains chronologically, detect spoofing anomalies, geolocate originating IPs using parallel provider API calls, and audit security flags in a local persistent SQLite database.

---

## 🛠️ Features

*   **Dual Email Inputs:** Paste raw header texts or drag-and-drop `.eml` files (Max 100KB).
*   **Anomalous Input Filter:** Blocks image/screenshot file uploads.
*   **Security Alignment Checks:** Automatically logs SPF validator results, DKIM signatures, and Domain Mismatches (From vs. Return-Path) to build a cumulative spoofing verdict.
*   **Dual-Source Geolocation:** Queries `ipinfo.io` and `ip-api.com` in parallel (5s timeout) and highlights accuracy discrepancies.
*   **Leaflet.js Map Widget:** Interactive OpenStreetMap mapping showcasing single or multiple pins based on provider consensus.
*   **Reconstructed SMTP Hops:** Displays chronological vertical server paths, collapsing long Received headers.
*   **PDF Forensic Reports:** Generates A4 printer-friendly black-and-white evidence reports.
*   **Historical SQLite Registry:** Database registry of flagged originating IP addresses with search filters, admin password authorization, and CSV exports.

---

## 📂 Project Directory Structure

```text
email-header-analyzer/
├── .env.example                # Template for environment configurations
├── .gitignore                  # Git tracking exclusions
├── README.md                   # Installation & user guides
├── docker-compose.yml          # Multi-container orchestrator
│
├── backend/                    # Flask REST API
│   ├── Dockerfile              # Backend service image build instructions
│   ├── requirements.txt        # Python packages list
│   ├── app.py                  # API service routes and sqlite logic
│   ├── .env                    # Local admin secret key config (Git ignored)
│   ├── instance/               
│   │   └── registry.db         # Persistent SQLite database (Git ignored)
│   └── core/                   # Processing logic modules
│       ├── parser.py           # Extracting header dictionary
│       ├── geolocation.py      # ThreadPool parallel API queries
│       ├── analyzer.py         # Chronological hops and authenticity verdict
│       └── report_builder.py   # ReportLab PDF building
│
└── frontend/                   # React Single Page App
    ├── Dockerfile              # Frontend client Nginx build instructions
    ├── nginx.conf              # SPA route router configurations
    ├── package.json            # Node.js dependencies
    ├── vite.config.js          # Vite web server settings
    ├── tailwind.config.js      # Tailwind CSS styling guidelines
    ├── postcss.config.js       # PostCSS module setup
    ├── index.html              # Vite injection document template
    └── src/
        ├── main.jsx            # DOM loader
        ├── App.jsx             # Nav links & view layouts
        ├── index.css           # Custom styles & leaflet styles imports
        ├── api/                
        │   └── axiosConfig.js  # Centralized Axios setup
        ├── components/         # Forensic layout blocks
        │   ├── HeaderInput.jsx
        │   ├── HopTimeline.jsx
        │   ├── MapWidget.jsx
        │   └── ConfidenceBadge.jsx
        └── pages/              # Primary views
            ├── Dashboard.jsx   # Forensic analysis panel
            └── Registry.jsx    # Flagged database viewer
```

---

## 🐳 Docker Deployment (Recommended)

To run the entire suite immediately inside container isolation:

### Prerequisites
*   [Docker & Docker Compose](https://docs.docker.com/engine/install/)

### 🚀 Booting Up
1.  **Configure Environment:** Copy `.env.example` as `.env` at the root folder:
    ```bash
    cp .env.example .env
    ```
    Open `.env` and set a secure value for `ADMIN_SECRET_KEY` (used to flag and delete IPs).

2.  **Spin Up Containers:** Launch both frontend and backend services:
    ```bash
    docker compose up --build -d
    ```
    *   **Backend API** is exposed at: `http://localhost:5000`
    *   **Frontend UI** is exposed at: `http://localhost:3000`

3.  **Shutdown:**
    ```bash
    docker compose down
    ```

---

## 🖥️ Manual Bare-Metal Setup

Follow these steps if you want to run the applications directly on your host operating system.

### Part 1: Python Flask Backend

1.  **Navigate & Create Virtual Environment:**
    ```bash
    cd backend
    python -m venv venv
    ```

2.  **Activate Virtual Environment:**
    *   *Windows PowerShell:* `venv\Scripts\Activate.ps1`
    *   *macOS/Linux:* `source venv/bin/activate`

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure `.env` File:** Create a `.env` file inside the `backend/` directory:
    ```ini
    ADMIN_SECRET_KEY=your_secure_password
    PORT=5000
    ```

5.  **Run Development Server:**
    ```bash
    python app.py
    ```
    The backend will start at `http://localhost:5000`.

---

### Part 2: React Frontend

1.  **Navigate & Install Packages:**
    ```bash
    cd ../frontend
    npm install
    ```

2.  **Configure API URL (Optional):**
    By default, the client points to `http://localhost:5000`. To target a custom URL, create a `.env` file in `frontend/`:
    ```ini
    VITE_API_URL=http://your-custom-backend-domain:5000
    ```

3.  **Run Local Dev Server:**
    ```bash
    npm run dev
    ```
    Open your browser and navigate to the printed URL (typically `http://localhost:3000` or `http://localhost:5173`).
