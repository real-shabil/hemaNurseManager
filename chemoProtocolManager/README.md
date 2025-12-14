# Chemo Protocol Manager

A serverless web interface for managing Chemotherapy Protocols (`chemoProtocols.json`).

## Features
- **Offline / Serverless**: Runs entirely in the browser using HTML5 APIs.
- **Protocol Management**: Add, Edit, and Delete diseases, phases, and protocols.
- **Data Persistence**: Load local JSON files and download updated versions.

## Quick Start
1. **Open**: Double-click `index.html` in your browser.
2. **Load**: Select your `chemoProtocols.json` file in the sidebar.
3. **Edit**: Use the UI to manage diseases and protocols.
4. **Save**: Click **Download JSON** to save `updated_chemoProtocols.json`.

## Tech Stack
- **Core**: HTML5, CSS3, Vanilla JavaScript
- **Data**: JSON (Browser-based FileReader/Blob)
