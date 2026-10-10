@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  echo Installing CampusConnect dependencies...
  call npm install
  if errorlevel 1 goto error
)
echo Starting CampusConnect. Open http://localhost:3000 in your browser.
call npm start
goto end
:error
echo Dependency installation failed. Install Node.js 20+ and run npm install from this folder.
:end
pause
