# Quantara REAL Production UI Recorder

This package does **not** recreate or imitate Quantara.

It launches Playwright on the Windows PC where your Quantara repository is available and records:
- the real `https://quantara.vistabylara.com` UI,
- a real tutorial client,
- a real tutorial project,
- actual source upload and processing,
- BOQ item entry, save, verification and lock where permitted,
- real document preview/generation,
- the actual TAYQAN page, robot and Hire TAYQAN workflow.

## Privacy
Login happens in a separate browser context **before video recording begins**. The script never asks for or stores your password.
A temporary authenticated browser state file is deleted at the end.

## Run
1. Extract these files.
2. Copy the three files into your Quantara repository root.
3. In PowerShell:
   cd "$env:USERPROFILE\Desktop\quantara-ai-boq"
   powershell -ExecutionPolicy Bypass -File .\RUN_REAL_QUANTARA_RECORDING.ps1
4. Login in the browser window.
5. The recording starts automatically after Quantara reaches `/dashboard`.

Output:
`tutorial-recording\final\Quantara_REAL_UI_Tutorial_<timestamp>.webm`

If FFmpeg is installed, the script also creates MP4 automatically.

The script uses the current Quantara UI labels and routes verified from the repository. If production blocks a particular action (verification, lock, commercial requirement, worker status), the recording preserves the **real production state** instead of faking a successful screen.
