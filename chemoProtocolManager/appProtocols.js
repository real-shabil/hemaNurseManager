
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
        const emptyItem = document.createElement('li');
        emptyItem.style.color = '#666';
        emptyItem.style.fontStyle = 'italic';
        emptyItem.textContent = 'No diseases found.';
        list.appendChild(emptyItem);
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

function createButton(text, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = text;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
}

function createInput(type, placeholder, value, className) {
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder || '';
    input.className = className || '';
    input.value = value || '';
    return input;
}

function createSelect(options, selectedValue, className, onChange) {
    const select = document.createElement('select');
    select.className = className || '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === selectedValue) option.selected = true;
        select.appendChild(option);
    });
    if (onChange) select.addEventListener('change', onChange);
    return select;
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
                const msg = document.createElement('div');
                msg.style.padding = '20px';
                msg.style.color = '#666';
                msg.textContent = 'Select a subtype from the sidebar to view protocols.';
                container.appendChild(msg);
                return;
            }

        } else if (mode === 'implicit_subtypes') {
            const msg = document.createElement('div');
            msg.style.padding = '20px';
            msg.style.color = '#666';
            msg.textContent = 'Select a subtype from the sidebar to view protocols.';
            container.appendChild(msg);
            return;
        }
    }
    
    // Safety check if keys empty (and didn't return above)
    if (keys.length === 0) {
        const msg = document.createElement('div');
        msg.style.padding = '20px';
        msg.style.color = '#666';
        msg.textContent = 'No phases found. Click "Add Phase" to start.';
        container.appendChild(msg);
    }

    // contextData is { "Phase Name": { goal, protocols: [] } }
    keys.forEach(phaseName => {
        const phaseObj = contextData[phaseName];

        // Handle variations where phase might be just array (legacy structure support)
        const protocols = Array.isArray(phaseObj) ? phaseObj : (phaseObj.protocols || []);
        const goal = phaseObj.goal || "";

        const phaseBlock = document.createElement('div');
        phaseBlock.className = 'phase-block';

        const phaseHeader = document.createElement('div');
        phaseHeader.className = 'phase-header';

        const titleGroup = document.createElement('div');
        const heading = document.createElement('h3');
        heading.textContent = phaseName;
        const countLabel = document.createElement('small');
        countLabel.style.color = '#666';
        countLabel.textContent = `${protocols.length} protocols`;
        titleGroup.appendChild(heading);
        titleGroup.appendChild(countLabel);

        const actionGroup = document.createElement('div');
        const renameBtn = createButton('Edit Phase', 'btn-phase-actions', () => renamePhase(phaseName));
        const deleteBtn = createButton('Delete Phase', 'btn-phase-actions', () => deletePhase(phaseName));
        deleteBtn.style.color = 'var(--risk)';
        const addProtocolBtn = createButton('+ Add Protocol', 'btn btn-sm btn-primary', () => addNewProtocol(phaseName));

        actionGroup.appendChild(renameBtn);
        actionGroup.appendChild(deleteBtn);
        actionGroup.appendChild(addProtocolBtn);

        phaseHeader.appendChild(titleGroup);
        phaseHeader.appendChild(actionGroup);
        phaseBlock.appendChild(phaseHeader);

        const goalRow = document.createElement('div');
        goalRow.style.marginBottom = '12px';
        goalRow.style.color = '#555';
        goalRow.style.display = 'flex';
        goalRow.style.alignItems = 'center';
        goalRow.style.gap = '8px';

        const goalText = document.createElement('p');
        goalText.style.fontStyle = 'italic';
        goalText.style.margin = '0';
        if (goal) {
            goalText.textContent = `Goal: ${goal}`;
        } else {
            goalText.textContent = 'Goal: ';
            const placeholder = document.createElement('span');
            placeholder.style.opacity = '0.6';
            placeholder.textContent = '(No goal set)';
            goalText.appendChild(placeholder);
        }

        const editGoalBtn = createButton('✏️', 'btn-ghost', () => editPhaseGoal(phaseName));
        editGoalBtn.style.padding = '2px 6px';
        editGoalBtn.style.fontSize = '0.8rem';
        editGoalBtn.title = 'Edit Goal';

        goalRow.appendChild(goalText);
        goalRow.appendChild(editGoalBtn);
        phaseBlock.appendChild(goalRow);

        const list = document.createElement('div');
        list.className = 'protocols-list';

        protocols.forEach((protocol, idx) => {
            const item = document.createElement('div');
            item.className = 'protocol-item';

            const protocolHeader = document.createElement('div');
            protocolHeader.className = 'protocol-header';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'protocol-title';
            titleSpan.textContent = protocol.protocolName || 'Unnamed Protocol';

            const deleteProtocolBtn = createButton('🗑️', 'btn-ghost', (e) => {
                e.stopPropagation();
                deleteProtocol(phaseName, idx);
            });
            deleteProtocolBtn.style.padding = '4px';

            protocolHeader.appendChild(titleSpan);
            protocolHeader.appendChild(deleteProtocolBtn);

            const preview = document.createElement('div');
            preview.className = 'drug-preview';
            const drugs = (protocol.drugs || []).map(d => d.name).join(', ');
            preview.textContent = drugs || 'No drugs listed';

            const sourceDiv = document.createElement('div');
            sourceDiv.style.fontSize = '0.8rem';
            sourceDiv.style.marginTop = '6px';
            sourceDiv.style.color = '#888';
            sourceDiv.textContent = `Source: ${protocol.source || '—'}`;

            item.appendChild(protocolHeader);
            item.appendChild(preview);
            item.appendChild(sourceDiv);
            item.addEventListener('click', () => openProtocolModal(protocol, phaseName, idx));
            list.appendChild(item);
        });

        phaseBlock.appendChild(list);
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
    body.innerHTML = '';

    const protocolGroup = document.createElement('div');
    protocolGroup.className = 'form-group';
    const protocolLabel = document.createElement('label');
    protocolLabel.textContent = 'Protocol Name';
    const protocolInput = createInput('text', '', p.protocolName || '', 'form-control');
    protocolInput.id = 'editProtoName';
    protocolGroup.appendChild(protocolLabel);
    protocolGroup.appendChild(protocolInput);

    const sourceGroup = document.createElement('div');
    sourceGroup.className = 'form-group';
    const sourceLabel = document.createElement('label');
    sourceLabel.textContent = 'Source';
    const sourceInput = createInput('text', '', p.source || '', 'form-control');
    sourceInput.id = 'editProtoSource';
    sourceGroup.appendChild(sourceLabel);
    sourceGroup.appendChild(sourceInput);

    const drugsGroup = document.createElement('div');
    drugsGroup.className = 'form-group';
    const drugsLabel = document.createElement('label');
    drugsLabel.style.display = 'flex';
    drugsLabel.style.justifyContent = 'space-between';
    drugsLabel.style.alignItems = 'center';
    drugsLabel.textContent = 'Drugs';
    const addDrugBtn = createButton('+ Add Drug', 'btn-insert', () => insertDrugRow());
    addDrugBtn.style.width = 'auto';
    addDrugBtn.style.height = 'auto';
    addDrugBtn.style.borderRadius = '8px';
    addDrugBtn.style.padding = '5px 12px';
    addDrugBtn.style.marginRight = '10px';
    addDrugBtn.style.fontSize = '0.9rem';
    drugsLabel.appendChild(addDrugBtn);

    const drugEditList = document.createElement('div');
    drugEditList.className = 'drug-edit-list';
    drugEditList.id = 'drugEditList';
    drugsGroup.appendChild(drugsLabel);
    drugsGroup.appendChild(drugEditList);

    const nurseGroup = document.createElement('div');
    nurseGroup.className = 'form-group';
    const nurseLabel = document.createElement('label');
    nurseLabel.textContent = "Nurse's Info (One per line)";
    const nurseTextArea = document.createElement('textarea');
    nurseTextArea.className = 'form-control';
    nurseTextArea.id = 'editNurseInfo';
    nurseTextArea.value = (p.NursesInfo || []).join('\n');
    nurseGroup.appendChild(nurseLabel);
    nurseGroup.appendChild(nurseTextArea);

    body.appendChild(protocolGroup);
    body.appendChild(sourceGroup);
    body.appendChild(drugsGroup);
    body.appendChild(nurseGroup);

    renderDrugsList(p.drugs || []);
}

function renderDrugsList(drugs) {
    const container = document.getElementById('drugEditList');
    container.innerHTML = '';

    if (!drugs || drugs.length === 0) {
        const message = document.createElement('div');
        message.style.color = '#888';
        message.style.textAlign = 'center';
        message.style.padding = '10px';
        message.textContent = 'No drugs added';
        container.appendChild(message);
        return;
    }

    drugs.forEach((d, i) => {
        const row = document.createElement('div');
        row.className = 'drug-edit-item';

        const nameInput = createInput('text', 'Name', d.name || '', 'form-control');
        nameInput.addEventListener('input', (e) => updateDrug(i, 'name', e.target.value));

        const doseInput = createInput('text', 'Dose', d.dose || '', 'form-control');
        doseInput.addEventListener('input', (e) => updateDrug(i, 'dose', e.target.value));

        const routeInput = createInput('text', 'Route', d.route || '', 'form-control');
        routeInput.addEventListener('input', (e) => updateDrug(i, 'route', e.target.value));

        const removeBtn = createButton('×', 'btn-remove', () => removeDrug(i));
        const insertBtn = createButton('+', 'btn-insert', () => insertDrugRow(i));
        insertBtn.title = 'Insert row below';

        const dayInput = createInput('text', 'Day (e.g. Day 1-3)', d.day || '', 'form-control');
        dayInput.style.gridColumn = '1 / 3';
        dayInput.addEventListener('input', (e) => updateDrug(i, 'day', e.target.value));

        const durationInput = createInput('text', 'Duration', d.duration || '', 'form-control');
        durationInput.style.gridColumn = '3 / 5';
        durationInput.addEventListener('input', (e) => updateDrug(i, 'duration', e.target.value));

        const phaseSelect = createSelect(['Pre-Chemo', 'Chemo', 'Post-Chemo', 'Other'], d.phase || 'Chemo', 'form-control', (e) => updateDrug(i, 'phase', e.target.value));

        const noteInput = createInput('text', 'Specific Note (e.g. Check pH > 7)', d.note || '', 'form-control');
        noteInput.style.gridColumn = '1 / -1';
        noteInput.addEventListener('input', (e) => updateDrug(i, 'note', e.target.value));

        row.appendChild(nameInput);
        row.appendChild(doseInput);
        row.appendChild(routeInput);
        row.appendChild(removeBtn);
        row.appendChild(insertBtn);
        row.appendChild(dayInput);
        row.appendChild(durationInput);
        row.appendChild(phaseSelect);
        row.appendChild(noteInput);

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
