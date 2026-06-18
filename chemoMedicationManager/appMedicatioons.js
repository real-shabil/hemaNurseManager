
let APP_DATA = {};
let CURRENT_CATEGORY = null;

// =========================================================
// 1. INITIALIZATION & DATA LOADING
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('jsonFileInput').addEventListener('change', handleFileUpload);
    document.getElementById('downloadBtn').addEventListener('click', downloadJSON);
    document.getElementById('addDrugBtn').addEventListener('click', () => openDrugModal(null));
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('saveModalBtn').addEventListener('click', saveDrugFromModal);
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
    const getGroupKey = (name) => {
        if (!name) return '#';
        const firstChar = name.trim().charAt(0).toUpperCase();
        return /[0-9A-Z]/.test(firstChar) ? firstChar : '#';
    };

    const drugsArray = Array.isArray(json?.medications) ? json.medications : [];

    drugsArray.forEach(drug => {
        const groupKey = getGroupKey(drug.name);
        if (!APP_DATA[groupKey]) {
            APP_DATA[groupKey] = { title: groupKey, drugs: [] };
        }
        APP_DATA[groupKey].drugs.push(normalizeDrug(drug));
    });
}

// Fixed to strictly mirror the approved nested schema layout
function normalizeDrug(drug) {
    const workflow = drug.nursing_workflow || {};
    const preInfusion = workflow.pre_infusion_safety || {};
    const during = workflow.during_infusion || {};
    const post = workflow.post_infusion_care || {};
    const extravasation = during.extravasation_management || {};

    return {
        name: drug.name || "",
        extravasationRisk: extravasation.risk || "",
        extravasationAction: extravasation.action || "",
        extravasationAntidote: extravasation.antidote || "",
        monitoringGuidance: during.monitoring_frequency || "",
        fatalAlerts: preInfusion.fatal_alerts || "",
        mandatoryChecks: Array.isArray(preInfusion.mandatory_checks) ? preInfusion.mandatory_checks : [],
        premedications: Array.isArray(preInfusion.premeds) ? preInfusion.premeds : [],
        stopCriteria: Array.isArray(during.stop_criteria) ? during.stop_criteria : [],
        postInfusionAssessment: Array.isArray(post.nursing_assessment) ? post.nursing_assessment : [],
        patientEducation: post.patient_education || "",
        sideEffectTriage: drug.side_effect_triage || { report_to_physician: [], manage_at_bedside: [] },
        metadata: drug.metadata || {}
    };
}

function enableNav(enabled) {
    const navCard = document.getElementById('navCard');
    const dlBtn = document.getElementById('downloadBtn');
    if (enabled) {
        navCard.classList.remove('opacity-50', 'pointer-events-none');
        dlBtn.removeAttribute('disabled');
    } else {
        navCard.classList.add('opacity-50', 'pointer-events-none');
        dlBtn.setAttribute('disabled', 'true');
    }
}

function createListSection(title, items) {
    if (!items || items.length === 0) return null;
    const section = document.createElement('div');
    section.className = 'mt-2';
    const strong = document.createElement('strong');
    strong.textContent = `${title}:`;
    section.appendChild(strong);

    const ul = document.createElement('ul');
    ul.className = 'pl-4 text-sm';
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = String(item);
        ul.appendChild(li);
    });
    section.appendChild(ul);
    return section;
}

function createTextSection(title, text) {
    if (!text) return null;
    const section = document.createElement('div');
    section.className = 'mt-2';
    const strong = document.createElement('strong');
    strong.textContent = `${title}:`;
    section.appendChild(strong);
    const p = document.createElement('p');
    p.className = 'mt-1 text-sm';
    p.textContent = text;
    section.appendChild(p);
    return section;
}

// =========================================================
// 2. SIDEBAR RENDERING
// =========================================================
function renderCategoryList() {
    const list = document.getElementById('categoryList');
    list.innerHTML = '';

    if (!APP_DATA || Object.keys(APP_DATA).length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.style.color = '#666';
        emptyItem.style.fontStyle = 'italic';
        emptyItem.textContent = 'No categories found.';
        list.appendChild(emptyItem);
        return;
    }

    Object.keys(APP_DATA).sort().forEach(key => {
        const li = document.createElement('li');
        li.textContent = APP_DATA[key].title || key;
        if (CURRENT_CATEGORY === key) li.classList.add('active');
        li.onclick = () => {
            CURRENT_CATEGORY = key;
            renderCategoryList();
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
    
    const container = document.getElementById('drugsContainer');
    container.innerHTML = '';
    const drugs = categoryData.drugs || [];

    if (drugs.length === 0) {
        const message = document.createElement('p');
        message.style.fontStyle = 'italic';
        message.style.color = '#666';
        message.textContent = 'No drugs in this category.';
        container.appendChild(message);
        return;
    }

    drugs.forEach((drug, idx) => {
        const item = document.createElement('div');
        item.className = 'drug-item';

        const header = document.createElement('div');
        header.className = 'drug-header';

        const titleGroup = document.createElement('div');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'drug-name';
        nameSpan.textContent = drug.name || '';
        titleGroup.appendChild(nameSpan);

        const actions = document.createElement('div');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-ghost';
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteDrug(catKey, idx);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-ghost';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDrugModal(idx);
        });

        actions.appendChild(deleteBtn);
        actions.appendChild(editBtn);
        header.appendChild(titleGroup);
        header.appendChild(actions);
        item.appendChild(header);

        const meta = document.createElement('div');
        meta.className = 'drug-meta';

        if (drug.extravasationRisk) {
            const div = document.createElement('div');
            div.className = 'mb-2';
            const label = document.createElement('strong');
            label.textContent = 'Extravasation Risk: ';
            div.appendChild(label);
            const badge = document.createElement('span');
            const riskLower = drug.extravasationRisk.toLowerCase();
            badge.className = `badge ${riskLower.includes('vesicant') ? 'badge-vesicant' : riskLower.includes('irritant') ? 'badge-irritant' : ''}`;
            badge.textContent = drug.extravasationRisk;
            div.appendChild(badge);
            meta.appendChild(div);
        }

        const fatalAlertsSection = createTextSection('Fatal Alerts', drug.fatalAlerts);
        if (fatalAlertsSection) meta.appendChild(fatalAlertsSection);

        const checksSection = createListSection('Mandatory Safety Checks', drug.mandatoryChecks);
        if (checksSection) meta.appendChild(checksSection);

        const premedsSection = createListSection('Premedications', drug.premedications);
        if (premedsSection) meta.appendChild(premedsSection);

        const monitoringSection = createTextSection('Monitoring Frequency', drug.monitoringGuidance);
        if (monitoringSection) meta.appendChild(monitoringSection);

        const stopSection = createListSection('Stop Criteria', drug.stopCriteria);
        if (stopSection) meta.appendChild(stopSection);

        const postAssessmentSection = createListSection('Post-Infusion Assessment', drug.postInfusionAssessment);
        if (postAssessmentSection) meta.appendChild(postAssessmentSection);

        const patientEducationSection = createTextSection('Patient Education', drug.patientEducation);
        if (patientEducationSection) meta.appendChild(patientEducationSection);

        const triage = drug.sideEffectTriage || {};
        const reportSection = createListSection('Report to Physician', triage.report_to_physician || []);
        const bedsideSection = createListSection('Manage at Bedside', triage.manage_at_bedside || []);
        if (reportSection) meta.appendChild(reportSection);
        if (bedsideSection) meta.appendChild(bedsideSection);

        item.appendChild(meta);

        const sourceDiv = document.createElement('div');
        sourceDiv.style.fontSize = '0.8rem';
        sourceDiv.style.color = '#888';
        sourceDiv.style.marginTop = '8px';
        sourceDiv.textContent = 'Evidence source: ' + (drug.metadata?.evidence_source || '—');
        item.appendChild(sourceDiv);

        item.addEventListener('click', () => openDrugModal(idx));
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
let currentEditIndex = null;

function openDrugModal(index) {
    if (!CURRENT_CATEGORY) return;

    currentEditIndex = index;
    const modal = document.getElementById('modal');
    modal.classList.add('open');
    document.getElementById('modalTitle').textContent = index === null ? "Add Drug" : "Edit Drug";

    let drug = {};
    if (index !== null) {
        drug = APP_DATA[CURRENT_CATEGORY].drugs[index];
    } else {
        drug = {
            name: "",
            extravasationRisk: "Non-vesicant",
            extravasationAction: "",
            extravasationAntidote: "",
            monitoringGuidance: "",
            fatalAlerts: "",
            mandatoryChecks: [],
            premedications: [],
            stopCriteria: [],
            postInfusionAssessment: [],
            patientEducation: "",
            sideEffectTriage: { report_to_physician: [], manage_at_bedside: [] },
            metadata: { last_updated: new Date().toISOString().split('T')[0], evidence_source: "" }
        };
    }

    // Direct state matching elements mapping
    document.getElementById('editName').value = drug.name || "";
    document.getElementById('editRisk').value = drug.extravasationRisk || "Non-vesicant";
    document.getElementById('editExtravasationAction').value = drug.extravasationAction || "";
    document.getElementById('editExtravasationAntidote').value = drug.extravasationAntidote || "";
    document.getElementById('editFatalAlerts').value = drug.fatalAlerts || "";
    document.getElementById('editMonitoring').value = drug.monitoringGuidance || "";
    document.getElementById('editPatientEducation').value = drug.patientEducation || "";
    document.getElementById('editSource').value = drug.metadata?.evidence_source || "";
    document.getElementById('editLastUpdated').value = drug.metadata?.last_updated || new Date().toISOString().split('T')[0];

    // Map clean primitive array strings directly to fields
    setTextArea('editMandatoryChecks', drug.mandatoryChecks);
    setTextArea('editPremeds', drug.premedications);
    setTextArea('editStopCriteria', drug.stopCriteria);
    setTextArea('editPostInfusionAssessment', drug.postInfusionAssessment);
    setTextArea('editReportToPhysician', drug.sideEffectTriage?.report_to_physician);
    setTextArea('editManageAtBedside', drug.sideEffectTriage?.manage_at_bedside);
}

function setTextArea(id, array) {
    const el = document.getElementById(id);
    if (el) el.value = (array || []).join('\n');
}

function getArrayFromTextArea(id) {
    const el = document.getElementById(id);
    return el ? el.value.split('\n').map(l => l.trim()).filter(Boolean) : [];
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
    currentEditIndex = null;
}

function saveDrugFromModal() {
    if (!CURRENT_CATEGORY) return;

    const newDrug = {
        name: document.getElementById('editName').value,
        extravasationRisk: document.getElementById('editRisk').value,
        extravasationAction: document.getElementById('editExtravasationAction').value,
        extravasationAntidote: document.getElementById('editExtravasationAntidote').value,
        monitoringGuidance: document.getElementById('editMonitoring').value,
        fatalAlerts: document.getElementById('editFatalAlerts').value,
        patientEducation: document.getElementById('editPatientEducation').value,
        mandatoryChecks: getArrayFromTextArea('editMandatoryChecks'),
        premedications: getArrayFromTextArea('editPremeds'), // Saved as pure string arrays
        stopCriteria: getArrayFromTextArea('editStopCriteria'),
        postInfusionAssessment: getArrayFromTextArea('editPostInfusionAssessment'),
        sideEffectTriage: {
            report_to_physician: getArrayFromTextArea('editReportToPhysician'),
            manage_at_bedside: getArrayFromTextArea('editManageAtBedside')
        },
        metadata: {
            last_updated: document.getElementById('editLastUpdated').value,
            evidence_source: document.getElementById('editSource').value
        }
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

    const medications = [];
    Object.values(APP_DATA).forEach(cat => {
        cat.drugs.forEach(d => {
            const exportDrug = {
                name: d.name,
                metadata: {
                    last_updated: d.metadata?.last_updated || new Date().toISOString().split('T')[0],
                    evidence_source: d.metadata?.evidence_source || ""
                },
                nursing_workflow: {
                    pre_infusion_safety: {
                        fatal_alerts: d.fatalAlerts || "",
                        mandatory_checks: d.mandatoryChecks || [],
                        premeds: d.premedications || []
                    },
                    during_infusion: {
                        extravasation_management: {
                            risk: d.extravasationRisk || "",
                            action: d.extravasationAction || "",
                            antidote: d.extravasationAntidote || ""
                        },
                        monitoring_frequency: d.monitoringGuidance || "",
                        stop_criteria: d.stopCriteria || []
                    },
                    post_infusion_care: {
                        nursing_assessment: d.postInfusionAssessment || [],
                        patient_education: d.patientEducation || ""
                    }
                },
                side_effect_triage: {
                    report_to_physician: d.sideEffectTriage?.report_to_physician || [],
                    manage_at_bedside: d.sideEffectTriage?.manage_at_bedside || []
                }
            };
            medications.push(exportDrug);
        });
    });

    const dataStr = JSON.stringify({ medications }, null, 4);
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
    setTimeout(() => { statusObj.textContent = ""; }, 3000);
}

function markUnsaved() {
    const el = document.getElementById('saveStatus');
    el.textContent = "Unsaved changes (click Download)";
    el.style.color = "#dc3545";
}
