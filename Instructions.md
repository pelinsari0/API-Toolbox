## Terminal A
cd backend

# Create virtual environment
python3 -m venv .venv

# Activate environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend
uvicorn app.main:app --reload --port 8080

## Terminal B
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
•	http://127.0.0.1:5173