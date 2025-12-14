
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
            APP_DATA = json;
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
function renderCategoryList() {
    const list = document.getElementById('categoryList');
    list.innerHTML = '';

    if (!APP_DATA || Object.keys(APP_DATA).length === 0) {
        list.innerHTML = '<li style="color:#666; font-style:italic;">No categories found.</li>';
        return;
    }

    Object.keys(APP_DATA).forEach(key => {
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
            const riskClass = drug.extravasationRisk === 'Vesicant' ? 'badge-vesicant' : 
                              drug.extravasationRisk === 'Irritant' ? 'badge-irritant' : 'badge';
            badgeHtml = `<span class="badge ${riskClass}">${drug.extravasationRisk}</span>`;
        }

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
                <strong>Route:</strong> ${drug.route || 'N/A'} ${badgeHtml}
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
            classification: "",
            route: "",
            extravasationRisk: "Non-vesicant",
            mechanism: [],
            indications: [],
            sideEffects: [],
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
    setTextArea('editSideEffects', drug.sideEffects);
    setTextArea('editMonitoring', drug.monitoring);
    setTextArea('editWarnings', drug.warnings);
    setTextArea('editNursingInfo', drug.nursingInfo);
}

function setTextArea(id, array) {
    document.getElementById(id).value = (array || []).join('\n');
}

function getArrayFromTextArea(id) {
    return document.getElementById(id).value.split('\n').map(l => l.trim()).filter(Boolean);
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
        sideEffects: getArrayFromTextArea('editSideEffects'),
        monitoring: getArrayFromTextArea('editMonitoring'),
        warnings: getArrayFromTextArea('editWarnings'),
        nursingInfo: getArrayFromTextArea('editNursingInfo'),
        source: document.getElementById('editSource').value
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

    const dataStr = JSON.stringify(APP_DATA, null, 4);
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
