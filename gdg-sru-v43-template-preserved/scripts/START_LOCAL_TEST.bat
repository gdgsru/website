@echo off
setlocal
cd /d "%~dp0.."
echo Starting GDG SRU website at http://localhost:3000/
echo Keep this window open while testing. Press Ctrl+C to stop the server.
py -m http.server 3000 --directory "%~dp0..\site"
if errorlevel 1 (
  echo.
  echo The local server could not start. Port 3000 may already be in use.
  echo Stop the old server with Ctrl+C, then run this file again.
  pause
)
endlocal
