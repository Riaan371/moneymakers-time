@echo off
REM MoneyMakers Tracker - staff PC installer
REM Double-click this file on any staff computer. It installs the tracker
REM app (silently, no clicking through screens) and sets it to start
REM automatically on login. The staff member signs in once with their own
REM Money Makers Time email/password the first time it opens.
REM
REM Windows will likely show an "Allow this app to make changes?" prompt -
REM that's normal, click Yes.
REM
REM Usage: copy this .bat file into the SAME folder as the *-setup.exe
REM file produced by the build, then double-click this .bat on the staff PC.

setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set SETUP_EXE=

for %%f in ("%SCRIPT_DIR%*setup.exe" "%SCRIPT_DIR%*Setup.exe") do (
    if exist "%%~f" set SETUP_EXE=%%~f
)

if "%SETUP_EXE%"=="" (
    echo Could not find a *-setup.exe file next to this script.
    echo Make sure the installer .exe was copied into this same folder.
    pause
    exit /b 1
)

echo Installing MoneyMakers Tracker from "%SETUP_EXE%"...
"%SETUP_EXE%" /S

echo.
echo Done. The tracker will start automatically next time this PC logs in,
echo and has been started now - look for its icon in the system tray
echo (bottom-right, may be under the "^" arrow) to sign in.
pause
