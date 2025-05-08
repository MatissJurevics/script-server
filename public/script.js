document.addEventListener('DOMContentLoaded', () => {
    fetchScripts();
});

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

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => deleteScript(scriptName);

        actionsContainer.appendChild(viewLink);
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(deleteButton);

        listItem.appendChild(nameSpanContainer);
        listItem.appendChild(actionsContainer);
        scriptList.appendChild(listItem);
    });
}

async function uploadScript() {
    const password = document.getElementById('password').value;
    const scriptName = document.getElementById('scriptName').value;
    const scriptContent = document.getElementById('scriptContent').value;

    if (!password || !scriptName || !scriptContent) {
        alert('All fields are required.');
        return;
    }

    const response = await fetch('/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, scriptName, scriptContent }),
    });

    alert(await response.text());
    if (response.ok) {
        fetchScripts(); // Refresh the list of scripts
        document.getElementById('scriptName').value = '';
        document.getElementById('scriptContent').value = '';
        // Keep password field populated for convenience if user wants to upload multiple scripts
    }
}

async function deleteScript(scriptName) {
    const password = prompt('Enter password to delete script:');
    if (password === null) return; // User cancelled prompt

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
        document.getElementById('editModalPassword').value = ''; // Clear password field
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
    const password = document.getElementById('editModalPassword').value;

    if (!password) {
        alert('Password is required to save changes.');
        return;
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
            // Handle unauthorized specifically, password might be wrong
            console.warn('Failed to save script: Unauthorized');
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