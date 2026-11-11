const FileLabScanner = {
    results: [],

    async scanFile(file) {
    const result = this.analyzeFile(file);

    this.results.push(result);
    return result;
},
    clearResults() {
        this.results = [];
    }
};
FileLabScanner.analyzeFile = function(file) {
    const warnings = [];

    const suspiciousExtensions = [
        ".exe", ".bat", ".cmd", ".scr",
        ".ps1", ".vbs", ".js"
    ];

    const extension = file.name
        .slice(file.name.lastIndexOf("."))
        .toLowerCase();

    if (suspiciousExtensions.includes(extension)) {
        warnings.push("Executable or script file type");
    }

    if (file.size === 0) {
        warnings.push("Empty file");
    }

    return {
        name: file.name,
        size: file.size,
        status: warnings.length ? "Review" : "Unrecognized",
        warnings
    };
};
FileLabScanner.scanFolder = async function(folder) {
    this.clearResults();

    const files = await walkFiles(folder);

    for (const item of files) {
        try {
            const file = await item.handle.getFile();
            await this.scanFile(file);
        } catch (error) {
            this.results.push({
                name: item.name,
                status: "Scan Error",
                reason: error.message
            });
        }
    }

    return this.results;
};
document.getElementById("scan-folder").addEventListener("click", async () => {
    if (!selectedFolder) {
        alert("Please select a folder first!");
        return;
    }

    const progress = document.getElementById("scanner-progress");
    const output = document.getElementById("scanner-results");

    progress.textContent = "Scanning files...";
    output.textContent = "";

    try {
        const results = await FileLabScanner.scanFolder(selectedFolder);

        progress.textContent =
            "Scan complete! Checked " + results.length + " files.";

        for (const result of results) {
            const item = document.createElement("p");

            item.textContent =
                result.name + " — " + result.status +
                (result.warnings?.length
                    ? " (" + result.warnings.join(", ") + ")"
                    : result.reason
                        ? " (" + result.reason + ")"
                        : "");

            output.appendChild(item);
        }
    } catch (error) {
        progress.textContent = "Scan failed: " + error.message;
    }
});