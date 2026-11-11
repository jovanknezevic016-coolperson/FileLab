
"use strict";

// ==========================================
// WINDOWS LAB FILE HELPER 1.0
// JavaScript engine
// ==========================================

let selectedFolder = null;
let renamePlan = [];
let extensionPlan = [];
let duplicateGroups = [];
const $ = id => document.getElementById(id);

const toolNames = {
    dashboard: "Dashboard",
    duplicates: "Duplicate Finder",
    renamer: "Bulk Renamer",
    organizer: "Folder Organizer",
    analyzer: "Size Analyzer",
    extensions: "Extension Helper",
    report: "Folder Report"
};

// ==========================================
// GENERAL HELPERS
// ==========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";

    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let index = 0;

    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
    }

    return size.toFixed(2) + " " + units[index];
}

function showResult(id, message) {
    $(id).innerHTML = message;
}

function requireFolder() {
    if (!selectedFolder) {
        alert("Please select a folder first!");
        return false;
    }
    return true;
}

function confirmChanges(message) {
    return window.confirm(
        message + "\n\nMake sure you have a backup of important files."
    );
}

function getExtension(name) {
    const index = name.lastIndexOf(".");
    return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}

async function getRootFiles() {
    const files = [];

    for await (const [name, handle] of selectedFolder.entries()) {
        if (handle.kind === "file") {
            files.push({ name, handle });
        }
    }

    return files;
}

async function entryExists(folder, name) {
    try {
        await folder.getFileHandle(name);
        return true;
    } catch {}

    try {
        await folder.getDirectoryHandle(name);
        return true;
    } catch {}

    return false;
}

async function walkFiles(folder, path = "") {
    const files = [];

    for await (const [name, handle] of folder.entries()) {
        const relativePath = path ? path + "/" + name : name;

        if (handle.kind === "file") {
            files.push({
                name,
                path: relativePath,
                handle,
                parentFolder: folder
            });
       } else if (
    handle.kind === "directory" &&
    name !== "FileLab Trash"
) {
            const nested = await walkFiles(handle, relativePath);
            files.push(...nested);
        }
    }

    return files;
}

function downloadCSV(filename, rows) {
    const csv = rows.map(row =>
        row.map(value =>
            '"' + String(value).replace(/"/g, '""') + '"'
        ).join(",")
    ).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==========================================
// FILE MOVE / RENAME
// ==========================================
async function getUniqueTrashName(folder, originalName) {
    const dotIndex = originalName.lastIndexOf(".");
    const hasExtension = dotIndex > 0;

    const baseName = hasExtension
        ? originalName.slice(0, dotIndex)
        : originalName;

    const extension = hasExtension
        ? originalName.slice(dotIndex)
        : "";

    let candidate = originalName;
    let number = 1;

    while (await entryExists(folder, candidate)) {
        candidate = baseName + " (" + number + ")" + extension;
        number++;
    }

    return candidate;
}
async function moveFile(fileHandle, sourceFolder, destinationFolder, newName) {

    // Use the browser's native move operation when available.
    if (typeof fileHandle.move === "function") {
        try {
            await fileHandle.move(destinationFolder, newName);
            return "moved";
        } catch (error) {
            console.warn("Native move unavailable; trying safe copy.", error);
        }
    }

    // Fallback: copy the file, then remove its old entry.
    const originalFile = await fileHandle.getFile();
    const data = await originalFile.arrayBuffer();

    const newHandle = await destinationFolder.getFileHandle(
        newName,
        { create: true }
    );

    try {
        const writable = await newHandle.createWritable();
        await writable.write(data);
        await writable.close();
    } catch (error) {
        try {
            await destinationFolder.removeEntry(newName);
        } catch {}

        throw error;
    }

    try {
        await sourceFolder.removeEntry(fileHandle.name);
        return "copied";
    } catch (error) {
        return "copied-not-removed";
    }
}

// ==========================================
// NAVIGATION
// ==========================================

function openTool(tool) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });

    const page = $(tool);
    if (!page) return;

    page.classList.remove("hidden");
    $("page-title").textContent = toolNames[tool];

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.tool === tool
        );
    });
}

document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
        openTool(button.dataset.tool);
    });
});

document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
        openTool(card.dataset.open);
    });
});

// ==========================================
// SELECT FOLDER
// ==========================================

$("choose-folder").addEventListener("click", async () => {
    try {
        if (!window.showDirectoryPicker) {
            alert(
                "Your browser does not support folder access. " +
                "Please use a recent version of Microsoft Edge."
            );
            return;
        }

        selectedFolder = await window.showDirectoryPicker({
            mode: "readwrite"
        });

        $("folder-info").textContent =
            "📂 Selected folder: " + selectedFolder.name;

        FileLabNotifications.success(
    "Folder selected!",
    "Your folder is ready to use in FileLab."
);
    } catch (error) {
        if (error.name !== "AbortError") {
            alert("Could not open folder: " + error.message);
        }
    }
});

// ==========================================
// 1. DUPLICATE FINDER
// ==========================================

$("scan-duplicates").addEventListener("click", async () => {
    if (!requireFolder()) return;

    const output = $("duplicate-results");
    output.textContent = "Scanning files and calculating hashes...";

    try {
        const files = await walkFiles(selectedFolder);
        const groups = new Map();

        for (let i = 0; i < files.length; i++) {
            const item = files[i];
            const file = await item.handle.getFile();

            const key = file.size;

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({
                ...item,
                file
            });
        }

        const possibleGroups = [...groups.values()]
            .filter(group => group.length > 1);

        const duplicates = [];
        duplicateGroups = [];
        for (const group of possibleGroups) {
            const hashes = new Map();

            for (const item of group) {
                const data = await item.file.arrayBuffer();

                const digest = await crypto.subtle.digest(
                    "SHA-256",
                    data
                );

                const hash = Array.from(new Uint8Array(digest))
                    .map(byte => byte.toString(16).padStart(2, "0"))
                    .join("");

                if (!hashes.has(hash)) hashes.set(hash, []);
                hashes.get(hash).push(item);
            }

            for (const matching of hashes.values()) {
                if (matching.length > 1) {
                    duplicates.push(matching);
                }
            }
        }
        duplicateGroups = duplicates;                                     
        if (!duplicates.length) {
    output.textContent =
        "No duplicate files found. Scanned " +
        files.length + " files.";

    FileLabNotifications.success(
        "Scan completed!",
        "Scanned " + files.length +
        " files. No duplicate files were found."
    );

    return;
}
        let html = "<h3>Duplicate groups found: " +
            duplicates.length + "</h3>";

        duplicates.forEach((group, index) => {
            html += "<p><b>Group " + (index + 1) + "</b></p><ul>";

            group.forEach((item, itemIndex) => {
    html += "<li>" +
        "<label>" +
        "<input type='checkbox' class='duplicate-select' " +
        "data-group='" + index + "' " +
        "data-item='" + itemIndex + "'> " +
        escapeHTML(item.path) +
        " — " + formatSize(item.file.size) +
        "</label></li>";
});

            html += "</ul>";
        });
html += "<button id='delete-duplicates' type='button'>" +
    "Move selected to FileLab Trash</button>";
        html += "<p>Scanned " + files.length +
            " files. No files were deleted.</p>";

        output.innerHTML = html;
		$("delete-duplicates").addEventListener("click", async () => {
    const checkboxes = output.querySelectorAll(".duplicate-select");
    const selected = [...checkboxes].filter(box => box.checked);

    if (!selected.length) {
        alert("Please select at least one duplicate file.");
        return;
    }

    // Never allow every copy in a group to be selected.
    for (let i = 0; i < duplicateGroups.length; i++) {
        const group = duplicateGroups[i];

        const selectedCount = selected.filter(box =>
            Number(box.dataset.group) === i
        ).length;

        if (selectedCount >= group.length) {
            alert("You must keep at least one copy of every file group!");
            return;
        }
    }

    const confirmed = confirm(
        "Move " + selected.length +
        " selected files into FileLab Trash? You can recover them later."
    );

    if (!confirmed) return;

    try {
        const trashFolder = await selectedFolder.getDirectoryHandle(
            "FileLab Trash",
            { create: true }
        );

        let movedCount = 0;
        let copiedOnlyCount = 0;
        let failedCount = 0;

        for (const box of selected) {
            const groupIndex = Number(box.dataset.group);
            const itemIndex = Number(box.dataset.item);

            const item = duplicateGroups[groupIndex][itemIndex];

            try {
                const uniqueName = await getUniqueTrashName(
                    trashFolder,
                    item.name
                );

                const result = await moveFile(
                    item.handle,
                    item.parentFolder,
                    trashFolder,
                    uniqueName
                );

                if (result === "copied-not-removed") {
                    copiedOnlyCount++;
                } else {
                    movedCount++;
                }
            } catch (error) {
                failedCount++;
                console.error("Could not move file:", error);
            }
        }

        alert(
            "FileLab Trash results:\\n" +
            "Moved: " + movedCount +
            "\\nCopied but original remains: " + copiedOnlyCount +
            "\\nFailed: " + failedCount
        );

    } catch (error) {
        alert("Could not access FileLab Trash: " + error.message);
    }
});
FileLabNotifications.success(
    "Duplicates detected!",
    "Found " + duplicates.length +
    " duplicate groups among " + files.length +
    " scanned files. No files were deleted."
);
    } catch (error) {
        output.textContent = "Scan failed: " + error.message;
    }
});

// ==========================================
// 2. BULK RENAMER
// ==========================================

$("preview-rename").addEventListener("click", async () => {
    if (!requireFolder()) return;

    const prefix = $("rename-prefix").value;
    const suffix = $("rename-suffix").value;

    if (!prefix && !suffix) {
        alert("Enter a prefix or suffix first.");
        return;
    }

    try {
        const files = await getRootFiles();

        renamePlan = files.map(item => {
            const dot = item.name.lastIndexOf(".");
            const base = dot > 0
                ? item.name.slice(0, dot)
                : item.name;

            const extension = dot > 0
                ? item.name.slice(dot)
                : "";

            return {
                oldName: item.name,
                newName: prefix + base + suffix + extension,
                handle: item.handle
            };
        }).filter(item => item.oldName !== item.newName);

        let html = "<h3>Rename preview</h3>";

        if (!renamePlan.length) {
            html += "No changes needed.";
            $("apply-rename").classList.add("hidden");
        } else {
            html += "<ul>";

            renamePlan.forEach(item => {
                html += "<li>" +
                    escapeHTML(item.oldName) +
                    " → <b>" + escapeHTML(item.newName) +
                    "</b></li>";
            });

            html += "</ul>";

            $("apply-rename").classList.remove("hidden");
        }

        showResult("rename-results", html);

    } catch (error) {
        showResult("rename-results", "Error: " + error.message);
    }
});

$("apply-rename").addEventListener("click", async () => {
    if (!renamePlan.length) return;

    if (!confirmChanges(
        "Rename " + renamePlan.length + " files?"
    )) return;

    let success = 0;
    let skipped = 0;

    for (const item of renamePlan) {
        try {
            if (await entryExists(selectedFolder, item.newName)) {
                skipped++;
                continue;
            }

            const result = await moveFile(
                item.handle,
                selectedFolder,
                selectedFolder,
                item.newName
            );

            if (result === "copied-not-removed") {
                skipped++;
            } else {
                success++;
            }

        } catch (error) {
            skipped++;
            console.error(error);
        }
    }

    renamePlan = [];
    $("apply-rename").classList.add("hidden");

    showResult(
        "rename-results",
        "Finished! Renamed: " + success +
        " | Skipped or needing attention: " + skipped
    );
});

// ==========================================
// 3. FOLDER ORGANIZER
// ==========================================

function getCategory(extension) {
    const categories = {
        Images: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"],
        Documents: ["pdf", "doc", "docx", "txt", "rtf", "odt"],
        Videos: ["mp4", "mkv", "avi", "mov", "webm"],
        Audio: ["mp3", "wav", "flac", "aac", "ogg"],
        Archives: ["zip", "rar", "7z", "tar", "gz"],
        Code: ["js", "html", "css", "py", "java", "cpp", "json"],
        Installers: ["exe", "msi", "msix"]
    };

    for (const [category, extensions] of Object.entries(categories)) {
        if (extensions.includes(extension)) return category;
    }

    return "Other";
}

$("organize-files").addEventListener("click", async () => {
    if (!requireFolder()) return;

    try {
        const files = await getRootFiles();

        if (!files.length) {
            showResult("organize-results", "No files to organize.");
            return;
        }

        if (!confirmChanges(
            "Organize " + files.length +
            " files into category folders?"
        )) return;

        let moved = 0;
        let skipped = 0;

        for (const item of files) {
            const category = getCategory(getExtension(item.name));

            const destination = await selectedFolder.getDirectoryHandle(
                category,
                { create: true }
            );

            if (await entryExists(destination, item.name)) {
                skipped++;
                continue;
            }

            const result = await moveFile(
                item.handle,
                selectedFolder,
                destination,
                item.name
            );

            if (result === "copied-not-removed") {
                skipped++;
            } else {
                moved++;
            }
        }

        showResult(
            "organize-results",
            "Organization finished!<br>" +
            "Files organized: " + moved + "<br>" +
            "Skipped or needing attention: " + skipped
        );

    } catch (error) {
        showResult("organize-results", "Error: " + error.message);
    }
});

// ==========================================
// 4. SIZE ANALYZER
// ==========================================

async function calculateFolderSize(folder) {
    let totalSize = 0;
    let fileCount = 0;

    for await (const [, handle] of folder.entries()) {
        if (handle.kind === "file") {
            const file = await handle.getFile();
            totalSize += file.size;
            fileCount++;
        } else if (handle.kind === "directory") {
            const nested = await calculateFolderSize(handle);
            totalSize += nested.size;
            fileCount += nested.count;
        }
    }

    return {
        size: totalSize,
        count: fileCount
    };
}

$("analyze-folder").addEventListener("click", async () => {
    if (!requireFolder()) return;

    const output = $("analyze-results");
    output.textContent = "Analyzing folders...";

    try {
        let html = "<h3>Folder size report</h3><ul>";

        let totalSize = 0;
        let totalCount = 0;

        for await (const [name, handle] of selectedFolder.entries()) {
            if (handle.kind === "directory") {
                const result = await calculateFolderSize(handle);

                totalSize += result.size;
                totalCount += result.count;

                html += "<li><b>" + escapeHTML(name) +
                    "</b> — " + formatSize(result.size) +
                    " (" + result.count + " files)</li>";
            } else {
                const file = await handle.getFile();
                totalSize += file.size;
                totalCount++;
            }
        }

        html += "</ul><hr><p><b>Total size:</b> " +
            formatSize(totalSize) + "</p>";

        html += "<p><b>Total files:</b> " +
            totalCount + "</p>";

        output.innerHTML = html;

    } catch (error) {
        output.textContent = "Analysis failed: " + error.message;
    }
});

// ==========================================
// 5. EXTENSION HELPER
// ==========================================

$("preview-extension").addEventListener("click", async () => {
    if (!requireFolder()) return;

    let from = $("extension-from").value.trim().replace(/^\./, "");
    let to = $("extension-to").value.trim().replace(/^\./, "");

    if (!from || !to || /[\\/:*?"<>|.]/.test(from + to)) {
        alert("Enter valid extensions without dots, e.g. txt and md.");
        return;
    }

    from = from.toLowerCase();

    try {
        const files = await getRootFiles();

        extensionPlan = files.filter(item =>
            getExtension(item.name) === from
        ).map(item => ({
            oldName: item.name,
            newName: item.name.slice(
                0,
                item.name.lastIndexOf(".")
            ) + "." + to,
            handle: item.handle
        }));

        let html = "<h3>Extension preview</h3>";

        if (!extensionPlan.length) {
            html += "No matching files found.";
            $("apply-extension").classList.add("hidden");
        } else {
            html += "<ul>";

            extensionPlan.forEach(item => {
                html += "<li>" +
                    escapeHTML(item.oldName) +
                    " → <b>" + escapeHTML(item.newName) +
                    "</b></li>";
            });

            html += "</ul>";
            html += "<p>Changing an extension does not convert a file's format.</p>";

            $("apply-extension").classList.remove("hidden");
        }

        showResult("extension-results", html);

    } catch (error) {
        showResult("extension-results", "Error: " + error.message);
    }
});

$("apply-extension").addEventListener("click", async () => {
    if (!extensionPlan.length) return;

    if (!confirmChanges(
        "Change the extensions of " +
        extensionPlan.length + " files?"
    )) return;

    let success = 0;
    let skipped = 0;

    for (const item of extensionPlan) {
        try {
            if (await entryExists(selectedFolder, item.newName)) {
                skipped++;
                continue;
            }

            const result = await moveFile(
                item.handle,
                selectedFolder,
                selectedFolder,
                item.newName
            );

            if (result === "copied-not-removed") {
                skipped++;
            } else {
                success++;
            }

        } catch (error) {
            skipped++;
            console.error(error);
        }
    }

    extensionPlan = [];
    $("apply-extension").classList.add("hidden");

    showResult(
        "extension-results",
        "Finished! Changed: " + success +
        " | Skipped or needing attention: " + skipped
    );
});

// ==========================================
// 6. FOLDER REPORT
// ==========================================

$("generate-report").addEventListener("click", async () => {
    if (!requireFolder()) return;

    const output = $("report-results");
    output.textContent = "Generating report...";

    try {
        const files = await walkFiles(selectedFolder);

        const rows = [
            ["File Name", "Folder Path", "Extension", "Size (Bytes)"]
        ];

        for (const item of files) {
            const file = await item.handle.getFile();

            rows.push([
                item.name,
                item.path,
                getExtension(item.name),
                file.size
            ]);
        }

        downloadCSV("WindowsLab-Folder-Report.csv", rows);

        output.innerHTML =
            "<h3>Report generated!</h3>" +
            "<p>Files included: " + files.length + "</p>" +
            "<p>Your CSV report should be in your Downloads folder.</p>";

    } catch (error) {
        output.textContent = "Report failed: " + error.message;
    }
});

// ==========================================
// STARTUP
// ==========================================

console.log("Windows Lab File Helper 1.0 loaded.");

if (!window.showDirectoryPicker) {
    $("folder-info").textContent =
        "⚠️ Folder access may be unavailable. Try opening this app in Microsoft Edge.";
}
