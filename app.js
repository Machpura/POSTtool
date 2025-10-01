let nodes = {};
let currentNode = null;
let historyStack = [];
let startNode = null;

/* --------------------------
 *   Tree Loader
 * --------------------------- */
function loadTree(filename, startNodeId, skipIntake = false) {
    fetch(filename)
    .then(res => res.json())
    .then(data => {
        nodes = data.nodes.reduce((map, node) => {
            map[node.id] = node;
            return map;
        }, {});
        startNode = startNodeId;
        historyStack = [];

        if (skipIntake) {
            const intake = document.getElementById("intake-form");
            if (intake) intake.innerHTML = "";
        }

        start(startNodeId);
    })
    .catch(err => {
        console.error("Failed to load JSON:", err);
    });
}

function start(nodeId) {
    currentNode = nodes[nodeId];
    renderNode();
}

function renderNode() {
    if (!currentNode) return;

    if (currentNode.requiresNotDone || currentNode.requiresDone) {
        const doneSteps = getChecklistState();

        if (currentNode.requiresNotDone?.some(step => doneSteps.includes(step))) {
            if (currentNode.nextIfSkipped) {
                currentNode = nodes[currentNode.nextIfSkipped];
                return renderNode();
            }
        }

        if (currentNode.requiresDone?.some(step => !doneSteps.includes(step))) {
            if (currentNode.nextIfSkipped) {
                currentNode = nodes[currentNode.nextIfSkipped];
                return renderNode();
            }
        }
    }

    // Filter GPU options based on intake data
    if (currentNode.options && intakeData.graphics) {
        const filteredOptions = {};
        for (const [optionText, optionData] of Object.entries(currentNode.options)) {
            // Skip GPU reseat/power options if no dedicated GPU
            if ((optionData.requiresGPU === 'dedicated') && !intakeData.graphics.includes('dedicated')) {
                continue;
            }
            // Skip iGPU test if no integrated graphics
            if ((optionData.requiresGPU === 'integrated') && !intakeData.graphics.includes('integrated')) {
                continue;
            }
            filteredOptions[optionText] = optionData;
        }
        currentNode.options = filteredOptions;
    }

    const questionContainer = document.getElementById("question-container");
    const optionsContainer = document.getElementById("options-container");
    const resultContainer = document.getElementById("result-container");
    const knowledgeContainer = document.getElementById("knowledge-base");

    questionContainer.innerHTML = "";
    optionsContainer.innerHTML = "";
    resultContainer.innerHTML = "";
    resultContainer.style.display = "none";
    knowledgeContainer.innerHTML = "";
    knowledgeContainer.style.display = "none";

    if (currentNode.question) {
        questionContainer.textContent = currentNode.question;

        for (const [optionText, optionData] of Object.entries(currentNode.options)) {
            const btn = document.createElement("button");
            btn.textContent = optionText;

            btn.onclick = () => {
                historyStack.push(currentNode.id);

                if (optionData.markChecklist) {
                    if (Array.isArray(optionData.markChecklist)) {
                        optionData.markChecklist.forEach(stepId => markChecklistDone(stepId));
                    } else {
                        markChecklistDone(optionData.markChecklist);
                    }
                }

                currentNode = nodes[optionData.next];
                renderNode();
            };

            optionsContainer.appendChild(btn);
        }
    } else if (currentNode.result) {
        resultContainer.textContent = currentNode.result;
        resultContainer.style.display = "block";
    }

    if (currentNode.knowledge) {
        let kbHTML = `<h2>Knowledge Base</h2>`;
        if (currentNode.knowledge.text) {
            kbHTML += `<p>${currentNode.knowledge.text}</p>`;
        }
        if (currentNode.knowledge.video) {
            kbHTML += `<iframe src="${currentNode.knowledge.video}" frameborder="0" allowfullscreen></iframe>`;
        }
        knowledgeContainer.innerHTML = kbHTML;
        knowledgeContainer.style.display = "block";
    }

    if (historyStack.length > 0 || startNode) {
        const navContainer = document.createElement("div");
        navContainer.classList.add("nav-buttons");

        if (historyStack.length > 0) {
            const backBtn = document.createElement("button");
            backBtn.textContent = "⬅ Back";
            backBtn.onclick = () => {
                const prevNodeId = historyStack.pop();
                currentNode = nodes[prevNodeId];
                renderNode();
            };
            navContainer.appendChild(backBtn);
        }

        if (startNode) {
            const restartBtn = document.createElement("button");
            restartBtn.textContent = "⟳ Restart This Tree";
            restartBtn.onclick = () => {
                historyStack = [];
                currentNode = nodes[startNode];
                renderNode();
            };
            navContainer.appendChild(restartBtn);
        }

        optionsContainer.appendChild(navContainer);
    }
}

/* --------------------------
 *   Checklist Helpers
 * --------------------------- */
function getChecklistState() {
    return Array.from(
        document.querySelectorAll("#checklist-content input[type=checkbox]:checked")
    ).map(cb => cb.id);
}

function markChecklistDone(stepId) {
    const box = document.getElementById(stepId);
    if (box && !box.checked) {
        box.checked = true;
    }
}

/* --------------------------
 *   Shared Checklist Data
 * --------------------------- */
const checklistData = {
    Power: [
        { id: "ac_outlet_swap", text: "Test wall outlet with another device" },
        { id: "psu_switch_on", text: "Verify PSU rear switch is ON" },
        { id: "psu_test", text: "Perform PSU paperclip/self-test" },
        { id: "psu_known_good", text: "Try a known-good PSU" },
        { id: "mobo_24pin_seated", text: "Verify 24-pin ATX connector is fully seated" },
        { id: "cpu_8pin_seated", text: "Verify 8-pin EPS CPU power is fully seated" },
        { id: "pwr_sw_short", text: "Bypass case button (short PWR_SW pins)" }
    ],
    Motherboard: [
        { id: "standoffs_ok", text: "Verify correct motherboard standoff placement" },
        { id: "bench_test", text: "Breadboard test outside case (CPU + 1 RAM only)" },
        { id: "cmos_reset", text: "Clear CMOS (reset BIOS settings)" },
        { id: "bios_flashback", text: "Update BIOS via Flashback/Q-Flash" }
    ],
    CPU: [
        { id: "eps_cables", text: "Check CPU EPS power cables" },
        { id: "cpu_reseat", text: "Reseat CPU and check socket pins" },
        { id: "cooler_mounted", text: "Verify CPU cooler is properly mounted" },
        { id: "cooler_pressure", text: "Check cooler mounting pressure" },
        { id: "cpu_compatibility", text: "Verify CPU/motherboard compatibility" }
    ],
    Memory: [
        { id: "ram_reseat", text: "Reseat all RAM sticks" },
        { id: "ram_single_stick", text: "Try one RAM stick in slot A2" },
        { id: "ram_slot_rotate", text: "Rotate through RAM sticks and slots" }
    ],
    GPU: [
        { id: "gpu_reseat", text: "Reseat GPU in primary PCIe slot" },
        { id: "gpu_power", text: "Verify PCIe power cables" },
        { id: "gpu_different_slot", text: "Try GPU in different PCIe slot" },
        { id: "igpu_test", text: "Test onboard graphics (if available)" }
    ],
    Storage: [
        { id: "drives_unplugged", text: "Disconnect drives to isolate boot device" },
        { id: "bios_boot_order", text: "Check BIOS boot order" }
    ],
    Other: [
        { id: "monitor_cable_check", text: "Verify monitor cable and input source" },
        { id: "usb_devices_removed", text: "Remove all USB devices except keyboard" },
        { id: "reset_switch_disconnected", text: "Disconnect RESET switch header" }
    ]
};

/* --------------------------
 *   Checklist Renderer
 * --------------------------- */
function renderChecklist() {
    const container = document.getElementById("checklist-content");
    if (!container) return;

    container.innerHTML = "";

    for (const [category, steps] of Object.entries(checklistData)) {
        const section = document.createElement("div");
        const header = document.createElement("h3");
        header.textContent = category;
        section.appendChild(header);

        steps.forEach(step => {
            const item = document.createElement("div");
            item.className = "checklist-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = step.id;

            const label = document.createElement("label");
            label.htmlFor = step.id;
            label.textContent = step.text;

            item.appendChild(checkbox);
            item.appendChild(label);
            section.appendChild(item);

            checkbox.addEventListener("change", () => {
                const intakeBox = document.querySelector(
                    `#intake-form input[type=checkbox][value="${step.id}"]`
                );
                if (intakeBox) intakeBox.checked = checkbox.checked;
            });
        });

        container.appendChild(section);
    }
}

/* --------------------------
 *   Dark Mode Toggle
 * --------------------------- */
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("theme", "dark");
    } else {
        localStorage.setItem("theme", "light");
    }
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    } else {
        document.body.classList.remove("dark-mode");
    }
}

/* --------------------------
 *   Page Setup
 * --------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    renderChecklist();
    renderIntakeForm();
    applySavedTheme();

    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", toggleDarkMode);
    }

    /* --------------------------
     *   Intro Modal
     * --------------------------- */
    const modal = document.getElementById("intro-modal");
    const closeBtn = document.getElementById("close-intro");
    if (modal && closeBtn) {
        modal.classList.remove("hidden");

        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
            sessionStorage.setItem("introDismissed", "1");
        });
    }
});

/* --------------------------
 *   Intake Wizard
 * --------------------------- */
let intakeStep = 1;
let intakeData = {
    history: null,
    hardwareChanged: [],
    symptoms: [],
    debug: null,
    graphics: [],
    checklist: []
};

function renderIntakeForm(reset = false) {
    const intake = document.getElementById("intake-form");
    if (!intake) return;

    if (reset) {
        intakeStep = 1;
        intakeData = { history: null, hardwareChanged: [], symptoms: [], debug: null, graphics: [], checklist: [] };
        document.getElementById("question-container").innerHTML = "";
        document.getElementById("options-container").innerHTML = "";
        document.getElementById("result-container").innerHTML = "";
        document.getElementById("knowledge-base").innerHTML = "";
    }

    intake.innerHTML = "";

    // Step 1: System History
    if (intakeStep === 1) {
        intake.innerHTML = `
        <div class="intake-step">
        <h2>System History</h2>
        <div class="intake-options">
        <label><input type="radio" name="history" value="new_build"> New build (never worked)</label><br>
        <label><input type="radio" name="history" value="hardware_change"> Recent hardware change</label><br>
        <label><input type="radio" name="history" value="was_working"> Was working, now isn't</label><br>
        </div>
        <div id="hardware-change-detail" style="display:none; margin-top:15px; padding-left:20px;">
        <p><strong>What changed?</strong></p>
        <label><input type="checkbox" value="CPU/Motherboard"> CPU/Motherboard</label><br>
        <label><input type="checkbox" value="RAM"> RAM</label><br>
        <label><input type="checkbox" value="GPU"> GPU</label><br>
        <label><input type="checkbox" value="PSU"> PSU</label><br>
        <label><input type="checkbox" value="Storage"> Storage</label><br>
        </div>
        <div class="intake-actions">
        <button onclick="nextIntakeStep()">Next →</button>
        </div>
        </div>`;

        // Show hardware change detail if selected
        const radios = intake.querySelectorAll('input[name="history"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const detail = document.getElementById('hardware-change-detail');
                if (e.target.value === 'hardware_change') {
                    detail.style.display = 'block';
                } else {
                    detail.style.display = 'none';
                }
            });
        });
    }
    // Step 2: System Symptoms
    else if (intakeStep === 2) {
        intake.innerHTML = `
        <div class="intake-step">
        <h2>System Symptoms</h2>
        <p style="font-size:0.9em; color:#666; margin-bottom:10px;">What happens when you press the power button? (Select all that apply)</p>
        <div class="intake-options">
        <label><input type="checkbox" value="no_power"> No power at all (no fans, LEDs, or sounds)</label><br>
        <label><input type="checkbox" value="instant_shutdown"> Powers on, then instant shutdown (less than 1 second)</label><br>
        <label><input type="checkbox" value="power_cycles"> Powers on, then cycles/reboots repeatedly (3-5+ seconds)</label><br>
        <label><input type="checkbox" value="fans_no_display"> Fans spin / LEDs on, but no display</label><br>
        <label><input type="checkbox" value="boots_display"> Boots successfully and shows display</label><br>
        <label><input type="checkbox" value="fans_max"> Fans spin to max immediately</label><br>
        <label><input type="checkbox" value="beep_codes"> Beep codes heard</label><br>
        </div>
        <div class="intake-actions">
        <button onclick="prevIntakeStep()">← Back</button>
        <button onclick="nextIntakeStep()">Next →</button>
        </div>
        </div>`;
    }
    // Step 3: Debug Features
    else if (intakeStep === 3) {
        intake.innerHTML = `
        <div class="intake-step">
        <h2>Debug Features</h2>
        <p style="font-size:0.9em; color:#666; margin-bottom:10px;">What diagnostic features does your motherboard have?</p>
        <div class="intake-options">
        <label><input type="radio" name="debug" value="none"> None</label><br>
        <label><input type="radio" name="debug" value="beep"> Beep Speaker</label><br>
        <label><input type="radio" name="debug" value="leds"> Debug LEDs (CPU, DRAM, VGA, BOOT)</label><br>
        <label><input type="radio" name="debug" value="codes"> Debug Code Display (hex codes)</label><br>
        </div>
        <div class="intake-actions">
        <button onclick="prevIntakeStep()">← Back</button>
        <button onclick="nextIntakeStep()">Next →</button>
        </div>
        </div>`;
    }
    // Step 4: Graphics Setup
    else if (intakeStep === 4) {
        intake.innerHTML = `
        <div class="intake-step">
        <h2>Graphics Setup</h2>
        <p style="font-size:0.9em; color:#666; margin-bottom:10px;">What graphics does this system have? (Select all that apply)</p>
        <div class="intake-options">
        <label><input type="checkbox" value="dedicated"> Dedicated GPU (graphics card)</label><br>
        <label><input type="checkbox" value="integrated"> Integrated graphics (CPU/iGPU/APU)</label><br>
        </div>
        <div class="intake-actions">
        <button onclick="prevIntakeStep()">← Back</button>
        <button onclick="nextIntakeStep()">Next →</button>
        </div>
        </div>`;
    }
    // Step 5: Checklist
    else if (intakeStep === 5) {
        let checklistHTML = "";
        for (const [category, steps] of Object.entries(checklistData)) {
            checklistHTML += `<h3>${category}</h3>`;
            steps.forEach(step => {
                const mainChecked = document.getElementById(step.id)?.checked ? "checked" : "";
                checklistHTML += `
                <label>
                <input type="checkbox" value="${step.id}" ${mainChecked}> ${step.text}
                </label><br>`;
            });
        }

        intake.innerHTML = `
        <div class="intake-step">
        <h2>Diagnostic Steps Already Tried</h2>
        <p style="font-size:0.9em; color:#666; margin-bottom:10px;">Check any steps you've already performed:</p>
        <div class="intake-options">${checklistHTML}</div>
        <div class="intake-actions">
        <button onclick="prevIntakeStep()">← Back</button>
        <button onclick="startDiagnosis()">Start Diagnosis</button>
        </div>
        </div>`;

        syncIntakeToChecklist();
    }
}

function nextIntakeStep() {
    if (intakeStep === 1) {
        const selected = document.querySelector('input[name="history"]:checked');
        if (!selected) {
            alert("Please select an option before continuing.");
            return;
        }
        intakeData.history = selected.value;

        // Capture hardware change details if applicable
        if (intakeData.history === 'hardware_change') {
            const checked = Array.from(
                document.querySelectorAll('#hardware-change-detail input[type=checkbox]:checked')
            );
            intakeData.hardwareChanged = checked.map(cb => cb.value);
        }
    } else if (intakeStep === 2) {
        const checked = Array.from(
            document.querySelectorAll("#intake-form input[type=checkbox]:checked")
        );
        if (checked.length === 0) {
            alert("Please select at least one symptom before continuing.");
            return;
        }
        intakeData.symptoms = checked.map(cb => cb.value);
    } else if (intakeStep === 3) {
        const dbg = document.querySelector("#intake-form input[name=debug]:checked");
        if (!dbg) {
            alert("Please select a debug feature option before continuing.");
            return;
        }
        intakeData.debug = dbg.value;
    } else if (intakeStep === 4) {
        const checked = Array.from(
            document.querySelectorAll("#intake-form input[type=checkbox]:checked")
        );
        if (checked.length === 0) {
            alert("Please select at least one graphics option before continuing.");
            return;
        }
        intakeData.graphics = checked.map(cb => cb.value);
    }
    intakeStep++;
    renderIntakeForm();
}

function prevIntakeStep() {
    intakeStep--;
    renderIntakeForm();
}

function startDiagnosis() {
    intakeData.checklist = Array.from(
        document.querySelectorAll("#intake-form input[type=checkbox]:checked")
    ).map(cb => cb.value);

    intakeData.checklist.forEach(doneStep => markChecklistDone(doneStep));

    // Routing logic based on intake data
    let startNodeId = "no_power_root";

    // Primary routing by symptom
    if (intakeData.symptoms.includes("no_power")) {
        startNodeId = "no_power_root";
    }
    else if (intakeData.symptoms.includes("instant_shutdown")) {
        if (intakeData.history === "new_build") {
            startNodeId = "instant_shutdown_new_build";
        } else {
            startNodeId = "instant_shutdown_root";
        }
    }
    else if (intakeData.symptoms.includes("power_cycles")) {
        startNodeId = "power_cycles_root";
    }
    else if (intakeData.symptoms.includes("fans_max")) {
        startNodeId = "fans_max_root";
    }
    else if (intakeData.symptoms.includes("fans_no_display")) {
        // Check for debug features first
        if (intakeData.debug === "beep") {
            startNodeId = "beep_root";
        } else if (intakeData.debug === "leds") {
            startNodeId = "led_root";
        } else if (intakeData.debug === "codes") {
            startNodeId = "code_root";
        } else {
            // No debug - check build type
            if (intakeData.history === "new_build") {
                startNodeId = "no_display_new_build";
            } else {
                startNodeId = "no_display_no_debug";
            }
        }
    }
    else if (intakeData.symptoms.includes("boots_display")) {
        startNodeId = "boot_success";
    }

    loadTree("master_path.json", startNodeId);
    document.getElementById("intake-form").innerHTML = "";
}

/* --------------------------
 *   Checklist <-> Intake Sync
 * --------------------------- */
function syncIntakeToChecklist() {
    const intakeChecks = document.querySelectorAll("#intake-form input[type=checkbox]");
    intakeChecks.forEach(cb => {
        cb.addEventListener("change", () => {
            const mainCheckbox = document.getElementById(cb.value);
            if (mainCheckbox) {
                mainCheckbox.checked = cb.checked;
            }
        });
    });
}

/* --------------------------
 *   Export/Import Functions
 * --------------------------- */
function exportDiagnosticData() {
    const exportData = {
        intake: intakeData,
        checklist: getChecklistState(),
        path: historyStack,
        current: currentNode?.id || null
    };

    // Convert to base64 string
    const jsonStr = JSON.stringify(exportData);
    const base64 = btoa(jsonStr);

    // Generate human-readable report
    const report = generateReport(exportData, base64);

    // Store report globally for download function
    window.currentReport = report;

    // Copy to clipboard
    navigator.clipboard.writeText(report).then(() => {
        showExportModal();
    }).catch(() => {
        // Fallback if clipboard API fails
        const textarea = document.createElement('textarea');
        textarea.value = report;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showExportModal();
    });
}

function showExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function downloadReport() {
    if (!window.currentReport) return;

    const blob = new Blob([window.currentReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POST-diagnostic-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    closeExportModal();
}

function generateReport(data, resumeCode) {
    let report = `=== POST DIAGNOSTIC REPORT ===\n`;
    report += `Generated: ${new Date().toLocaleString()}\n\n`;

    report += `SYSTEM INFO:\n`;
    const historyLabels = {
        'new_build': 'New build (never worked)',
        'hardware_change': 'Recent hardware change',
        'was_working': 'Was working, now isn\'t'
    };
    report += `- History: ${historyLabels[data.intake.history] || data.intake.history}\n`;

    if (data.intake.hardwareChanged?.length > 0) {
        report += `- Hardware Changed: ${data.intake.hardwareChanged.join(', ')}\n`;
    }

    report += `\nSYMPTOMS:\n`;
    data.intake.symptoms.forEach(s => {
        report += `- ${s.replace(/_/g, ' ')}\n`;
    });

    report += `\nDEBUG FEATURES:\n- ${data.intake.debug}\n`;

    report += `\nGRAPHICS:\n`;
    data.intake.graphics.forEach(g => {
        report += `- ${g}\n`;
    });

    report += `\nSTEPS COMPLETED (${data.checklist.length}):\n`;
    if (data.checklist.length === 0) {
        report += `(none)\n`;
    } else {
        data.checklist.forEach(step => {
            const item = Object.values(checklistData).flat().find(s => s.id === step);
            if (item) report += `✓ ${item.text}\n`;
        });
    }

    report += `\nDIAGNOSTIC PATH (${data.path.length + 1} steps):\n`;
    if (data.path.length === 0) {
        report += `1. Started at: ${data.current}\n`;
    } else {
        data.path.forEach((nodeId, i) => {
            report += `${i + 1}. ${nodeId}\n`;
        });
        report += `→ Currently at: ${data.current}\n`;
    }

    report += `\n=== RESUME CODE ===\n`;
    report += resumeCode;
    report += `\n\nTo resume this diagnostic session, click the "Import/Resume" button and paste this code.`;

    return report;
}

function showImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('import-code-input').value = '';
    }
}

function importDiagnosticData() {
    const codeInput = document.getElementById('import-code-input');
    const base64Code = codeInput.value.trim();

    if (!base64Code) {
        alert('Please paste a resume code.');
        return;
    }

    try {
        const jsonStr = atob(base64Code);
        const data = JSON.parse(jsonStr);

        // Restore intake data
        intakeData = data.intake;

        // Restore checklist state
        data.checklist.forEach(stepId => markChecklistDone(stepId));

        // Restore diagnostic position
        historyStack = data.path;

        // Load tree at current position
        fetch("master_path.json")
        .then(res => res.json())
        .then(treeData => {
            nodes = treeData.nodes.reduce((map, node) => {
                map[node.id] = node;
                return map;
            }, {});

            currentNode = nodes[data.current];
            startNode = data.current;
            renderNode();

            closeImportModal();
            alert('Diagnostic session restored successfully!');

            // Clear intake form since we're resuming
            const intake = document.getElementById("intake-form");
            if (intake) intake.innerHTML = "";
        })
        .catch(err => {
            console.error("Failed to load tree:", err);
            alert('Error loading diagnostic tree.');
        });

    } catch(e) {
        console.error('Import error:', e);
        alert('Invalid resume code. Please check the code and try again.');
    }
}
