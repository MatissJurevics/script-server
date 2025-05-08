let currentMainScriptName = null;

document.addEventListener('DOMContentLoaded', async () => {
    await fetchCurrentMainScriptName(); // Fetch initially
    fetchScripts(); // Then fetch and render scripts
    checkSavedPassword(); // Check if password is saved
});

// Cookie management functions
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/;SameSite=Strict";
}

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

function deleteCookie(name) {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Strict";
}

function savePassword() {
    const password = document.getElementById('savedPassword').value;
    if (!password) {
        alert('Please enter a password to save');
        return;
    }
    
    setCookie('scriptManagerPassword', password, 7); // Save for 7 days
    updatePasswordStatus(true);
    
    // Auto-fill any password fields on the page
    if (document.getElementById('password')) {
        document.getElementById('password').value = password;
    }
}

function clearPassword() {
    deleteCookie('scriptManagerPassword');
    updatePasswordStatus(false);
    
    // Clear any password fields on the page
    if (document.getElementById('password')) {
        document.getElementById('password').value = '';
    }
    if (document.getElementById('savedPassword')) {
        document.getElementById('savedPassword').value = '';
    }
}

function checkSavedPassword() {
    const savedPassword = getCookie('scriptManagerPassword');
    updatePasswordStatus(savedPassword !== '');
    
    // Auto-fill password field if we have a saved password
    if (savedPassword && document.getElementById('password')) {
        document.getElementById('password').value = savedPassword;
    }
}

function updatePasswordStatus(isPasswordSaved) {
    const statusElement = document.getElementById('passwordStatus');
    if (isPasswordSaved) {
        statusElement.textContent = '✓ Password Saved';
        statusElement.style.color = '#28a745'; // Green
        document.getElementById('savePasswordBtn').disabled = true;
        document.getElementById('clearPasswordBtn').disabled = false;
    } else {
        statusElement.textContent = '✘ No Password Saved';
        statusElement.style.color = '#dc3545'; // Red
        document.getElementById('savePasswordBtn').disabled = false;
        document.getElementById('clearPasswordBtn').disabled = true;
    }
}

function getPassword() {
    // First try to get from cookie
    const savedPassword = getCookie('scriptManagerPassword');
    if (savedPassword) {
        return savedPassword;
    }
    
    // If no cookie, check if there's a value in the password field
    const passwordField = document.getElementById('password');
    if (passwordField && passwordField.value) {
        return passwordField.value;
    }
    
    return null; // No password available
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

        const viewLink = document.createElement('a');
        viewLink.href = `/s/${scriptName}`;
        viewLink.textContent = 'View';
        viewLink.target = '_blank';

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

        actionsContainer.appendChild(viewLink);
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(setAsMainButton);
        actionsContainer.appendChild(deleteButton);

        listItem.appendChild(nameSpanContainer);
        listItem.appendChild(actionsContainer);
        scriptList.appendChild(listItem);
    });
}

async function uploadScript() {
    // Use saved password first, fallback to form field
    let password = getPassword();
    const scriptName = document.getElementById('scriptName').value;
    const scriptContent = document.getElementById('scriptContent').value;

    // If no saved password and no password in form field, prompt user
    if (!password) {
        password = prompt('Password required. Please enter your password:');
        if (password === null) return; // User cancelled
    }
    
    if (!scriptName || !scriptContent) {
        alert('Script name and content are required.');
        return;
    }

    const response = await fetch('/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, scriptName, scriptContent }),
    });

    const responseText = await response.text();
    alert(responseText);
    
    if (response.ok) {
        fetchScripts(); // Refresh the list of scripts
        document.getElementById('scriptName').value = '';
        document.getElementById('scriptContent').value = '';
    } else if (response.status === 401) {
        // If unauthorized, clear the stored password as it might be incorrect
        clearPassword();
        alert('Your saved password was incorrect. Please try again with a valid password.');
    }
}

async function deleteScript(scriptName) {
    let password = getPassword();
    
    // If no saved password, prompt for it
    if (!password) {
        password = prompt('Enter password to delete script:');
        if (password === null) return; // User cancelled
    }

    const response = await fetch(`/s/${scriptName}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
    });

    alert(await response.text());
    
    if (response.ok) {
        fetchScripts(); // Refresh the list
    } else if (response.status === 401) {
        // If unauthorized, clear the stored password as it might be incorrect
        clearPassword();
        alert('Your saved password was incorrect. Please try again with a valid password.');
    }
}

// Store the name of the script currently being edited
let currentEditingScriptName = null;

async function openEditModal(scriptName) {
    currentEditingScriptName = scriptName;
    document.getElementById('editModalScriptName').textContent = scriptName;
    
    // Fetch script content
    try {
        const response = await fetch(`/s/${scriptName}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const scriptContent = await response.text();
        document.getElementById('editModalScriptContent').value = scriptContent;
        
        // Pre-fill the modal password field with saved password if available
        const savedPassword = getPassword();
        document.getElementById('editModalPassword').value = savedPassword || '';
        
        document.getElementById('editModal').style.display = 'block';
    } catch (error) {
        console.error('Failed to fetch script content:', error);
        alert('Failed to load script content for editing.');
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditingScriptName = null; // Reset when closing
}

async function saveEditedScript() {
    if (!currentEditingScriptName) {
        alert('No script selected for editing.');
        return;
    }

    const scriptContent = document.getElementById('editModalScriptContent').value;
    
    // Try to get password from the modal first, then from cookie if modal is empty
    let password = document.getElementById('editModalPassword').value;
    if (!password) {
        password = getPassword();
        // If still no password, inform user
        if (!password) {
            alert('Password is required to save changes.');
            return;
        }
    }
    
    if (scriptContent.trim() === '') {
        alert('Script content cannot be empty.');
        return;
    }

    try {
        const response = await fetch(`/s/${currentEditingScriptName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password, scriptContent }),
        });

        const responseText = await response.text();
        alert(responseText);

        if (response.ok) {
            closeEditModal();
            fetchScripts(); // Refresh the script list to show any changes
        } else if (response.status === 401) {
            // If unauthorized but using saved password, clear it
            if (password === getCookie('scriptManagerPassword')) {
                clearPassword();
            }
            alert('Password is incorrect. Please try again with a valid password.');
        }

    } catch (error) {
        console.error('Error saving script:', error);
        alert('An error occurred while saving the script.');
    }
}

// Close modal if user clicks outside of it
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        closeEditModal();
    }
}

async function setAsMainScript(scriptName) {
    let password = getPassword();
    
    // If no saved password, prompt for it
    if (!password) {
        password = prompt('Enter password to set this script as main:');
        if (password === null) return; // User cancelled
    }

    try {
        const response = await fetch('/main', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password, fileName: scriptName }),
        });

        const responseText = await response.text();
        alert(responseText);

        if (response.ok) {
            await fetchCurrentMainScriptName(); // Update current main script name
            fetchScripts(); // Refresh the list to show the new main script and update button states
        } else if (response.status === 401) {
            // If unauthorized, clear the stored password as it might be incorrect
            clearPassword();
            alert('Your saved password was incorrect. Please try again with a valid password.');
        } else {
            console.warn('Failed to set script as main:', responseText);
        }
    } catch (error) {
        console.error('Error setting script as main:', error);
        alert('An error occurred while setting the script as main.');
    }
} 