
let APP_DATA = {};
let CURRENT_DISEASE = null;
let CURRENT_SUBTYPE = null;
let hasUnsavedChanges = false;

// =========================================================
// 1. INITIALIZATION & DATA LOADING
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // File Input Listener
    document.getElementById('jsonFileInput').addEventListener('change', handleFileUpload);

    // Action Listeners
    document.getElementById('addDiseaseBtn').addEventListener('click', promptAddDisease);
    document.getElementById('downloadBtn').addEventListener('click', downloadJSON);

    document.getElementById('deleteDiseaseBtn').addEventListener('click', deleteCurrentContext);
    document.getElementById('addPhaseBtn').addEventListener('click', promptAddPhase);

    // New: Add Subtype Button (Dynamic)
    // We'll add a listener to a new button or existing one if we decide to change UI.
    // For now, let's keep it simple. We might need a button in the UI for "Add Subtype".
    // I'll add a button dynamically in the disease view if it's a top-level disease.

    // Modal controls
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);

    // Initial State
    enableNav(false);

    // Prevent accidental close
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges || currentEditContext) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
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
        navCard.classList.remove('opacity-50', 'pointer-events-none');
        navCard.style.removeProperty('opacity');
        navCard.style.removeProperty('pointer-events');
        dlBtn.removeAttribute('disabled');
    } else {
        navCard.classList.add('opacity-50', 'pointer-events-none');
        dlBtn.setAttribute('disabled', 'true');
    }
}

// =========================================================
// 2. SIDEBAR RENDERING
// =========================================================
// Helper to determine the structure of a disease object
function getStructureMode(diseaseData) {
    if (!diseaseData) return 'empty';
    if (diseaseData.subtypes && Object.keys(diseaseData.subtypes).length > 0) return 'explicit_subtypes';

    // Check if children look like subtypes (objects) or phases (arrays/objects with 'protocols')
    // A simplified check: if any child key has a 'protocols' array or is an array itself, it's likely a phase.
    // Otherwise, if it has children keys, treat as implicit subtype.
    const keys = Object.keys(diseaseData);
    if (keys.length === 0) return 'empty';

    const firstKey = keys[0];
    const child = diseaseData[firstKey];

    // If child has "protocols" property or is an array, then the current level is "Disease -> Phases"
    if (Array.isArray(child) || (child && child.protocols)) {
        return 'phases';
    }

    // Otherwise, assume it's "Disease -> Subtypes -> Phases" (Implicit Subtypes)
    return 'implicit_subtypes';
}

function renderDiseaseList() {
    const list = document.getElementById('diseaseList');
    list.innerHTML = '';

    if (!APP_DATA || Object.keys(APP_DATA).length === 0) {
        list.innerHTML = '<li style="color:#666; font-style:italic;">No diseases found.</li>';
        return;
    }

    Object.keys(APP_DATA).forEach(key => {
        const itemContainer = document.createElement('div');

        // Disease Item
        const li = document.createElement('li');
        li.textContent = key;

        // Check if active (only if no subtype is selected, or if we want to show parent active)
        if (CURRENT_DISEASE === key && !CURRENT_SUBTYPE) {
            li.classList.add('active');
        }

        li.onclick = () => {
            CURRENT_DISEASE = key;
            CURRENT_SUBTYPE = null;
            renderDiseaseList();
            renderDiseaseView(key);
        };
        list.appendChild(li);

        // Subtypes Processing
        const diseaseObj = APP_DATA[key];
        const mode = getStructureMode(diseaseObj);

        let subtypeKeys = [];
        if (mode === 'explicit_subtypes') {
            subtypeKeys = Object.keys(diseaseObj.subtypes);
        } else if (mode === 'implicit_subtypes') {
            subtypeKeys = Object.keys(diseaseObj);
        }

        if (subtypeKeys.length > 0) {
            const ulSub = document.createElement('ul');
            ulSub.style.paddingLeft = "20px";
            ulSub.style.listStyle = "none";
            ulSub.style.marginTop = "0";

            subtypeKeys.forEach(subKey => {
                const subLi = document.createElement('li');
                subLi.textContent = "↳ " + subKey;
                subLi.style.fontSize = "0.9em";
                subLi.style.color = "#555";
                subLi.style.cursor = "pointer";
                subLi.style.padding = "4px 8px";

                if (CURRENT_DISEASE === key && CURRENT_SUBTYPE === subKey) {
                    subLi.classList.add('active'); // Ensure CSS supports .active on these LIs
                    subLi.style.color = "var(--primary-color)";
                    subLi.style.fontWeight = "bold";
                }

                subLi.onclick = (e) => {
                    e.stopPropagation();
                    CURRENT_DISEASE = key;
                    CURRENT_SUBTYPE = subKey;
                    renderDiseaseList();
                    renderDiseaseView(key, subKey);
                };
                ulSub.appendChild(subLi);
            });
            list.appendChild(ulSub);
        }
    });
}

function promptAddDisease() {
    let rawName = prompt("Enter new Disease Name (e.g. 'MDS'):");
    if (!rawName) return;

    const name = rawName.toUpperCase().trim(); // Enforce uppercase standard

    if (!APP_DATA[name]) {
        APP_DATA[name] = {};
        CURRENT_DISEASE = name;
        CURRENT_SUBTYPE = null;
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

function getCurrentContextData() {
    if (!CURRENT_DISEASE) return null;
    const diseaseObj = APP_DATA[CURRENT_DISEASE];

    // If a subtype is explicitly selected
    if (CURRENT_SUBTYPE) {
        // Try explicit 'subtypes' key first
        if (diseaseObj.subtypes && diseaseObj.subtypes[CURRENT_SUBTYPE]) {
            return diseaseObj.subtypes[CURRENT_SUBTYPE];
        }
        // Fallback to direct child (implicit subtype)
        if (diseaseObj[CURRENT_SUBTYPE]) {
            return diseaseObj[CURRENT_SUBTYPE];
        }
        return null;
    }

    return diseaseObj;
}

function renderDiseaseView(diseaseKey, subtypeKey = null) {
    document.getElementById('welcomeView').setAttribute('hidden', '');
    document.getElementById('diseaseView').removeAttribute('hidden');

    let title = diseaseKey;
    if (subtypeKey) title += ` -> ${subtypeKey}`;
    document.getElementById('currentDiseaseTitle').textContent = title;

    // View Header Buttons Logic
    const headerBtns = document.querySelector('.view-header > div');
    headerBtns.innerHTML = ''; // Clear existing buttons to rebuild based on context

    // 1. Add Subtype Button (Only if we are at Top Level)
    if (!subtypeKey) {
        const btnAddSub = document.createElement('button');
        btnAddSub.className = 'btn btn-secondary';
        btnAddSub.style.marginRight = "8px"; // Spacing
        btnAddSub.textContent = "+ Add Subtype";
        btnAddSub.onclick = promptAddSubtype;
        headerBtns.appendChild(btnAddSub);
    }

    // 2. Add Phase Button
    const btnAddPhase = document.createElement('button');
    btnAddPhase.className = 'btn btn-secondary';
    btnAddPhase.textContent = "+ Add Phase";
    btnAddPhase.onclick = promptAddPhase;
    headerBtns.appendChild(btnAddPhase);

    // 3. Delete Button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-danger-outline';
    btnDelete.style.marginLeft = "8px";
    btnDelete.textContent = subtypeKey ? "Delete Subtype" : "Delete Disease";
    btnDelete.onclick = deleteCurrentContext;
    headerBtns.appendChild(btnDelete);


    const container = document.getElementById('phasesContainer');
    container.innerHTML = '';

    const contextData = getCurrentContextData();
    if (!contextData) return;

    // Filter out 'subtypes' key if we are at root level
    let keys = Object.keys(contextData);
    
    // Structure Check
    const mode = getStructureMode(APP_DATA[diseaseKey || CURRENT_DISEASE]);

    if (!subtypeKey) {
        // If at root level
        if (mode === 'explicit_subtypes') {
            keys = keys.filter(k => k !== 'subtypes');
            
            // If we have subtypes, we might want to prompt user to select one, 
            // BUT if there are also direct phases (mixed), we should show them.
            // If NO direct phases, show "Select subtype".
            if (keys.length === 0 && contextData.subtypes && Object.keys(contextData.subtypes).length > 0) {
                 container.innerHTML = '<div style="padding:20px; color:#666;">Select a subtype from the sidebar to view protocols.</div>';
                 return;
            }

        } else if (mode === 'implicit_subtypes') {
            // In implicit mode, the keys ARE the subtypes (plus maybe metadata). 
            // We shouldn't render them as phases.
            // If there are implicit subtypes, we just show the select message.
            container.innerHTML = '<div style="padding:20px; color:#666;">Select a subtype from the sidebar to view protocols.</div>';
            return;
        }
    }
    
    // Safety check if keys empty (and didn't return above)
    if (keys.length === 0) {
         container.innerHTML = '<div style="padding:20px; color:#666;">No phases found. Click "Add Phase" to start.</div>';
    }

    // contextData is { "Phase Name": { goal, protocols: [] } }
    keys.forEach(phaseName => {
        const phaseObj = contextData[phaseName];

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
                    <button class="btn-phase-actions" onclick="renamePhase('${phaseName}')">Edit Phase</button>
                    <button class="btn-phase-actions" style="color:var(--risk)" onclick="deletePhase('${phaseName}')">Delete Phase</button>
                    <button class="btn btn-sm btn-primary" onclick="addNewProtocol('${phaseName}')">+ Add Protocol</button>
                </div>
            </div>
            <div style="margin-bottom:12px; color:#555; display:flex; align-items:center; gap:8px;">
                <p style="font-style:italic; margin:0;">Goal: ${goal || '<span style="opacity:0.6">(No goal set)</span>'}</p>
                <button class="btn-ghost" style="padding:2px 6px; font-size:0.8rem;" onclick="editPhaseGoal('${phaseName}')" title="Edit Goal">✏️</button>
            </div>
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
                    <button class="btn-ghost" style="padding:4px;" onclick="event.stopPropagation(); deleteProtocol('${phaseName}', ${idx})">🗑️</button>
                </div>
                <div class="drug-preview">${drugs || "No drugs listed"}</div>
                <div style="font-size:0.8rem; margin-top:6px; color:#888;">Source: ${protocol.source || "—"}</div>
            `;

            item.onclick = () => openProtocolModal(protocol, phaseName, idx);
            list.appendChild(item);
        });

        container.appendChild(phaseBlock);
    });
}

function promptAddSubtype() {
    if (!CURRENT_DISEASE) return;
    const diseaseObj = APP_DATA[CURRENT_DISEASE];
    const mode = getStructureMode(diseaseObj);

    const name = prompt(`Enter new Subtype for ${CURRENT_DISEASE} (e.g. 't-ALL'):`);
    if (!name) return;

    if (mode === 'implicit_subtypes') {
        // Add as direct child
        if (!diseaseObj[name]) {
            diseaseObj[name] = {};
            CURRENT_SUBTYPE = name;
            renderDiseaseList();
            renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
            markUnsaved();
        } else {
            alert("Subtype already exists.");
        }
    } else {
        // Default / Explicit
        if (!diseaseObj.subtypes) {
            diseaseObj.subtypes = {};
        }
        if (!diseaseObj.subtypes[name]) {
            diseaseObj.subtypes[name] = {};
            CURRENT_SUBTYPE = name;
            renderDiseaseList();
            renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
            markUnsaved();
        } else {
             alert("Subtype already exists.");
        }
    }
}

function promptAddPhase() {
    const contextData = getCurrentContextData();
    if (!contextData) return;

    const name = prompt("Enter new Phase Name (e.g. 'Induction'):");
    if (name) {
        if (!contextData[name]) {
            contextData[name] = {
                goal: "",
                protocols: []
            };
            renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
            markUnsaved();
        } else {
            alert("Phase already exists.");
        }
    }
}

function editPhaseGoal(phase) {
    const contextData = getCurrentContextData();
    const currentGoal = contextData[phase].goal || "";
    const newGoal = prompt(`Edit Goal for ${phase}:`, currentGoal);
    if (newGoal !== null) {
        contextData[phase].goal = newGoal;
        renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
        markUnsaved();
    }
}

function deleteCurrentContext() {
    if (!CURRENT_DISEASE) return;

    if (CURRENT_SUBTYPE) {
        // Delete Subtype
        if (confirm(`Are you sure you want to delete subtype '${CURRENT_SUBTYPE}'?`)) {
            const diseaseObj = APP_DATA[CURRENT_DISEASE];
            const mode = getStructureMode(diseaseObj);
            
            if (mode === 'implicit_subtypes') {
                delete diseaseObj[CURRENT_SUBTYPE];
            } else {
                if (diseaseObj.subtypes) delete diseaseObj.subtypes[CURRENT_SUBTYPE];
            }
            
            CURRENT_SUBTYPE = null;
            renderDiseaseList();
            renderDiseaseView(CURRENT_DISEASE); // Go back to parent
            markUnsaved();
        }
    } else {
        // Delete Disease
        if (confirm(`Are you sure you want to delete disease '${CURRENT_DISEASE}'? This cannot be undone.`)) {
            delete APP_DATA[CURRENT_DISEASE];
            CURRENT_DISEASE = null;
            CURRENT_SUBTYPE = null;
            renderDiseaseList();
            showWelcome("Disease Deleted.");
            markUnsaved();
        }
    }
}

function renamePhase(oldName) {
    const contextData = getCurrentContextData();
    const newName = prompt("Rename Phase:", oldName);
    if (!newName || newName === oldName) return;

    if (contextData[newName]) {
        alert("Phase name already exists!");
        return;
    }

    const newPhaseData = {};
    // Preserve order while renaming
    Object.keys(contextData).forEach(key => {
        if (key === oldName) {
            newPhaseData[newName] = contextData[oldName];
        } else {
            newPhaseData[key] = contextData[key];
        }
    });

    // Replace properties in the original object (can't just reassign local var contextData)
    // We need to clear and refill contextData or reassign in parent. 
    // Since contextData is a reference to the inner object, we can modify it directly if we didn't change the object reference itself.
    // Wait, `newPhaseData` is a new object. We need to replace content of contextData.

    // Simplest way: delete all keys and re-add.
    Object.keys(contextData).forEach(k => delete contextData[k]);
    Object.assign(contextData, newPhaseData);

    renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
    markUnsaved();
}

function deletePhase(phase) {
    const contextData = getCurrentContextData();
    if (confirm(`Delete phase '${phase}'?`)) {
        delete contextData[phase];
        renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
        markUnsaved();
    }
}

function deleteProtocol(phase, index) {
    if (confirm("Delete this protocol?")) {
        const protocols = getProtocolsArray(phase);
        protocols.splice(index, 1);
        renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
        markUnsaved();
    }
}

// Helper to get protocols array safely
function getProtocolsArray(phase) {
    const contextData = getCurrentContextData();
    const obj = contextData[phase];
    if (Array.isArray(obj)) return obj;
    return obj.protocols;
}

// =========================================================
// 4. EDIT/ADD PROTOCOL MODAL
// =========================================================
let currentEditContext = null; // { phase, index, protocol } (disease/subtype implied by global state)

function addNewProtocol(phase) {
    const newProtocol = {
        protocolName: "New Protocol",
        drugs: [],
        NursesInfo: [],
        source: ""
    };
    openProtocolModal(newProtocol, phase, null);
}

function openProtocolModal(protocol, phase, index) {
    // Save current global state in context so we know where we are editing
    // Actually we rely on `getProtocolsArray(phase)` which relies on CURRENT_DISEASE/SUBTYPE
    currentEditContext = { phase, index, protocol: JSON.parse(JSON.stringify(protocol)) };

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
            <label style="display:flex; justify-content:space-between; align-items:center;">Drugs<button class="btn-insert" onclick="insertDrugRow()" style="width:auto; height:auto; border-radius:8px; padding:5px 12px; margin-right:10px; font-size:0.9rem;">+ Add Drug</button></label>
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

        row.innerHTML = `
            <input type="text" placeholder="Name" class="form-control" value="${d.name || ''}" onchange="updateDrug(${i}, 'name', this.value)">
            <input type="text" placeholder="Dose" class="form-control" value="${d.dose || ''}" onchange="updateDrug(${i}, 'dose', this.value)">
            <input type="text" placeholder="Route" class="form-control" value="${d.route || ''}" onchange="updateDrug(${i}, 'route', this.value)">
            <button class="btn-remove" onclick="removeDrug(${i})">×</button>
            <button class="btn-insert" onclick="insertDrugRow(${i})" title="Insert row below">+</button>
            <input type="text" placeholder="Day (e.g. Day 1-3)" class="form-control" style="grid-column: 1 / 3" value="${d.day || ''}" onchange="updateDrug(${i}, 'day', this.value)">
            <input type="text" placeholder="Duration" class="form-control" style="grid-column: 3 / 5" value="${d.duration || ''}" onchange="updateDrug(${i}, 'duration', this.value)">
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

window.insertDrugRow = (idx) => {
    if (!currentEditContext) return;
    const newDrug = { name: "", dose: "", route: "", phase: "Chemo", day: "", duration: "", note: "" };
    currentEditContext.protocol.drugs.splice(idx + 1, 0, newDrug);
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
    const { phase, index } = currentEditContext;
    const protocolsList = getProtocolsArray(phase);

    if (index === null) {
        // Add new
        protocolsList.push(p);
    } else {
        // Update existing
        protocolsList[index] = p;
    }

    closeModal();
    renderDiseaseView(CURRENT_DISEASE, CURRENT_SUBTYPE);
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
    a.download = "chemoProtocols.json";
    document.body.appendChild(a);
    a.click();

    hasUnsavedChanges = false;

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
    hasUnsavedChanges = true;
    const el = document.getElementById('saveStatus');
    el.textContent = "Unsaved changes (click Download)";
    el.style.color = "#dc3545";
}
