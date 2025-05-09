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
        
        // Track clicks for differentiating between single and double clicks
        let clickCount = 0;
        let clickTimer = null;
        
        // Add click handler for both single and double clicks
        listItem.addEventListener('click', (event) => {
            // Ignore clicks on buttons or inside the actions container
            if (event.target.closest('.actions')) {
                return;
            }
            
            clickCount++;
            
            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    if (clickCount === 1) {
                        // Single click - view the script
                        openViewModal(scriptName);
                    }
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                // Double click - set as main (if not already main)
                if (scriptName !== currentMainScriptName) {
                    setAsMainScript(scriptName);
                }
                clickCount = 0;
            }
        });

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
    const originalText = uploadButton.textContent;
    uploadButton.textContent = 'Uploading...';
    uploadButton.disabled = true;
    uploadButton.style.opacity = '0.7';
    
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
        uploadButton.textContent = originalText;
        uploadButton.disabled = false;
        uploadButton.style.opacity = '';
    }
}

// Enhanced modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
    
    // Trigger animation after a small delay
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Set focus to the first input or textarea
    const focusElement = modal.querySelector('textarea, input');
    if (focusElement) {
        setTimeout(() => {
            focusElement.focus();
        }, 300);
    }
    
    // Add ESC key listener for modal
    document.addEventListener('keydown', handleModalKeydown);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    
    // Wait for animation to finish before hiding
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(event) {
    // Handle ESC key to close modal
    if (event.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal.show');
        if (openModals.length > 0) {
            // Find which modal is open
            if (document.getElementById('viewModal').classList.contains('show')) {
                closeViewModal();
            } else if (document.getElementById('editModal').classList.contains('show')) {
                closeEditModal();
            } else if (document.getElementById('deleteConfirmModal').classList.contains('show')) {
                closeDeleteConfirmModal();
            }
        }
    }
    
    // Handle Ctrl+S for saving in edit modal
    if (event.ctrlKey && event.key === 's' && document.getElementById('editModal').classList.contains('show')) {
        event.preventDefault();
        saveEditedScript();
    }
    
    // Handle Ctrl+Enter for saving in edit modal
    if (event.ctrlKey && event.key === 'Enter' && document.getElementById('editModal').classList.contains('show')) {
        event.preventDefault();
        saveEditedScript();
    }
    
    // Handle D for download in view modal
    if (event.key === 'd' && document.getElementById('viewModal').classList.contains('show')) {
        event.preventDefault();
        downloadScript();
    }
    
    // Handle Enter for confirming deletion
    if (event.key === 'Enter' && document.getElementById('deleteConfirmModal').classList.contains('show')) {
        event.preventDefault();
        confirmScriptDeletion();
    }
}

// Store the name of the script currently being edited
let currentEditingScriptName = null;

async function openEditModal(scriptName) {
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password

    currentEditingScriptName = scriptName;
    
    try {
        // Fetch the script content
        const response = await fetch(`/s/${scriptName}`);
        const scriptContent = await response.text();
        
        // Populate the modal
        document.getElementById('editModalScriptName').textContent = scriptName;
        document.getElementById('editModalScriptContent').value = scriptContent;
        
        // Display the modal
        openModal('editModal');
    } catch (error) {
        showToast(`Error loading script: ${error.message}`, 'error');
    }
}

function closeEditModal() {
    closeModal('editModal');
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
    
    try {
        // Fetch the script content
        const response = await fetch(`/s/${scriptName}`);
        const scriptContent = await response.text();
        
        // Populate the modal
        document.getElementById('viewModalScriptName').textContent = scriptName;
        document.getElementById('viewModalScriptContent').value = scriptContent;
        
        // Display the modal
        openModal('viewModal');
    } catch (error) {
        showToast(`Error loading script: ${error.message}`, 'error');
    }
}

function closeViewModal() {
    closeModal('viewModal');
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
    // If it's already the main script, just show a message
    if (scriptName === currentMainScriptName) {
        showToast(`"${scriptName}" is already the main script.`, 'success');
        return;
    }
    
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password
    
    // Show a loading toast
    const loadingToast = showToast(`Setting "${scriptName}" as main script...`, 'success');
    
    try {
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
    } catch (error) {
        showToast(`Error setting "${scriptName}" as main script.`, 'error');
    }
}

function deleteScript(scriptName) {
    // Set the script to delete and open the confirmation modal
    scriptToDelete = scriptName;
    document.getElementById('deleteScriptName').textContent = scriptName;
    openModal('deleteConfirmModal');
}

function closeDeleteConfirmModal() {
    closeModal('deleteConfirmModal');
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