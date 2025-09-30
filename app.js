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
        { id: "mobo_power_cables", text: "Verify 24-pin ATX and 8-pin EPS connectors" },
        { id: "pwr_sw_short", text: "Bypass case button (short PWR_SW pins)" }
    ],
    Motherboard: [
        { id: "standoffs_ok", text: "Verify correct motherboard standoff placement" },
        { id: "bench_test", text: "Breadboard test outside case (CPU + 1 RAM only)" },
        { id: "cmos_reset", text: "Clear CMOS (reset BIOS settings)" }
    ],
    CPU: [
        { id: "eps_cables", text: "Check CPU EPS power cables" },
        { id: "cpu_reseat", text: "Reseat CPU and check socket pins" },
        { id: "cooler_pressure", text: "Check cooler mounting pressure" }
    ],
    Memory: [
        { id: "ram_reseat", text: "Reseat all RAM sticks" },
        { id: "ram_single_stick", text: "Try one RAM stick in slot A2" },
        { id: "ram_slot_rotate", text: "Rotate through RAM sticks and slots" }
    ],
    GPU: [
        { id: "gpu_reseat", text: "Reseat GPU in primary PCIe slot" },
        { id: "gpu_power", text: "Verify PCIe power cables" },
        { id: "igpu_test", text: "Test onboard graphics (if available)" }
    ],
    Storage: [
        { id: "drives_unplugged", text: "Disconnect drives to isolate boot device" },
        { id: "bios_boot_order", text: "Check BIOS boot order" }
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
     *   Intro modal (robust)
     * --------------------------- */
    (() => {
        const modal = document.getElementById("intro-modal");
        const closeBtn = document.getElementById("close-intro");
        if (!modal || !closeBtn) return;

        // Show once per session (remove this block if you want it every load)
        if (sessionStorage.getItem("introDismissed") === "1") {
            modal.classList.add("hidden");
        } else {
            modal.classList.remove("hidden");
        }

        // Primary close handler
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
            sessionStorage.setItem("introDismissed", "1");
        });

        // Extra safety: delegated listener (works even if the button is re-rendered)
        document.addEventListener("click", (e) => {
            const btn = e.target.closest("#close-intro");
            if (!btn) return;
            modal.classList.add("hidden");
            sessionStorage.setItem("introDismissed", "1");
        });
    })();




/* --------------------------
 *   Intake Wizard
 * --------------------------- */
let intakeStep = 1;
let intakeData = { symptoms: [], debug: null, graphics: [], checklist: [] };

function renderIntakeForm(reset = false) {
    const intake = document.getElementById("intake-form");
    if (!intake) return;

    if (reset) {
        intakeStep = 1;
        intakeData = { symptoms: [], debug: null, graphics: [], checklist: [] };
        document.getElementById("question-container").innerHTML = "";
        document.getElementById("options-container").innerHTML = "";
        document.getElementById("result-container").innerHTML = "";
        document.getElementById("knowledge-base").innerHTML = "";
    }

    intake.innerHTML = "";

    if (intakeStep === 1) {
        intake.innerHTML = `
        <div class="intake-step">
        <h2>System Symptoms – What do you see when you hit the power button?</h2>
        <div class="intake-options">
        <label><input type="checkbox" value="no_power"> No power at all (no fans, LEDs, sounds)</label><br>
        <label><input type="checkbox" value="fans_no_display"> Fans spin / LEDs on, but no display</label><br>
        <label><input type="checkbox" value="power_cycles"> Turns on briefly, then shuts off / cycles</label><br>
        <label><input type="checkbox" value="boots_display"> Turns on, stays on, and shows display</label><br>
        <label><input type="checkbox" value="fans_max"> Fans spin to max immediately</label><br>
        <label><input type="checkbox" value="beep_codes"> Beep codes heard</label><br>
        </div>
        <div class="intake-actions">
        <button onclick="nextIntakeStep()">Next →</button>
        </div>
        </div>`;
    } else if (intakeStep === 2) {
        intake.innerHTML = `
        <div class="intake-step">
        <h2>Debug Features – What diagnostic features does your board have?</h2>
        <div class="intake-options">
        <label><input type="radio" name="debug" value="none"> None</label><br>
        <label><input type="radio" name="debug" value="beep"> Beep Speaker</label><br>
        <label><input type="radio" name="debug" value="leds"> Debug LEDs</label><br>
        <label><input type="radio" name="debug" value="codes"> Debug Code Display</label><br>
        </div>
        <div class="intake-actions">
        <button onclick="prevIntakeStep()">← Back</button>
        <button onclick="nextIntakeStep()">Next →</button>
        </div>
        </div>`;
    } else if (intakeStep === 3) {
        intake.innerHTML = `
        <div class="intake-step">
        <h2>What graphics setup does this system have? Please check one or both</h2>
        <div class="intake-options">
        <label><input type="checkbox" value="dedicated"> Dedicated GPU (graphics card)</label><br>
        <label><input type="checkbox" value="integrated"> Integrated graphics (CPU/iGPU)</label><br>
        </div>
        <div class="intake-actions">
        <button onclick="prevIntakeStep()">← Back</button>
        <button onclick="nextIntakeStep()">Next →</button>
        </div>
        </div>`;
    } else if (intakeStep === 4) {
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
        <h2>Please check any diagnostic steps you've performed</h2>
        <div class="intake-options">${checklistHTML}</div>
        <div class="intake-actions">
        <button onclick="prevIntakeStep()">← Back</button>
        <button onclick="startDiagnosis()">StartThis tool is for diagnosing a PC that is failing to power on or complete POST.

        The checklist tracks what you’ve already tried, and the diagnostic tool updates your checklist as you go.

        Check what you have done, go through the steps, and the tool will guide you toward the most likely cause.  Diagnosis</button>
        </div>
        </div>`;

        syncIntakeToChecklist();
    }
}

function nextIntakeStep() {
    if (intakeStep === 1) {
        const checked = Array.from(
            document.querySelectorAll("#intake-form input[type=checkbox]:checked")
        );
        if (checked.length === 0) {
            alert("Please select at least one symptom before continuing.");
            return;
        }
        intakeData.symptoms = checked.map(cb => cb.value);
    } else if (intakeStep === 2) {
        const dbg = document.querySelector("#intake-form input[name=debug]:checked");
        if (!dbg) {
            alert("Please select a debug feature option before continuing.");
            return;
        }
        intakeData.debug = dbg.value;
    } else if (intakeStep === 3) {
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

    if (intakeData.symptoms.includes("no_power")) {
        loadTree("master_path.json", "no_power_root");
    } else if (intakeData.symptoms.includes("power_cycles")) {
        loadTree("master_path.json", "power_cycles");
    } else if (intakeData.symptoms.includes("fans_no_display")) {
        if (intakeData.debug === "beep") {
            loadTree("master_path.json", "beep_root");
        } else if (intakeData.debug === "leds") {
            loadTree("master_path.json", "led_root");
        } else if (intakeData.debug === "codes") {
            loadTree("master_path.json", "code_root");
        } else {
            loadTree("master_path.json", "partial_power");
        }
    } else if (intakeData.symptoms.includes("fans_max")) {
        loadTree("master_path.json", "cpu_eps_check");
    } else if (intakeData.symptoms.includes("boots_display")) {
        loadTree("master_path.json", "boot_success");
    } else {
        loadTree("master_path.json", "start_master");
    }

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
