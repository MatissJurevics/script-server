let currentMainScriptName = null;
let currentViewingScriptName = null;
let scriptToDelete = null;
let toastTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    await fetchCurrentMainScriptName(); // Fetch initially
    fetchScripts(); // Then fetch and render scripts
    
    // Add event listeners for input fields to enhance user experience
    const scriptNameInput = document.getElementById('scriptName');
    const scriptContentTextarea = document.getElementById('scriptContent');
    
    // Auto-focus the script name input when page loads
    scriptNameInput.focus();
    
    // Add keyboard shortcut (Ctrl+Enter) to submit the form
    scriptContentTextarea.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            uploadScript();
        }
    });
});

// Toast Notification System
function showToast(message, type = 'success', duration = 3000) {
    // Clear any existing timeout to prevent multiple toasts stacking up
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    const toastContainer = document.getElementById('toast-container');
    
    // Clear any existing toasts
    toastContainer.innerHTML = '';
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add message and close button
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <span class="toast-close">&times;</span>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Make the toast visible after a small delay (to trigger animation)
    setTimeout(() => {
        toast.classList.add('visible');
    }, 10);
    
    // Add click handler to close button
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        hideToast(toast);
    });
    
    // Auto-hide after duration
    toastTimeout = setTimeout(() => {
        hideToast(toast);
    }, duration);
    
    return toast;
}

function hideToast(toast) {
    // Trigger hide animation
    toast.classList.remove('visible');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300); // Match the CSS transition time
}

// Cookie management functions
function getCookie(name) {
    const cookieName = name + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i].trim();
        if (cookie.indexOf(cookieName) === 0) {
            return cookie.substring(cookieName.length, cookie.length);
        }
    }
    return "";
}

function getPassword() {
    // Get password from cookie
    const savedPassword = getCookie('scriptManagerPassword');
    if (savedPassword) {
        return savedPassword;
    }
    
    // If no password available, redirect to login page
    window.location.href = '/login.html?error=auth';
    return null;
}

async function fetchCurrentMainScriptName() {
    try {
        const response = await fetch('/api/get-main-script-name');
        if (response.ok) {
            const data = await response.json();
            currentMainScriptName = data.mainScriptName;
        } else {
            console.error('Failed to fetch current main script name');
            currentMainScriptName = null;
        }
    } catch (error) {
        console.error('Error fetching current main script name:', error);
        currentMainScriptName = null;
    }
}

async function fetchScripts() {
    const response = await fetch('/scripts');
    const scripts = await response.json();
    const scriptList = document.getElementById('scriptList');
    scriptList.innerHTML = ''; // Clear existing list
    scripts.forEach(scriptName => {
        const listItem = document.createElement('li');
        
        const nameSpanContainer = document.createElement('div');
        nameSpanContainer.classList.add('script-name');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = scriptName;
        nameSpanContainer.appendChild(nameSpan);

        if (scriptName === currentMainScriptName) {
            listItem.classList.add('main-script-indicator');
            const mainIndicator = document.createElement('span');
            mainIndicator.textContent = ' (Main)';
            mainIndicator.classList.add('main-indicator-text');
            nameSpanContainer.appendChild(mainIndicator);
        }

        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('actions');

        const viewButton = document.createElement('button');
        viewButton.textContent = 'View';
        viewButton.classList.add('view-button');
        viewButton.onclick = () => openViewModal(scriptName);

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('edit-button');
        editButton.onclick = () => openEditModal(scriptName);

        const setAsMainButton = document.createElement('button');
        setAsMainButton.textContent = 'Set as Main';
        setAsMainButton.classList.add('set-main-button');
        setAsMainButton.onclick = () => setAsMainScript(scriptName);
        // Disable button if it's already the main script
        if (scriptName === currentMainScriptName) {
            setAsMainButton.disabled = true;
            setAsMainButton.classList.add('disabled-button');
        }

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => deleteScript(scriptName);

        actionsContainer.appendChild(viewButton);
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(setAsMainButton);
        actionsContainer.appendChild(deleteButton);

        listItem.appendChild(nameSpanContainer);
        listItem.appendChild(actionsContainer);
        scriptList.appendChild(listItem);
    });
}

async function uploadScript() {
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password

    const scriptNameInput = document.getElementById('scriptName');
    const scriptContentInput = document.getElementById('scriptContent');
    const uploadButton = document.querySelector('.upload-btn');
    
    const scriptName = scriptNameInput.value.trim();
    const scriptContent = scriptContentInput.value;
    
    // Validate inputs with helpful messages
    if (!scriptName) {
        showToast('Please enter a script name', 'error');
        scriptNameInput.focus();
        return;
    }
    
    if (!scriptContent) {
        showToast('Script content cannot be empty', 'error');
        scriptContentInput.focus();
        return;
    }

    // Visual feedback during upload
    uploadButton.textContent = 'Uploading...';
    uploadButton.disabled = true;
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password, scriptName, scriptContent }),
        });

        const responseText = await response.text();
        
        if (response.ok) {
            showToast(`Script "${scriptName}" uploaded successfully.`, 'success');
            
            // Clear the form
            scriptNameInput.value = '';
            scriptContentInput.value = '';
            
            // Focus on the name field for the next upload
            scriptNameInput.focus();
            
            // Refresh the list of scripts
            fetchScripts();
        } else if (response.status === 401) {
            // If unauthorized, redirect to login page
            window.location.href = '/login.html?error=auth';
        } else {
            showToast(responseText, 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        // Reset button state
        uploadButton.textContent = 'Upload Script';
        uploadButton.disabled = false;
    }
}

function deleteScript(scriptName) {
    // Set the script to delete and open the confirmation modal
    scriptToDelete = scriptName;
    document.getElementById('deleteScriptName').textContent = scriptName;
    document.getElementById('deleteConfirmModal').style.display = 'block';
}

function closeDeleteConfirmModal() {
    document.getElementById('deleteConfirmModal').style.display = 'none';
    scriptToDelete = null;
}

async function confirmScriptDeletion() {
    if (!scriptToDelete) {
        closeDeleteConfirmModal();
        return;
    }
    
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password

    const response = await fetch(`/s/${scriptToDelete}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
    });

    const responseText = await response.text();
    
    closeDeleteConfirmModal();
    
    if (response.ok) {
        showToast(`Script "${scriptToDelete}" deleted successfully.`, 'success');
        fetchScripts(); // Refresh the list
    } else if (response.status === 401) {
        // If unauthorized, redirect to login page
        window.location.href = '/login.html?error=auth';
    } else {
        showToast(responseText, 'error');
    }
}

// Store the name of the script currently being edited
let currentEditingScriptName = null;

async function openEditModal(scriptName) {
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password

    currentEditingScriptName = scriptName;
    
    // Fetch the script content
    const response = await fetch(`/s/${scriptName}`);
    const scriptContent = await response.text();
    
    // Populate the modal
    document.getElementById('editModalScriptName').textContent = scriptName;
    document.getElementById('editModalScriptContent').value = scriptContent;
    
    // Display the modal
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditingScriptName = null;
}

async function saveEditedScript() {
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password
    
    const scriptContent = document.getElementById('editModalScriptContent').value;
    if (!scriptContent) {
        showToast('Script content cannot be empty', 'error');
        return;
    }
    
    const response = await fetch(`/s/${currentEditingScriptName}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, scriptContent }),
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
        showToast(`Script "${currentEditingScriptName}" updated successfully.`, 'success');
        closeEditModal();
    } else if (response.status === 401) {
        // If unauthorized, redirect to login page
        window.location.href = '/login.html?error=auth';
    } else {
        showToast(responseText, 'error');
    }
}

async function openViewModal(scriptName) {
    currentViewingScriptName = scriptName;
    
    // Fetch the script content
    const response = await fetch(`/s/${scriptName}`);
    const scriptContent = await response.text();
    
    // Populate the modal
    document.getElementById('viewModalScriptName').textContent = scriptName;
    document.getElementById('viewModalScriptContent').value = scriptContent;
    
    // Display the modal
    document.getElementById('viewModal').style.display = 'block';
}

function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
    currentViewingScriptName = null;
}

function downloadScript() {
    const scriptName = currentViewingScriptName;
    const scriptContent = document.getElementById('viewModalScriptContent').value;
    
    // Create a blob with the script content
    const blob = new Blob([scriptContent], { type: 'text/plain' });
    
    // Create a temporary download link
    const url = window.URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = scriptName;
    
    // Trigger the download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(downloadLink);
    
    // Show success toast
    showToast(`Downloading "${scriptName}"...`, 'success');
}

async function setAsMainScript(scriptName) {
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password
    
    const response = await fetch('/main', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, fileName: scriptName }),
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
        showToast(`Script "${scriptName}" set as main script.`, 'success');
        currentMainScriptName = scriptName;
        fetchScripts(); // Refresh the list to update the UI
    } else if (response.status === 401) {
        // If unauthorized, redirect to login page
        window.location.href = '/login.html?error=auth';
    } else {
        showToast(responseText, 'error');
    }
} 