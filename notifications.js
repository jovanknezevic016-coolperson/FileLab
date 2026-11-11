
// =====================================
// FileLab 1.1 - Error Center
// =====================================

const FileLabErrors = {

    errors: {
        101: {
            title: "File Not Found",
            message: "The requested file could not be found."
        },
        102: {
            title: "Access Denied",
            message: "FileLab does not have permission to access this file."
        },
        103: {
            title: "Invalid Filename",
            message: "The filename is not valid."
        },
        104: {
            title: "File In Use",
            message: "The file may currently be in use by another program."
        },
        105: {
            title: "Operation Failed",
            message: "FileLab could not complete the requested operation."
        },
        106: {
            title: "Unsupported Format",
            message: "This file format is not supported."
        },
        107: {
            title: "Folder Not Found",
            message: "The requested folder could not be found."
        },
        108: {
            title: "Duplicate Detected",
            message: "A duplicate file was detected."
        },
        109: {
            title: "Invalid Input",
            message: "The provided input is not valid."
        },
        303: {
            title: "Unknown error.",
            message: "Unknown error. The error might be Testing error. Or a bug. (Error 303)"
        }
    },

    show(code) {
        const error = this.errors[code];

        const title = error ? error.title : "Unknown Error";
        const message = error
            ? error.message
            : "An unexpected error occurred. FileLab could not identify the cause.";

        const existing = document.getElementById("filelab-error-overlay");
        if (existing) existing.remove();

        if (typeof FileLabSounds !== "undefined") {
            FileLabSounds.error();
        }

        const overlay = document.createElement("div");
        overlay.id = "filelab-error-overlay";
        overlay.className = "filelab-error-overlay";

        const popup = document.createElement("div");
        popup.className = "filelab-error-popup";
        popup.setAttribute("role", "alertdialog");
        popup.setAttribute("aria-modal", "true");

        const heading = document.createElement("h2");
        heading.textContent = "⚠ FileLab Error";

        const errorTitle = document.createElement("h3");
        errorTitle.textContent = title;

        const errorMessage = document.createElement("p");
        errorMessage.textContent = message;

        const errorCode = document.createElement("small");
        errorCode.textContent = "Error " + code;

        const dismiss = document.createElement("button");
        dismiss.textContent = "Dismiss";
        dismiss.className = "filelab-error-dismiss";
        dismiss.onclick = () => overlay.remove();

        popup.append(
            heading,
            errorTitle,
            errorMessage,
            errorCode,
            dismiss
        );

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        dismiss.focus();
    },

    test() {
        this.show(303);
    }
};


// =====================================
// FileLab 1.1 - Success Notifications
// =====================================

const FileLabNotifications = {

    success(title, message) {

        // Remove an existing success notification
        const existing = document.getElementById(
            "filelab-success-overlay"
        );

        if (existing) existing.remove();

        // Play the success sound
        if (typeof FileLabSounds !== "undefined") {
            FileLabSounds.success();
        }

        // Create notification overlay
        const overlay = document.createElement("div");
        overlay.id = "filelab-success-overlay";
        overlay.className = "filelab-success-overlay";

        const popup = document.createElement("div");
        popup.className = "filelab-success-popup";
        popup.setAttribute("role", "status");

        const heading = document.createElement("h2");
        heading.textContent = "✓ FileLab Success";

        const notificationTitle = document.createElement("h3");
        notificationTitle.textContent = title;

        const notificationMessage = document.createElement("p");
        notificationMessage.textContent = message;

        const dismiss = document.createElement("button");
        dismiss.textContent = "Dismiss";
        dismiss.className = "filelab-success-dismiss";

        dismiss.onclick = () => {
            overlay.remove();
        };

        popup.append(
            heading,
            notificationTitle,
            notificationMessage,
            dismiss
        );

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        dismiss.focus();

        // Automatically close after 5 seconds
        const timeout = setTimeout(() => {
            overlay.remove();
        }, 5000);

        dismiss.onclick = () => {
            clearTimeout(timeout);
            overlay.remove();
        };
    },

    test() {
        this.success(
            "Operation completed!",
            "Your FileLab operation was completed successfully."
        );
    }
};

