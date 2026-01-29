

let APP_DATA = {};
let CURRENT_CATEGORY = null;

// =========================================================
// 1. INITIALIZATION & DATA LOADING
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // File Input Listener
    document.getElementById('jsonFileInput').addEventListener('change', handleFileUpload);

    // Action Listeners
    document.getElementById('downloadBtn').addEventListener('click', downloadJSON);
    document.getElementById('addDrugBtn').addEventListener('click', () => openDrugModal(null));

    // Modal controls
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('saveModalBtn').addEventListener('click', saveDrugFromModal);

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
            processLoadedData(json);
            enableNav(true);
            renderCategoryList();
            showWelcome("Data Loaded Successfully. Select a category to edit.");
            document.getElementById('saveStatus').textContent = "";
        } catch (err) {
            console.error(err);
            alert("Invalid JSON file. Please check the file and try again.");
        }
    };
    reader.readAsText(file);
}

function processLoadedData(json) {
    APP_DATA = {};
    
    // Helper to get group key
    const getGroupKey = (name) => {
        if (!name) return '#';
        const firstChar = name.trim().charAt(0).toUpperCase();
        // Check if alphanumeric
        return /[0-9A-Z]/.test(firstChar) ? firstChar : '#';
    };

    // Check if flat array
    if (Array.isArray(json)) {
        json.forEach(drug => {
            const groupKey = getGroupKey(drug.name);
            
            if (!APP_DATA[groupKey]) {
                APP_DATA[groupKey] = {
                    title: groupKey,
                    drugs: []
                };
            }
            // Normalize data fields
            APP_DATA[groupKey].drugs.push(normalizeDrug(drug));
        });
    } else {
        // If it's already an object (old format or re-import of grouped format),
        // we might want to re-process it if the user wants A-Z regardless of input format.
        // Let's iterate keys and regroup to ensure A-Z view.
        
        let allDrugs = [];
        Object.values(json).forEach(cat => {
            if (Array.isArray(cat.drugs)) {
                allDrugs = allDrugs.concat(cat.drugs);
            }
        });
        
        // Clear and rebuild as A-Z
        APP_DATA = {}; 
        allDrugs.forEach(drug => {
             const groupKey = getGroupKey(drug.name);
             if (!APP_DATA[groupKey]) {
                APP_DATA[groupKey] = {
                    title: groupKey,
                    drugs: []
                };
            }
            APP_DATA[groupKey].drugs.push(normalizeDrug(drug));
        });
    }
}

function normalizeDrug(drug) {
    // Map fields to internal structure
    return {
        name: drug.name || "",
        classification: drug.class || "",
        route: drug.routes || drug.route || "",
        extravasationRisk: drug.extravasation_risk || drug.extravasationRisk || "",
        // Simple arrays
        mechanism: drug.mechanism || [],
        indications: Array.isArray(drug.indication) ? drug.indication : (drug.indication ? [drug.indication] : []),
        warnings: drug.warnings || [],
        nursingInfo: drug.nursingInfo || [],
        // Complex objects
        sideEffects: drug.side_effects || drug.sideEffects || [],
        premedications: drug.premedications || [],
        requiredProphylaxis: drug.required_prophylaxis || drug.requiredProphylaxis || [],
        supportiveCare: drug.supportive_care || drug.supportiveCare || [],

        source: drug.source || ""
    };
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
function renderCategoryList() {
    const list = document.getElementById('categoryList');
    list.innerHTML = '';

    if (!APP_DATA || Object.keys(APP_DATA).length === 0) {
        list.innerHTML = '<li style="color:#666; font-style:italic;">No categories found.</li>';
        return;
    }

    const categories = Object.keys(APP_DATA).sort();

    categories.forEach(key => {
        const li = document.createElement('li');
        // Use title if available, else key formatted
        const title = APP_DATA[key].title || key;
        li.textContent = title;

        if (CURRENT_CATEGORY === key) li.classList.add('active');

        li.onclick = () => {
            CURRENT_CATEGORY = key;
            renderCategoryList(); // re-render to update active class
            renderCategoryView(key);
        };
        list.appendChild(li);
    });
}

// =========================================================
// 3. MAIN VIEW RENDERING
// =========================================================
function showWelcome(msg) {
    document.getElementById('welcomeView').removeAttribute('hidden');
    document.getElementById('categoryView').setAttribute('hidden', '');
    if (msg) document.querySelector('#welcomeView h2').textContent = msg;
}

function renderCategoryView(catKey) {
    document.getElementById('welcomeView').setAttribute('hidden', '');
    document.getElementById('categoryView').removeAttribute('hidden');

    const categoryData = APP_DATA[catKey];
    document.getElementById('currentCategoryTitle').textContent = categoryData.title || catKey;
    document.getElementById('currentCategoryDesc').textContent = categoryData.description || "";

    const container = document.getElementById('drugsContainer');
    container.innerHTML = '';

    const drugs = categoryData.drugs || [];

    if (drugs.length === 0) {
        container.innerHTML = '<p style="font-style:italic; color:#666;">No drugs in this category.</p>';
        return;
    }

    drugs.forEach((drug, idx) => {
        const item = document.createElement('div');
        item.className = 'drug-item';

        // Risk Badge
        let badgeHtml = '';
        if (drug.extravasationRisk) {
            const riskLower = drug.extravasationRisk.toLowerCase();
            const riskClass = riskLower.includes('vesicant') ? 'badge-vesicant' :
                riskLower.includes('irritant') ? 'badge-irritant' : 'badge';
            badgeHtml = `<span class="badge ${riskClass}">${drug.extravasationRisk}</span>`;
        }

        // Format lists for display
        const buildSection = (title, items, formatter) => {
            if (!items || items.length === 0) return '';
            return `<div class="mt-2"><strong>${title}:</strong> <ul class="pl-4 text-sm">${items.map(i => `<li>${formatter(i)}</li>`).join('')}</ul></div>`;
        };

        const sideEffectsHtml = buildSection('Key Side Effects', drug.sideEffects, (se) => {
            // Side effects can be object with keys like hematology, cardiac etc.
            if (typeof se === 'string') return se;
            return Object.entries(se).map(([sys, sym]) => `<b>${sys}:</b> ${sym}`).join('; ');
        });

        const premedsHtml = buildSection('Premedications', drug.premedications, p =>
            p.drug ? `${p.drug} (${p.route}) - ${p.timing}` : p
        );

        item.innerHTML = `
            <div class="drug-header">
                <div>
                    <span class="drug-name">${drug.name}</span>
                    <span style="margin-left:8px; font-size:0.85rem; color:#666;">${drug.classification || ''}</span>
                </div>
                <div>
                    <button class="btn-ghost" style="padding:4px;" onclick="event.stopPropagation(); deleteDrug('${catKey}', ${idx})">🗑️</button>
                    <button class="btn-ghost" style="padding:4px;" onclick="event.stopPropagation(); openDrugModal(${idx})">✏️</button>
                </div>
            </div>
            <div class="drug-meta">
                <div class="mb-2"><strong>Route:</strong> ${drug.route || 'N/A'} ${badgeHtml}</div>
                <div class="mb-2"><strong>Indication:</strong> ${Array.isArray(drug.indications) ? drug.indications.join(', ') : drug.indications}</div>
                ${sideEffectsHtml}
                ${premedsHtml}
            </div>
            <div style="font-size:0.8rem; color:#888; margin-top:8px;">Source: ${drug.source || '—'}</div>
        `;

        item.onclick = () => openDrugModal(idx);
        container.appendChild(item);
    });
}

function deleteDrug(catKey, index) {
    if (confirm("Are you sure you want to delete this drug?")) {
        APP_DATA[catKey].drugs.splice(index, 1);
        renderCategoryView(catKey);
        markUnsaved();
    }
}

// =========================================================
// 4. EDIT/ADD DRUG MODAL
// =========================================================
let currentEditIndex = null; // null for new

function openDrugModal(index) {
    if (!CURRENT_CATEGORY) return;

    currentEditIndex = index;
    const modal = document.getElementById('modal');
    modal.classList.add('open');
    document.getElementById('modalTitle').textContent = index === null ? "Add Drug" : "Edit Drug";

    // Get Drug Data
    let drug = {};
    if (index !== null) {
        drug = APP_DATA[CURRENT_CATEGORY].drugs[index];
    } else {
        // Defaults
        drug = {
            name: "",
            classification: CURRENT_CATEGORY,
            route: "",
            extravasationRisk: "Non-vesicant",
            mechanism: [],
            indications: [],
            sideEffects: [],
            premedications: [],
            requiredProphylaxis: [],
            supportiveCare: [],
            monitoring: [],
            warnings: [],
            nursingInfo: [],
            source: ""
        };
    }

    // Populate Form
    document.getElementById('editName').value = drug.name || "";
    document.getElementById('editClass').value = drug.classification || "";
    document.getElementById('editRoute').value = drug.route || "";
    document.getElementById('editRisk').value = drug.extravasationRisk || "Non-vesicant";
    document.getElementById('editSource').value = drug.source || "";

    // Text Areas for Arrays
    setTextArea('editMechanism', drug.mechanism);
    setTextArea('editIndications', drug.indications);
    setTextArea('editMonitoring', drug.monitoring);
    setTextArea('editWarnings', drug.warnings);
    setTextArea('editNursingInfo', drug.nursingInfo);

    // Complex Fields Flattened
    setTextArea('editSideEffects', flattenComplexObj(drug.sideEffects));
    setTextArea('editPremeds', flattenPremeds(drug.premedications));
    setTextArea('editProphylaxis', flattenTypeNotes(drug.requiredProphylaxis));
    setTextArea('editSupportive', flattenTypeNotes(drug.supportiveCare));
}

function setTextArea(id, array) {
    document.getElementById(id).value = (array || []).join('\n');
}

function getArrayFromTextArea(id) {
    return document.getElementById(id).value.split('\n').map(l => l.trim()).filter(Boolean);
}

// --- Flattening Helpers ---
function flattenComplexObj(arr) {
    if (!arr) return [];
    return arr.map(item => {
        if (typeof item === 'string') return item;
        // e.g. { hematology: "Anemia", cardiac: "Issues" } -> "hematology: Anemia | cardiac: Issues"
        return Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(' | ');
    });
}

function flattenPremeds(arr) {
    if (!arr) return [];
    return arr.map(p => {
        if (typeof p === 'string') return p;
        return `${p.drug || ''} | ${p.route || ''} | ${p.timing || ''}`;
    });
}

function flattenTypeNotes(arr) {
    if (!arr) return [];
    return arr.map(i => {
        if (typeof i === 'string') return i;
        return `${i.type || ''} | ${i.notes || ''}`;
    });
}

// --- Parsing Helpers ---
function parseComplexObj(strArr) {
    return strArr.map(line => {
        if (!line.includes(':')) return line;
        const obj = {};
        line.split('|').forEach(part => {
            const [k, v] = part.split(':').map(s => s.trim());
            if (k && v) obj[k] = v;
        });
        return obj;
    });
}

function parsePremeds(strArr) {
    return strArr.map(line => {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length < 2) return { drug: line, route: '', timing: '' };
        return {
            drug: parts[0],
            route: parts[1] || '',
            timing: parts[2] || ''
        };
    });
}

function parseTypeNotes(strArr) {
    return strArr.map(line => {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length < 2) return { type: line, notes: '' };
        return {
            type: parts[0],
            notes: parts[1] || ''
        };
    });
}


function closeModal() {
    document.getElementById('modal').classList.remove('open');
    currentEditIndex = null;
}

function saveDrugFromModal() {
    if (!CURRENT_CATEGORY) return;

    const newDrug = {
        name: document.getElementById('editName').value,
        classification: document.getElementById('editClass').value,
        route: document.getElementById('editRoute').value,
        extravasationRisk: document.getElementById('editRisk').value,
        mechanism: getArrayFromTextArea('editMechanism'),
        indications: getArrayFromTextArea('editIndications'),
        monitoring: getArrayFromTextArea('editMonitoring'),
        warnings: getArrayFromTextArea('editWarnings'),
        nursingInfo: getArrayFromTextArea('editNursingInfo'),
        source: document.getElementById('editSource').value,
        // Parsed fields
        sideEffects: parseComplexObj(getArrayFromTextArea('editSideEffects')),
        premedications: parsePremeds(getArrayFromTextArea('editPremeds')),
        requiredProphylaxis: parseTypeNotes(getArrayFromTextArea('editProphylaxis')),
        supportiveCare: parseTypeNotes(getArrayFromTextArea('editSupportive'))
    };

    if (!APP_DATA[CURRENT_CATEGORY].drugs) {
        APP_DATA[CURRENT_CATEGORY].drugs = [];
    }

    if (currentEditIndex === null) {
        APP_DATA[CURRENT_CATEGORY].drugs.push(newDrug);
    } else {
        APP_DATA[CURRENT_CATEGORY].drugs[currentEditIndex] = newDrug;
    }

    closeModal();
    renderCategoryView(CURRENT_CATEGORY);
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

    // Convert back to flat array if needed, or keep as categorized?
    // The request was to update based on chemoMedications.json structure.
    // That structure was a flat array. We should probably export back to that structure
    // so it's compatible with itself.

    const flatList = [];
    Object.values(APP_DATA).forEach(cat => {
        cat.drugs.forEach(d => {
            // Mapping back to original JSON format if possible, or keeping normalized?
            // Let's keep normalized but add keys to match original somewhat 'style' if needed.
            // But since the user wants to *Edit* this file, let's try to maintain the schema.
            // Actually, simply exporting the normalized structure is safer for this App.
            // But if the user expects the *exact* original format, we might need to map back.
            // For now, I will export the structure we use internally, but flatten it if it came in flat.

            // Actually, let's export exactly what we have in memory.
            // If we want to support re-importing this file, we should keep it compatible.
            // Our importer handles both structure (in theory, currently only handles flat array via processLoadedData logic addition).
            // Let's just export the flat array to be safe and consistent with the input file.

            const exportDrug = {
                name: d.name,
                class: d.classification,
                routes: d.route,
                indication: d.indications.length === 1 ? d.indications[0] : d.indications,
                extravasation_risk: d.extravasationRisk,
                side_effects: d.sideEffects,
                premedications: d.premedications,
                required_prophylaxis: d.requiredProphylaxis,
                supportive_care: d.supportiveCare,
                source: d.source,
                // Include others if they exist
                mechanism: d.mechanism,
                monitoring: d.monitoring,
                warnings: d.warnings,
                nursingInfo: d.nursingInfo
            };
            flatList.push(exportDrug);
        });
    });

    const dataStr = JSON.stringify(flatList, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "updated_chemoMedications.json";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);

    const statusObj = document.getElementById('saveStatus');
    statusObj.textContent = "Downloaded!";
    statusObj.style.color = "green";

    setTimeout(() => {
        statusObj.textContent = "";
    }, 3000);
}

function markUnsaved() {
    const el = document.getElementById('saveStatus');
    el.textContent = "Unsaved changes (click Download)";
    el.style.color = "#dc3545"; // Warning Red
}
