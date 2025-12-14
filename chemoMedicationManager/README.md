# Chemo Medication Manager

A serverless web interface for managing Chemotherapy Drug Information (`chemoMedications.json`).

## Features
- **Offline / Serverless**: Runs entirely in the browser using HTML5 APIs.
- **Drug Management**: Add, Edit, and Delete drug entries and categories.
- **Detailed Fields**: Manage dosage, extravasation risk, nursing info, and warnings.
- **Data Persistence**: Load local JSON files and download updated versions.

## Quick Start
1. **Open**: Double-click `index.html` in your browser.
2. **Load**: Select your `chemoMedications.json` file in the sidebar.
3. **Edit**: Use the UI to manage drug lists and details.
4. **Save**: Click **Download JSON** to save `updated_chemoMedications.json`.

## Tech Stack
- **Core**: HTML5, CSS3, Vanilla JavaScript
- **Data**: JSON (Browser-based FileReader/Blob)
