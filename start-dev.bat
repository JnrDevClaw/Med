@echo off
echo Starting MedPlatform Development Environment...
echo.

echo [1/3] Starting Backend Server...
cd /d "C:\Hackathons\Med\backend"
start "Backend Server" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend Development Server...
cd /d "C:\Hackathons\Med\frontend"
start "Frontend Server" cmd /k "npm run dev"

echo [3/3] Development servers are starting...
echo.
echo Backend will be available at: http://localhost:3000
echo Frontend will be available at: http://localhost:5173
echo.
echo Press any key to exit this script (servers will continue running)
pause >nul
