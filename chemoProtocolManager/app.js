
let APP_DATA = {};
let CURRENT_DISEASE = null;

// =========================================================
// 1. INITIALIZATION & DATA LOADING
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // File Input Listener
    document.getElementById('jsonFileInput').addEventListener('change', handleFileUpload);

    // Action Listeners
    document.getElementById('addDiseaseBtn').addEventListener('click', promptAddDisease);
    document.getElementById('downloadBtn').addEventListener('click', downloadJSON);

    document.getElementById('deleteDiseaseBtn').addEventListener('click', deleteCurrentDisease);
    document.getElementById('addPhaseBtn').addEventListener('click', promptAddPhase);

    // Modal controls
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);

    // Initial State
    enableNav(false);
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);
            APP_DATA = json;
            enableNav(true);
            renderDiseaseList();
            showWelcome("Data Loaded Successfully.");
            document.getElementById('welcomeText').textContent = "Select a disease to edit.";
            document.getElementById('saveStatus').textContent = "";
        } catch (err) {
            console.error(err);
            alert("Invalid JSON file. Please check the file and try again.");
        }
    };
    reader.readAsText(file);
}

function enableNav(enabled) {
    const navCard = document.getElementById('navCard');
    const dlBtn = document.getElementById('downloadBtn');

    if (enabled) {
        navCard.style.opacity = '1';
        navCard.style.pointerEvents = 'auto';
        dlBtn.removeAttribute('disabled');
    } else {
        navCard.style.opacity = '0.5';
        navCard.style.pointerEvents = 'none';
        dlBtn.setAttribute('disabled', 'true');
    }
}

// =========================================================
// 2. SIDEBAR RENDERING
// =========================================================
function renderDiseaseList() {
    const list = document.getElementById('diseaseList');
    list.innerHTML = '';

    if (!APP_DATA || Object.keys(APP_DATA).length === 0) {
        list.innerHTML = '<li style="color:#666; font-style:italic;">No diseases found.</li>';
        return;
    }

    Object.keys(APP_DATA).forEach(key => {
        const li = document.createElement('li');
        li.textContent = key;
        if (CURRENT_DISEASE === key) li.classList.add('active');
        li.onclick = () => {
            CURRENT_DISEASE = key;
            renderDiseaseList(); // re-render to update active class
            renderDiseaseView(key);
        };
        list.appendChild(li);
    });
}

function promptAddDisease() {
    let rawName = prompt("Enter new Disease Name (e.g. 'MDS'):");
    if (!rawName) return;

    const name = rawName.toUpperCase().trim(); // Enforce uppercase standard

    if (!APP_DATA[name]) {
        APP_DATA[name] = {};
        CURRENT_DISEASE = name;
        renderDiseaseList();
        renderDiseaseView(name);
        markUnsaved();
    } else {
        alert("Disease already exists.");
    }
}

// =========================================================
// 3. MAIN VIEW RENDERING
// =========================================================
function showWelcome(msg) {
    document.getElementById('welcomeView').removeAttribute('hidden');
    document.getElementById('diseaseView').setAttribute('hidden', '');
    if (msg) document.getElementById('welcomeTitle').textContent = msg;
}

function renderDiseaseView(diseaseKey) {
    document.getElementById('welcomeView').setAttribute('hidden', '');
    document.getElementById('diseaseView').removeAttribute('hidden');
    document.getElementById('currentDiseaseTitle').textContent = diseaseKey;

    const container = document.getElementById('phasesContainer');
    container.innerHTML = '';

    const diseaseData = APP_DATA[diseaseKey];

    // diseaseData is { "Phase Name": { goal, protocols: [] } }
    Object.keys(diseaseData).forEach(phaseName => {
        const phaseObj = diseaseData[phaseName];

        // Handle variations where phase might be just array (legacy structure support)
        const protocols = Array.isArray(phaseObj) ? phaseObj : (phaseObj.protocols || []);
        const goal = phaseObj.goal || "";

        const phaseBlock = document.createElement('div');
        phaseBlock.className = 'phase-block';

        phaseBlock.innerHTML = `
            <div class="phase-header">
                <div>
                    <h3>${phaseName}</h3>
                    <small style="color:#666">${protocols.length} protocols</small>
                </div>
                <div>
                    <button class="btn-phase-actions" onclick="editPhaseMeta('${diseaseKey}', '${phaseName}')">Edit Goal</button>
                    <button class="btn-phase-actions" style="color:var(--risk)" onclick="deletePhase('${diseaseKey}', '${phaseName}')">Delete Phase</button>
                    <button class="btn btn-sm btn-primary" onclick="addNewProtocol('${diseaseKey}', '${phaseName}')">+ Add Protocol</button>
                </div>
            </div>
            ${goal ? `<p style="font-style:italic; margin-bottom:12px; color:#555;">Goal: ${goal}</p>` : ''}
            <div class="protocols-list"></div>
        `;

        const list = phaseBlock.querySelector('.protocols-list');
        protocols.forEach((protocol, idx) => {
            const item = document.createElement('div');
            item.className = 'protocol-item';

            // Preview drugs
            const drugs = (protocol.drugs || []).map(d => d.name).join(', ');

            item.innerHTML = `
                <div class="protocol-header">
                    <span class="protocol-title">${protocol.protocolName || "Unnamed Protocol"}</span>
                    <button class="btn-ghost" style="padding:4px;" onclick="event.stopPropagation(); deleteProtocol('${diseaseKey}', '${phaseName}', ${idx})">🗑️</button>
                </div>
                <div class="drug-preview">${drugs || "No drugs listed"}</div>
                <div style="font-size:0.8rem; margin-top:6px; color:#888;">Source: ${protocol.source || "—"}</div>
            `;

            item.onclick = () => openProtocolModal(protocol, diseaseKey, phaseName, idx);
            list.appendChild(item);
        });

        container.appendChild(phaseBlock);
    });
}

function promptAddPhase() {
    if (!CURRENT_DISEASE) return;
    const name = prompt("Enter new Phase Name (e.g. 'Induction'):");
    if (name) {
        if (!APP_DATA[CURRENT_DISEASE][name]) {
            APP_DATA[CURRENT_DISEASE][name] = {
                goal: "",
                protocols: []
            };
            renderDiseaseView(CURRENT_DISEASE);
            markUnsaved();
        } else {
            alert("Phase already exists.");
        }
    }
}

function editPhaseMeta(disease, phase) {
    const currentGoal = APP_DATA[disease][phase].goal || "";
    const newGoal = prompt(`Edit Goal for ${phase}:`, currentGoal);
    if (newGoal !== null) {
        APP_DATA[disease][phase].goal = newGoal;
        renderDiseaseView(disease);
        markUnsaved();
    }
}

function deleteCurrentDisease() {
    if (!CURRENT_DISEASE) return;
    if (confirm(`Are you sure you want to delete ${CURRENT_DISEASE}? This cannot be undone.`)) {
        delete APP_DATA[CURRENT_DISEASE];
        CURRENT_DISEASE = null;
        renderDiseaseList();
        showWelcome("Disease Deleted.");
        markUnsaved();
    }
}

function deletePhase(disease, phase) {
    if (confirm(`Delete phase '${phase}'?`)) {
        delete APP_DATA[disease][phase];
        renderDiseaseView(disease);
        markUnsaved();
    }
}

function deleteProtocol(disease, phase, index) {
    if (confirm("Delete this protocol?")) {
        const protocols = getProtocolsArray(disease, phase);
        protocols.splice(index, 1);
        renderDiseaseView(disease);
        markUnsaved();
    }
}

// Helper to get protocols array safely
function getProtocolsArray(disease, phase) {
    const obj = APP_DATA[disease][phase];
    if (Array.isArray(obj)) return obj;
    return obj.protocols;
}

// =========================================================
// 4. EDIT/ADD PROTOCOL MODAL
// =========================================================
let currentEditContext = null; // { disease, phase, index (null if new) }

function addNewProtocol(disease, phase) {
    const newProtocol = {
        protocolName: "New Protocol",
        drugs: [],
        NursesInfo: [],
        source: ""
    };
    openProtocolModal(newProtocol, disease, phase, null);
}

function openProtocolModal(protocol, disease, phase, index) {
    currentEditContext = { disease, phase, index, protocol: JSON.parse(JSON.stringify(protocol)) };

    const modal = document.getElementById('modal');
    modal.classList.add('open');
    document.getElementById('modalTitle').textContent = index === null ? "Add Protocol" : "Edit Protocol";

    const p = currentEditContext.protocol;

    renderProtocolForm(p);

    document.getElementById('saveModalBtn').onclick = saveProtocolFromModal;
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
    currentEditContext = null;
}

function renderProtocolForm(p) {
    const body = document.getElementById('modalBody');
    body.innerHTML = `
        <div class="form-group">
            <label>Protocol Name</label>
            <input type="text" class="form-control" id="editProtoName" value="${p.protocolName || ''}">
        </div>
        <div class="form-group">
            <label>Source</label>
            <input type="text" class="form-control" id="editProtoSource" value="${p.source || ''}">
        </div>
        
        <div class="form-group">
            <label>Drugs <button class="btn btn-sm btn-secondary" onclick="addDrugRow()">+ Add Drug</button></label>
            <div class="drug-edit-list" id="drugEditList"></div>
        </div>

        <div class="form-group">
            <label>Nurse's Info (One per line)</label>
            <textarea class="form-control" id="editNurseInfo">${(p.NursesInfo || []).join('\n')}</textarea>
        </div>
    `;

    renderDrugsList(p.drugs || []);
}

function renderDrugsList(drugs) {
    const container = document.getElementById('drugEditList');
    container.innerHTML = '';

    if (drugs.length === 0) {
        container.innerHTML = '<div style="color:#888; text-align:center; padding:10px;">No drugs added</div>';
        return;
    }

    drugs.forEach((d, i) => {
        const row = document.createElement('div');
        row.className = 'drug-edit-item';
        // Add specific note field in a new row for visibility
        row.innerHTML = `
            <input type="text" placeholder="Name" class="form-control" value="${d.name || ''}" onchange="updateDrug(${i}, 'name', this.value)">
            <input type="text" placeholder="Dose" class="form-control" value="${d.dose || ''}" onchange="updateDrug(${i}, 'dose', this.value)">
            <input type="text" placeholder="Route" class="form-control" value="${d.route || ''}" onchange="updateDrug(${i}, 'route', this.value)">
            <button class="btn-remove" onclick="removeDrug(${i})">×</button>
            <input type="text" placeholder="Day (e.g. Day 1-3)" class="form-control" style="grid-column: 1 / -2" value="${d.day || ''}" onchange="updateDrug(${i}, 'day', this.value)">
            <select class="form-control" onchange="updateDrug(${i}, 'phase', this.value)">
                <option value="Pre-Chemo" ${d.phase === 'Pre-Chemo' ? 'selected' : ''}>Pre-Chemo</option>
                <option value="Chemo" ${d.phase === 'Chemo' ? 'selected' : ''}>Chemo</option>
                <option value="Post-Chemo" ${d.phase === 'Post-Chemo' ? 'selected' : ''}>Post-Chemo</option>
                <option value="Other" ${!['Pre-Chemo', 'Chemo', 'Post-Chemo'].includes(d.phase) ? 'selected' : ''}>Other</option>
            </select>
            <input type="text" placeholder="Specific Note (e.g. Check pH > 7)" class="form-control" style="grid-column: 1 / -1" value="${d.note || ''}" onchange="updateDrug(${i}, 'note', this.value)">
        `;
        container.appendChild(row);
    });
}

// Global scope helpers for inline events
window.addDrugRow = () => {
    if (!currentEditContext) return;
    currentEditContext.protocol.drugs = currentEditContext.protocol.drugs || [];
    currentEditContext.protocol.drugs.push({ name: "", dose: "", route: "", phase: "Chemo", day: "", note: "" });
    renderDrugsList(currentEditContext.protocol.drugs);
};

window.removeDrug = (idx) => {
    if (!currentEditContext) return;
    currentEditContext.protocol.drugs.splice(idx, 1);
    renderDrugsList(currentEditContext.protocol.drugs);
};

window.updateDrug = (idx, field, val) => {
    if (!currentEditContext) return;
    currentEditContext.protocol.drugs[idx][field] = val;
};

function saveProtocolFromModal() {
    if (!currentEditContext) return;

    // Capture basic fields
    const p = currentEditContext.protocol;
    p.protocolName = document.getElementById('editProtoName').value;
    p.source = document.getElementById('editProtoSource').value;

    // Capture Nurse Info
    const nurseText = document.getElementById('editNurseInfo').value;
    p.NursesInfo = nurseText.split('\n').map(l => l.trim()).filter(Boolean);

    // Context
    const { disease, phase, index } = currentEditContext;
    const protocolsList = getProtocolsArray(disease, phase);

    if (index === null) {
        // Add new
        protocolsList.push(p);
    } else {
        // Update existing
        protocolsList[index] = p;
    }

    closeModal();
    renderDiseaseView(disease);
    markUnsaved();
}


// =========================================================
// 5. DATA SAVING / DOWNLOADING
// =========================================================
function downloadJSON() {
    if (!APP_DATA) {
        alert("No data to save.");
        return;
    }

    const dataStr = JSON.stringify(APP_DATA, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "updated_chemoProtocols.json";
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);

    const statusObj = document.getElementById('saveStatus');
    statusObj.textContent = "Downloaded!";
    statusObj.style.color = "green";

    // Reset status after a few seconds
    setTimeout(() => {
        statusObj.textContent = "";
    }, 3000);
}

function markUnsaved() {
    const el = document.getElementById('saveStatus');
    el.textContent = "Unsaved changes (click Download)";
    el.style.color = "#dc3545";
}
