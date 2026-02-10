#!/bin/bash

# Function to kill processes on exit
cleanup() {
  echo "Stopping servers..."
  if [ -n "$BACKEND_PID" ]; then kill $BACKEND_PID; fi
  if [ -n "$FRONTEND_PID" ]; then kill $FRONTEND_PID; fi
  exit
}

# Trap SIGINT (Ctrl+C)
trap cleanup SIGINT

echo "maxcavator: Starting Setup..."

# --- Backend Setup ---
echo "--- Backend Setup ---"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    if [ -f "requirements.txt" ]; then
        echo "Installing backend dependencies..."
        pip install -r requirements.txt
    else
        echo "Warning: requirements.txt not found."
    fi
else
    source venv/bin/activate
fi

# Ensure dependencies are installed even if venv exists (for updates)
if [ -f "requirements.txt" ]; then
    # Silent install check
    pip install -r requirements.txt > /dev/null 2>&1 &
fi

echo "Starting Backend Server..."
python main.py &
BACKEND_PID=$!
cd ..

# --- Frontend Setup ---
echo "--- Frontend Setup ---"
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies (this may take a while)..."
    npm install
fi

echo "Starting Frontend Server..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo "---------------------------------------------------"
echo "        M A X C A V A T O R   S T A R T E D        "
echo "---------------------------------------------------"
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both servers."

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
