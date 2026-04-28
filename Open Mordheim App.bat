@echo off
setlocal
cd /d "%~dp0"

echo Starting Mordheim Warband Manager...
echo.

set "NODE_EXE="

for /f "delims=" %%N in ('where node 2^>nul') do (
  set "NODE_EXE=%%N"
  goto :found_node
)

if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)

:found_node
if "%NODE_EXE%"=="" (
  echo Could not find Node.js on this computer.
  echo.
  echo Please install Node.js from https://nodejs.org, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo First-time setup: installing the app files. This may take a few minutes.
  if exist ".tools\package\bin\npm-cli.js" (
    "%NODE_EXE%" ".tools\package\bin\npm-cli.js" install --cache ".npm-cache" --ignore-scripts
  ) else (
    npm install
  )
  echo.
)

start "Mordheim Data Server" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0'; & '%NODE_EXE%' --experimental-sqlite server/index.ts"

timeout /t 3 /nobreak > nul

start "Mordheim App" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0'; & '%NODE_EXE%' node_modules\vite\bin\vite.js --host 127.0.0.1"

echo Opening the app in your browser...
timeout /t 8 /nobreak > nul
start "" "http://127.0.0.1:5173"

echo.
echo Keep the two Mordheim windows open while using the app.
echo Close those windows when you are finished.
echo.
pause
