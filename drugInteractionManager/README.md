# Drug Interaction Manager

A serverless web interface for managing IV Drug Compatibility data (`drugInteractions.json`).

## Features
- **Offline / Serverless**: Runs entirely in the browser using HTML5 APIs.
- **Compatibility Tracking**: Manage Y-Site, Admixture, Syringe, and Solution data.
- **Smart Notes**: Auto-generates clinical notes based on compatibility inputs.
- **Data Persistence**: Load local JSON files and download updated versions.

## Quick Start
1. **Open**: Double-click `index.html` in your browser.
2. **Load**: Select your `drugInteractions.json` file in the sidebar.
3. **Edit**: Add or modify drug pairs and their compatibility details.
4. **Save**: Click **Download JSON** to save `updated_drugInteractions.json`.

## Tech Stack
- **Core**: HTML5, CSS3, Vanilla JavaScript
- **Data**: JSON (Nested Matrix Format)
