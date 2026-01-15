/* ===============================
   GLOBAL STATE
================================ */
let fileUploaded = false;
let allColumns = [];
let numericColumns = [];
let activeChart = null;

/* ===============================
   ELEMENTS
================================ */
const fileInput    = document.getElementById("fileInput");
const uploadBtn    = document.getElementById("uploadBtn");
const fileName     = document.getElementById("fileName");
const previewBox   = document.querySelector(".preview-box");
const resultBox    = document.getElementById("resultBox");

const operationSel = document.getElementById("operationSelect");
const columnSel    = document.getElementById("columnSelect");

const topNBox      = document.getElementById("topNBox");
const topNInput    = document.getElementById("topNInput");

const groupBox     = document.getElementById("groupBox");
const groupColumn  = document.getElementById("groupColumn");
const aggSelect    = document.getElementById("aggSelect");

const chartTypeSel = document.getElementById("chartType");
const chartCanvas  = document.getElementById("chartCanvas");

/* KPI Elements */
const kpiIds = {
    rows: "kpiRows",
    sum:  "kpiSum",
    avg:  "kpiAvg",
    max:  "kpiMax",
    min:  "kpiMin"
};

/* ===============================
   FILE SELECTION
================================ */
fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
        fileName.innerHTML = `Selected: <b>${fileInput.files[0].name}</b>`;
    }
});

/* ===============================
   FILE UPLOAD
================================ */
uploadBtn.addEventListener("click", async () => {

    if (!fileInput.files.length) {
        fileName.innerHTML = "<span style='color:red;'>Select a file first</span>";
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    previewBox.innerHTML = "Uploading & loading preview...";
    resultBox.innerHTML = "Waiting for analysis...";

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            previewBox.innerHTML = `<span style="color:red;">${data.error}</span>`;
            return;
        }

        fileUploaded   = true;
        allColumns     = data.columns || [];
        numericColumns = data.numeric_columns || [];

        previewBox.innerHTML = data.preview;
        fileName.innerHTML  = "Upload successful";

        operationSel.value = "";
        columnSel.innerHTML = "<option>Select operation first</option>";

        resetExtras();
        resetKPIs();
        clearChart();

    } catch (err) {
        previewBox.innerHTML = "<span style='color:red;'>Server error</span>";
        console.error(err);
    }
});

/* ===============================
   OPERATION CHANGE
================================ */
operationSel.addEventListener("change", () => {

    if (!fileUploaded) return;

    resetExtras();

    if (operationSel.value === "top") {
        topNBox.style.display = "block";
    }

    if (operationSel.value === "group") {
        groupBox.style.display = "block";
        populateGroupColumns();
    }

    populateValueColumns();
});

/* ===============================
   POPULATE DROPDOWNS
================================ */
function populateValueColumns() {
    columnSel.innerHTML = "";

    const cols =
        ["top", "sum", "average", "group"].includes(operationSel.value)
            ? numericColumns
            : allColumns;

    cols.forEach(col => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        columnSel.appendChild(opt);
    });
}

function populateGroupColumns() {
    groupColumn.innerHTML = "";

    allColumns.forEach(col => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        groupColumn.appendChild(opt);
    });
}

/* ===============================
   RUN ANALYSIS
================================ */
async function runAnalysis() {

    if (!fileUploaded) {
        resultBox.innerHTML = "<span style='color:red;'>Upload a file first</span>";
        return;
    }

    const payload = {
        operation: operationSel.value,
        column: columnSel.value,
        chart_type: chartTypeSel.value
    };

    if (!payload.operation || !payload.column) {
        resultBox.innerHTML = "<span style='color:red;'>Select all fields</span>";
        return;
    }

    if (payload.operation === "top") {
        payload.n = topNInput.value;
    }

    if (payload.operation === "group") {
        payload.group_col = groupColumn.value;
        payload.agg = aggSelect.value;
    }

    resultBox.innerHTML = "Processing...";

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            resultBox.innerHTML = `<span style='color:red;'>${data.error}</span>`;
            clearChart();
            return;
        }

        resultBox.innerHTML = data.result;

        if (data.kpis) updateKPIs(data.kpis);
        if (data.chart) renderChart(data.chart);

    } catch (err) {
        resultBox.innerHTML = "<span style='color:red;'>Analysis failed</span>";
        console.error(err);
    }
}

/* ===============================
   KPI HANDLING (ANIMATED)
================================ */
function animateKPI(id, value, duration = 800) {

    const el = document.getElementById(id);
    if (!el) return;

    value = Number(value);
    if (isNaN(value)) value = 0;

    let start = 0;
    const step = value / (duration / 16);

    function update() {
        start += step;
        if (start >= value) {
            el.textContent = value.toLocaleString();
        } else {
            el.textContent = Math.floor(start).toLocaleString();
            requestAnimationFrame(update);
        }
    }

    update();
}

function updateKPIs(kpis = {}) {
    Object.keys(kpiIds).forEach(key => {
        animateKPI(kpiIds[key], kpis[key] ?? 0);
    });
}

function resetKPIs() {
    updateKPIs({});
}

/* ===============================
   CHART RENDERING
================================ */
function renderChart(chartData) {

    clearChart();

    activeChart = new Chart(chartCanvas, {
        type: chartTypeSel.value || "bar",
        data: {
            labels: chartData.labels,
            datasets: [{
                label: chartData.title,
                data: chartData.values
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: chartData.title
                }
            }
        }
    });
}

function clearChart() {
    if (activeChart) {
        activeChart.destroy();
        activeChart = null;
    }
}

/* ===============================
   DOWNLOADS
================================ */
function downloadExcel() {
    window.location.href = "/download-excel";
}

function downloadChart() {
    const link = document.createElement("a");
    link.download = "chart.png";
    link.href = chartCanvas.toDataURL("image/png");
    link.click();
}

/* ===============================
   THEME TOGGLE
================================ */
function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem(
        "theme",
        document.body.classList.contains("dark") ? "dark" : "light"
    );
}

window.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark");
        document.getElementById("themeToggle").checked = true;
    }
});

/* ===============================
   HELPERS
================================ */
function resetExtras() {
    topNBox.style.display = "none";
    if (groupBox) groupBox.style.display = "none";
}
