
let INTERACTIONS = []; // Array of objects
let EDIT_INDEX = null; // Index of item being edited, null if adding new

document.addEventListener('DOMContentLoaded', () => {
    // File Input
    document.getElementById('jsonFileInput').addEventListener('change', handleFileUpload);

    // Search
    document.getElementById('searchInput').addEventListener('input', renderList);

    // Buttons
    document.getElementById('addInteractionBtn').addEventListener('click', openAddModal);
    document.getElementById('downloadBtn').addEventListener('click', downloadJSON);

    // Modal
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('saveModalBtn').addEventListener('click', saveFromModal);

    // Modal Inputs: Listen for changes to auto-update note
    document.querySelectorAll('.compat-select').forEach(sel => {
        sel.addEventListener('change', updateAutoNote);
    });

    enableControls(false);
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);

            INTERACTIONS = [];

            // Case 1: Nested Matrix (Python Script Format)
            if (typeof json === 'object' && !Array.isArray(json)) {
                if (confirm("Loaded IV Compatibility Matrix. Enhance data structure?")) {
                    Object.keys(json).forEach(drugA => {
                        const subMap = json[drugA];
                        if (typeof subMap === 'object') {
                            Object.keys(subMap).forEach(drugB => {
                                const data = subMap[drugB];

                                // Store FULL data structure
                                INTERACTIONS.push({
                                    drugA: drugA,
                                    drugB: drugB,
                                    compatibility: data.compatibility || {},
                                    note: data.notes || '',
                                    source: data.source || '',
                                    lastUpdated: new Date().toISOString()
                                });
                            });
                        }
                    });
                }
            }
            // Case 2: Linear List (Existing App Format)
            else if (Array.isArray(json)) {
                // If loading a previously saved "list" from this app, try to restore detailed fields
                INTERACTIONS = json.map(item => ({
                    drugA: item.drugA,
                    drugB: item.drugB,
                    compatibility: item.compatibility || {}, // Restore if exists
                    note: item.note || item.mechanism || '', // Fallback: old 'mechanism' becomes 'note'
                    source: item.source || '',
                    lastUpdated: item.lastUpdated
                }));
            }

            enableControls(true);
            showMainView();
            renderList();
            updateDrugDatalist();
            showStatus("");
        } catch (err) {
            console.error(err);
            alert("Invalid JSON file.");
        }
    };
    reader.readAsText(file);
}

function enableControls(enabled) {
    document.getElementById('addInteractionBtn').disabled = !enabled;
    document.getElementById('downloadBtn').disabled = !enabled;
    document.getElementById('searchInput').disabled = !enabled;
}

function showMainView() {
    document.getElementById('welcomeView').hidden = true;
    document.getElementById('mainView').hidden = false;
}

function renderList() {
    const tbody = document.getElementById('interactionsTableBody');
    tbody.innerHTML = '';
    const term = document.getElementById('searchInput').value.toLowerCase();

    function getSeverity(compat) {
        const vals = Object.values(compat || {}).map(v => (v || '').toLowerCase());
        if (vals.includes('incompatible')) return 'severe';
        if (vals.includes('variable')) return 'moderate';
        if (vals.includes('compatible')) return 'mild';
        return 'mild'; // Default
    }

    const filtered = INTERACTIONS.filter(item => {
        const text = `${item.drugA} ${item.drugB} ${item.note}`.toLowerCase();
        return text.includes(term);
    });

    if (filtered.length === 0) {
        document.getElementById('noResults').style.display = 'block';
    } else {
        document.getElementById('noResults').style.display = 'none';

        filtered.forEach((item, index) => {
            // We use the actual index in the MAIN array for editing/deleting if we search
            // So we need to find the real index.
            const realIndex = INTERACTIONS.indexOf(item);
            const sev = getSeverity(item.compatibility);
            const sevLabel = sev === 'severe' ? 'Incompatible' : sev === 'moderate' ? 'Variable' : 'Compatible';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.drugA}</strong> + <strong>${item.drugB}</strong></td>
                <td><span class="severity-badge severity-${sev}">${sevLabel}</span></td>
                <td>
                    ${item.note || '—'}
                    ${item.source ? `<br><small style="color:#666;">Source: ${item.source}</small>` : ''}
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="openEditModal(${realIndex})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteInteraction(${realIndex})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ===================== CRUD & LOGIC =====================

function openAddModal() {
    EDIT_INDEX = null;
    document.getElementById('modalTitle').textContent = "Add IV Compatibility";
    clearModalInputs();
    document.getElementById('modal').classList.add('open');
    updateAutoNote(); // Generate initial note for new entry
}

function openEditModal(index) {
    EDIT_INDEX = index;
    const item = INTERACTIONS[index];
    const comp = item.compatibility || {};

    document.getElementById('modalTitle').textContent = "Edit IV Compatibility";
    document.getElementById('inputDrugA').value = item.drugA || "";
    document.getElementById('inputDrugB').value = item.drugB || "";

    // Set Compatibility Selects
    document.getElementById('inputYSite').value = comp.ySite || "";
    document.getElementById('inputAdmixture').value = comp.admixture || "";
    document.getElementById('inputSyringe').value = comp.syringe || "";
    document.getElementById('inputSolution').value = comp.solution || "";

    document.getElementById('inputNote').value = item.note || "";
    document.getElementById('inputSource').value = item.source || "";

    document.getElementById('modal').classList.add('open');
    updateAutoNote(); // Update note based on loaded values
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
}

function clearModalInputs() {
    document.getElementById('inputDrugA').value = "";
    document.getElementById('inputDrugB').value = "";
    document.querySelectorAll('.compat-select').forEach(s => s.value = "");
    document.getElementById('inputNote').value = "";
    document.getElementById('inputSource').value = "Trissel’s 2 IV Compatibility";
}

function updateAutoNote() {
    const comp = {
        ySite: document.getElementById('inputYSite').value,
        admixture: document.getElementById('inputAdmixture').value,
        syringe: document.getElementById('inputSyringe').value,
        solution: document.getElementById('inputSolution').value
    };
    const drugA = document.getElementById('inputDrugA').value || 'Drug A';
    document.getElementById('inputNote').value = generateAutoNote(comp, drugA);
}

// Ported from Python Script
function generateAutoNote(compat, drugName) {
    const vals = [compat.solution, compat.ySite, compat.syringe, compat.admixture]
        .map(v => v || "No Data");

    const [solution, ysite, syringe, admixture] = vals;

    // TIER 1: Core Y-Site
    let core = "Y-site data unavailable — prefer a separate line unless other routes strongly support compatibility.";
    if (ysite === "Compatible") core = "Y-site compatible — co-administration may proceed if no precipitation is observed.";
    else if (ysite === "Incompatible") core = "Y-site incompatible — MUST use a separate line regardless of other routes.";
    else if (ysite === "Variable") core = "Y-site variable — co-administration requires close monitoring for precipitation or color change.";
    else if (vals.every(v => v === "No Data")) core = "No compatibility data available — use a dedicated line for safety.";

    // TIER 2: Modifiers
    let modifiers = [];
    if (solution === "Compatible") modifiers.push(`Solution: Compatible — this medication is compatible with ${drugName}.`);
    else if (solution === "Incompatible") modifiers.push(`Solution: Incompatible — do not prepare or infuse this medication in ${drugName}.`);
    else if (solution === "Variable") modifiers.push(`Solution: Variable — use caution when preparing this medication in ${drugName}.`);

    if (syringe === "Incompatible") modifiers.push("Do not mix in syringe due to syringe-level incompatibility.");

    if (admixture === "Incompatible") modifiers.push("Do not combine in admixture due to bag-level incompatibility.");
    else if (admixture === "Variable") modifiers.push("Admixture data is variable — avoid combining unless clearly indicated.");

    // TIER 3: Summary
    let summary = "Overall: Limited or mixed information — safest to use a dedicated line.";
    if (vals.some(v => v === "Incompatible")) summary = "Overall: At least one route is incompatible — separate-line administration is preferred.";
    else if (vals.every(v => v === "Compatible")) summary = "Overall: All available routes show compatibility.";
    else if (vals.some(v => v === "Variable")) summary = "Overall: Mixed or variable evidence — monitor closely if co-administered.";
    else if (vals.every(v => v === "Compatible" || v === "No Data")) summary = "Overall: Compatible, but missing data warrants caution.";

    return `${core} ${modifiers.join(' ')} ${summary}`;
}

function saveFromModal() {
    const drugA = document.getElementById('inputDrugA').value.trim();
    const drugB = document.getElementById('inputDrugB').value.trim();
    const note = document.getElementById('inputNote').value.trim();
    const source = document.getElementById('inputSource').value.trim();

    // Build Compatibility Object
    const compatibility = {
        ySite: document.getElementById('inputYSite').value || undefined,
        admixture: document.getElementById('inputAdmixture').value || undefined,
        syringe: document.getElementById('inputSyringe').value || undefined,
        solution: document.getElementById('inputSolution').value || undefined
    };

    if (!drugA || !drugB) {
        alert("Drug A and Drug B are required.");
        return;
    }

    // Validation: Check for duplicates
    // We check if A+B or B+A exists already, EXCLUDING the current item if editing.
    const duplicate = INTERACTIONS.find((item, idx) => {
        if (EDIT_INDEX !== null && idx === EDIT_INDEX) return false; // Ignore self
        const pair = [item.drugA.toLowerCase(), item.drugB.toLowerCase()].sort().join('|');
        const newPair = [drugA.toLowerCase(), drugB.toLowerCase()].sort().join('|');
        return pair === newPair;
    });

    if (duplicate) {
        alert(`Interaction between ${drugA} and ${drugB} already exists.`);
        return;
    }

    const newItem = {
        drugA,
        drugB,
        compatibility,
        note,
        source,
        lastUpdated: new Date().toISOString()
    };

    // Note: The Python script saves bi-directionally (A->B and B->A).
    // For this list-based app, we'll just add the single entry the user created.
    // If they want B->A, they can add it or we can auto-add it.
    // Let's stick to single entry for clarity unless requested.

    if (EDIT_INDEX === null) {
        INTERACTIONS.push(newItem);
    } else {
        INTERACTIONS[EDIT_INDEX] = newItem;
    }

    closeModal();
    renderList();
    updateDrugDatalist();
    markUnsaved();
}

function deleteInteraction(index) {
    if (confirm("Are you sure you want to delete this interaction?")) {
        INTERACTIONS.splice(index, 1);
        renderList();
        updateDrugDatalist();
        markUnsaved();
    }
}

// ===================== SAVE =====================

function downloadJSON() {
    if (!INTERACTIONS) return;

    // OPTION: Export back to Nested Matrix (Python Compatible)
    // To maintain full circular compatibility with the Python script, we should re-nest it.

    const nestedData = {};
    INTERACTIONS.forEach(item => {
        if (!nestedData[item.drugA]) nestedData[item.drugA] = {};

        // Reconstruct the entry object
        nestedData[item.drugA][item.drugB] = {
            compatibility: item.compatibility,
            notes: item.note,
            source: item.source
        };
    });

    const dataStr = JSON.stringify(nestedData, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "updated_drugInteractions.json";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);

    showStatus("Downloaded (Matrix Format)!", "green");
    setTimeout(() => showStatus(""), 3000);
}

function updateDrugDatalist() {
    const drugs = new Set();
    const IGNORE_KEYS = ['schemaVersion', 'biDirectional', 'compatibilityKeys', 'lastUpdate', '0', '1', '2', '3'];

    INTERACTIONS.forEach(item => {
        if (item.drugA && !IGNORE_KEYS.includes(item.drugA) && isNaN(item.drugA)) drugs.add(item.drugA);
        if (item.drugB && !IGNORE_KEYS.includes(item.drugB) && isNaN(item.drugB)) drugs.add(item.drugB);
    });

    const sortedDrugs = Array.from(drugs).sort();
    const datalist = document.getElementById('drugList');
    datalist.innerHTML = sortedDrugs.map(d => `<option value="${d}">`).join('');
}

function markUnsaved() {
    showStatus("Unsaved changes (click Download)", "#dc3545");
}

function showStatus(msg, color) {
    const el = document.getElementById('saveStatus');
    el.textContent = msg;
    if (color) el.style.color = color;
}
