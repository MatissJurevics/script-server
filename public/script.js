let currentMainScriptName = null;
let currentViewingScriptName = null;
let scriptToDelete = null;
let toastTimeout = null;
let scriptDataCache = null;
let lastScriptDataFetch = 0;
const CACHE_TIMEOUT = 30000; // 30 seconds cache
let currentSettings = null;
let currentAiResponse = '';
let aiContextMenuVisible = false;
let aiCompactMode = true;
let selectedTextForAi = '';

// Store the current editing script's tags
let currentEditingTags = [];

// Create a single context menu element to reuse
let currentContextMenu = null;
let activeScriptName = null;

// Filter state variables
let nameFilter = '';
let selectedTags = [];
let allAvailableTags = [];
let allScriptsData = [];

document.addEventListener('DOMContentLoaded', async () => {
    await fetchCurrentMainScriptName(); // Fetch initially
    fetchScripts(); // Then fetch and render scripts
    
    // Add event listeners for input fields to enhance user experience
    const scriptNameInput = document.getElementById('scriptName');
    const scriptContentTextarea = document.getElementById('scriptContent');
    const scriptTagsInput = document.getElementById('scriptTags');
    
    // Auto-focus the script name input when page loads
    scriptNameInput.focus();
    
    // Add keyboard shortcut (Ctrl+Enter) to submit the form from any input field
    scriptContentTextarea.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            uploadScript();
        }
    });
    
    // Add Ctrl+Enter support to the script name input
    scriptNameInput.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            uploadScript();
        }
    });
    
    // Add Ctrl+Enter support to the tags input
    if (scriptTagsInput) {
        scriptTagsInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                uploadScript();
            }
        });
    }
    
    // Add event listener to settings button
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            fetchSettings().then(() => {
                openSettingsModal();
            });
        });
    }
    
    // Add event listener for saving settings
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // Initialize the AI context menu
    setupAiContextMenu();
    
    // Fetch settings on page load
    fetchSettings();
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

// Function to close any open context menu
function closeContextMenu() {
    if (currentContextMenu) {
        currentContextMenu.classList.remove('active');
        setTimeout(() => {
            if (currentContextMenu && currentContextMenu.parentNode) {
                currentContextMenu.parentNode.removeChild(currentContextMenu);
                currentContextMenu = null;
                activeScriptName = null;
            }
        }, 150);
    }
}

// Add click event listener to document to close context menu when clicking outside
document.addEventListener('click', function(e) {
    // If the click is outside the context menu and not on a dropdown button
    if (currentContextMenu && !e.target.closest('.context-menu') && !e.target.closest('.script-actions-dropdown')) {
        closeContextMenu();
    }
});

// Function to show context menu for a script
function showContextMenu(scriptName, isMainScript, event, sourceType = 'button') {
    // Close any open menu first
    closeContextMenu();
    
    // Set current active script
    activeScriptName = scriptName;
    
    // Create menu container
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Get position for menu placement (either from button or mouse event)
    let top, left;
    
    if (sourceType === 'button' && event instanceof HTMLElement) {
        // Button source - use button position
        const button = event;
        const rect = button.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
        
        top = rect.bottom + scrollTop;
        left = rect.left + scrollLeft;
    } else if (sourceType === 'contextmenu' && event instanceof MouseEvent) {
        // Right-click source - use cursor position
        event.preventDefault(); // Prevent default context menu
        top = event.pageY;
        left = event.pageX;
    } else {
        // Fallback
        return;
    }
    
    // Create menu items
    const viewItem = createMenuItem('View', 'view-action', () => openViewModal(scriptName));
    const editItem = createMenuItem('Edit', 'edit-action', () => openEditModal(scriptName));
    
    // Handle Set as Main item conditionally
    const mainItem = createMenuItem('Set as Main', 'main-action', () => setAsMainScript(scriptName));
    if (isMainScript) {
        mainItem.classList.add('disabled');
        mainItem.onclick = null; // Remove click handler if disabled
    }
    
    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';
    
    const deleteItem = createMenuItem('Delete', 'delete-action', () => deleteScript(scriptName));
    
    // Add items to menu
    menu.appendChild(viewItem);
    menu.appendChild(editItem);
    menu.appendChild(mainItem);
    menu.appendChild(separator);
    menu.appendChild(deleteItem);
    
    // Check if menu would go off bottom of screen
    const menuHeight = 5 * 36; // Approximation based on item height
    if (top + menuHeight > window.innerHeight + (window.scrollY || document.documentElement.scrollTop)) {
        top = top - menuHeight;
    }
    
    // Check if menu would go off right side of screen
    const menuWidth = 150; // Approximate menu width
    if (left + menuWidth > window.innerWidth + (window.scrollX || document.documentElement.scrollLeft)) {
        left = left - menuWidth;
    }
    
    // Position menu
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    
    // Add to document
    document.body.appendChild(menu);
    currentContextMenu = menu;
    
    // Activate with a small delay for animation
    setTimeout(() => {
        menu.classList.add('active');
    }, 10);
}

// Helper to create menu items
function createMenuItem(text, className, onClick) {
    const item = document.createElement('div');
    item.className = `context-menu-item ${className}`;
    item.textContent = text;
    item.onclick = (e) => {
        e.stopPropagation();
        closeContextMenu();
        onClick();
    };
    return item;
}

// Function to create the filter UI
function createFilterUI() {
    const filterSection = document.createElement('div');
    filterSection.className = 'filter-section';
    
    // Create the name filter row
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    
    // Create the search input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'filter-input-container';
    
    
    
    // Create the search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'filter-input';
    searchInput.placeholder = 'Filter scripts by name...';
    searchInput.addEventListener('input', function() {
        nameFilter = this.value.trim().toLowerCase();
        renderFilteredScripts();
    });
    inputContainer.appendChild(searchInput);
    
    // Create tag dropdown container
    const tagDropdownContainer = document.createElement('div');
    tagDropdownContainer.className = 'tag-dropdown-container';
    
    // Create tag dropdown button
    const tagDropdownButton = document.createElement('div');
    tagDropdownButton.className = 'tag-dropdown-button';
    tagDropdownButton.innerHTML = `Filter by tags <span class="dropdown-icon">▾</span>`;
    tagDropdownButton.onclick = toggleTagDropdown;
    tagDropdownContainer.appendChild(tagDropdownButton);
    
    // Create tag dropdown menu
    const tagDropdownMenu = document.createElement('div');
    tagDropdownMenu.id = 'tagDropdownMenu';
    tagDropdownMenu.className = 'tag-dropdown-menu';
    tagDropdownContainer.appendChild(tagDropdownMenu);
    
    // Create clear button
    const clearButton = document.createElement('button');
    clearButton.className = 'filter-clear';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', function() {
        searchInput.value = '';
        nameFilter = '';
        selectedTags = [];
        renderFilteredScripts();
        renderTagDropdown(); // Re-render tags to clear active state
        updateSelectedTagsDisplay(); // Clear selected tags display
    });
    
    // Add elements to the filter row
    filterRow.appendChild(inputContainer);
    filterRow.appendChild(tagDropdownContainer);
    filterRow.appendChild(clearButton);
    
    // Create selected tags display container
    const selectedTagsContainer = document.createElement('div');
    selectedTagsContainer.id = 'selectedTagsContainer';
    selectedTagsContainer.className = 'filter-selected-tags';
    
    // Add elements to the filter section
    filterSection.appendChild(filterRow);
    filterSection.appendChild(selectedTagsContainer);
    
    // Set up click listener to close dropdown when clicking elsewhere
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('tagDropdownMenu');
        const dropdownButton = dropdown?.parentElement.querySelector('.tag-dropdown-button');
        
        if (dropdown && dropdown.classList.contains('active') && 
            !dropdown.contains(e.target) && e.target !== dropdownButton) {
            dropdown.classList.remove('active');
        }
    });
    
    return filterSection;
}

// Toggle tag dropdown visibility
function toggleTagDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('tagDropdownMenu');
    if (dropdown) {
        dropdown.classList.toggle('active');
        
        // If opening the dropdown, render its contents
        if (dropdown.classList.contains('active')) {
            renderTagDropdown();
        }
    }
}

// Function to render the tag dropdown items
function renderTagDropdown() {
    const tagDropdownMenu = document.getElementById('tagDropdownMenu');
    if (!tagDropdownMenu) return;
    
    tagDropdownMenu.innerHTML = '';
    
    // Sort tags alphabetically
    allAvailableTags.sort();
    
    if (allAvailableTags.length === 0) {
        const noTagsItem = document.createElement('div');
        noTagsItem.className = 'tag-dropdown-item';
        noTagsItem.textContent = 'No tags available';
        noTagsItem.style.fontStyle = 'italic';
        noTagsItem.style.color = '#6b6b8a';
        tagDropdownMenu.appendChild(noTagsItem);
        return;
    }
    
    allAvailableTags.forEach(tag => {
        const tagItem = document.createElement('div');
        tagItem.className = `tag-dropdown-item ${selectedTags.includes(tag) ? 'active' : ''}`;
        
        const checkbox = document.createElement('div');
        checkbox.className = 'checkbox';
        tagItem.appendChild(checkbox);
        
        const tagText = document.createElement('span');
        tagText.textContent = tag;
        tagItem.appendChild(tagText);
        
        tagItem.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleTagFilter(tag);
            this.classList.toggle('active');
        });
        
        tagDropdownMenu.appendChild(tagItem);
    });
}

// Update the display of selected tags
function updateSelectedTagsDisplay() {
    const container = document.getElementById('selectedTagsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (selectedTags.length === 0) {
        return;
    }
    
    selectedTags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'selected-tag';
        tagElement.innerHTML = `
            ${tag}
            <span class="selected-tag-remove" data-tag="${tag}">×</span>
        `;
        
        const removeButton = tagElement.querySelector('.selected-tag-remove');
        removeButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const tag = this.getAttribute('data-tag');
            toggleTagFilter(tag);
        });
        
        container.appendChild(tagElement);
    });
}

// Function to toggle a tag in the filter
function toggleTagFilter(tag) {
    const index = selectedTags.indexOf(tag);
    if (index === -1) {
        selectedTags.push(tag);
    } else {
        selectedTags.splice(index, 1);
    }
    
    // Update UI
    renderTagDropdown();
    updateSelectedTagsDisplay();
    renderFilteredScripts();
}

// Function to extract all unique tags from scripts
function extractAllTags(scriptData) {
    const tagSet = new Set();
    scriptData.forEach(script => {
        if (script.tags && Array.isArray(script.tags)) {
            script.tags.forEach(tag => tagSet.add(tag));
        }
    });
    return Array.from(tagSet);
}

// Function to apply filters and render scripts
function renderFilteredScripts() {
    const scriptList = document.getElementById('scriptList');
    scriptList.innerHTML = '';
    
    // Apply filters to the script data
    let filteredScripts = allScriptsData.filter(script => {
        const nameMatch = !nameFilter || script.scriptName.toLowerCase().includes(nameFilter);
        const tagMatch = selectedTags.length === 0 || 
            (script.tags && selectedTags.every(tag => script.tags.includes(tag)));
        return nameMatch && tagMatch;
    });
    
    // Update filter count - moved to bottom of container
    const filterCount = document.getElementById('filterCount');
    if (filterCount) {
        filterCount.textContent = `Showing ${filteredScripts.length} of ${allScriptsData.length} scripts`;
    }
    
    // Show no results message if needed
    if (filteredScripts.length === 0) {
        const noResults = document.createElement('li');
        noResults.className = 'no-results';
        noResults.textContent = 'No scripts match your filters';
        scriptList.appendChild(noResults);
        return;
    }
    
    // Render filtered scripts
    filteredScripts.forEach(script => {
        renderScriptListItem(script);
    });
}

// Helper function to render a single script list item
function renderScriptListItem(script) {
    const scriptName = script.scriptName;
    const tags = script.tags || [];
    const scriptList = document.getElementById('scriptList');
    
    const listItem = document.createElement('li');
    
    const nameSpanContainer = document.createElement('div');
    nameSpanContainer.classList.add('script-name');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = scriptName;
    nameSpanContainer.appendChild(nameSpan);

    // Add tags to the name container if there are any
    if (tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.classList.add('tag-container', 'script-list-tags');
        
        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.classList.add('tag');
            tagElement.textContent = tag;
            tagsContainer.appendChild(tagElement);
        });
        
        nameSpanContainer.appendChild(tagsContainer);
    }

    if (scriptName === currentMainScriptName) {
        listItem.classList.add('main-script-indicator');
        const mainIndicator = document.createElement('span');
        mainIndicator.textContent = ' (Main)';
        mainIndicator.classList.add('main-indicator-text');
        nameSpan.appendChild(mainIndicator);
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
    
    // Add right-click event listener for context menu
    listItem.addEventListener('contextmenu', (event) => {
        showContextMenu(scriptName, scriptName === currentMainScriptName, event, 'contextmenu');
    });

    // Create the actions container with dropdown
    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('actions');

    // Create dropdown button
    const dropdownButton = document.createElement('button');
    dropdownButton.classList.add('script-actions-dropdown');
    dropdownButton.innerHTML = `Actions <span class="dropdown-icon">▾</span>`;
    dropdownButton.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering the row click
        showContextMenu(scriptName, scriptName === currentMainScriptName, dropdownButton, 'button');
    };

    // Add dropdown to actions container
    actionsContainer.appendChild(dropdownButton);

    // Add containers to list item
    listItem.appendChild(nameSpanContainer);
    listItem.appendChild(actionsContainer);
    scriptList.appendChild(listItem);
}

async function fetchScripts() {
    try {
        // First get all script data from the scriptData endpoint
        allScriptsData = await getAllScriptData(true);
        
        // Then get the simple list of script names for ordering (to maintain order from server)
        const response = await fetch('/scripts');
        const scriptNames = await response.json();
        
        // Make sure allScriptsData is in the same order as the server's script list
        allScriptsData = scriptNames.map(name => {
            return allScriptsData.find(s => s.scriptName === name) || { scriptName: name, tags: [] };
        });
        
        // Extract all available tags
        allAvailableTags = extractAllTags(allScriptsData);
        
        // Get the list container
        const listContainer = document.querySelector('.list-container');
        const scriptList = document.getElementById('scriptList');
        
        // Add filter UI if it doesn't exist
        if (!document.querySelector('.filter-section')) {
            listContainer.insertBefore(createFilterUI(), scriptList);
            renderTagDropdown();
            updateSelectedTagsDisplay();
            
            // Create or update filter count element at the bottom of the container
            let filterCount = document.getElementById('filterCount');
            if (!filterCount) {
                filterCount = document.createElement('div');
                filterCount.id = 'filterCount';
                filterCount.className = 'filter-count';
                listContainer.appendChild(filterCount);
            }
        } else {
            // Just update the tag filters
            renderTagDropdown();
            updateSelectedTagsDisplay();
        }
        
        // Render filtered scripts
        renderFilteredScripts();
    } catch (error) {
        console.error('Error fetching scripts:', error);
        showToast('Failed to fetch scripts. Please try again.', 'error');
    }
}

async function uploadScript() {
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password

    const scriptNameInput = document.getElementById('scriptName');
    const scriptContentInput = document.getElementById('scriptContent');
    const scriptTagsInput = document.getElementById('scriptTags');
    const uploadButton = document.querySelector('.upload-btn');
    
    const scriptName = scriptNameInput.value.trim();
    const scriptContent = scriptContentInput.value;
    const tagString = scriptTagsInput.value.trim();
    
    // Parse tags from comma-separated string
    const tags = tagString ? tagString.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];
    
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
        // First upload the script
        const uploadResponse = await fetch('/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, scriptName, scriptContent }),
    });

        if (!uploadResponse.ok) {
            if (uploadResponse.status === 401) {
                window.location.href = '/login.html?error=auth';
                return;
            }
            throw new Error(await uploadResponse.text());
        }
        
        // If tags were provided, set them using the tags endpoint
        if (tags.length > 0) {
            const tagsResponse = await fetch(`/tags/${scriptName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password, tags }),
            });
            
            if (!tagsResponse.ok) {
                console.warn('Tags were not saved successfully:', await tagsResponse.text());
                // Continue anyway since the script was uploaded
            }
        }
        
        // Force refresh the script data cache and update tag filters
        await getAllScriptData(true);
        
        showToast(`Script "${scriptName}" uploaded successfully.`, 'success');
        
        // Clear the form
        scriptNameInput.value = '';
        scriptContentInput.value = '';
        scriptTagsInput.value = '';
        
        // Focus on the name field for the next upload
        scriptNameInput.focus();
        
        // Refresh the list of scripts including filters
        fetchScripts();
    } catch (error) {
        showToast(error.message || 'Network error. Please try again.', 'error');
    } finally {
        // Reset button state
        uploadButton.textContent = originalText;
        uploadButton.disabled = false;
        uploadButton.style.opacity = '';
    }
}

// Enhanced modal functions
function openModal(modalId) {
    // Close any open context menu
    closeContextMenu();
    
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

// Add a helper function to get all script data with caching
async function getAllScriptData(forceRefresh = false) {
    const now = Date.now();
    
    // Use cached data if available and not expired
    if (scriptDataCache && !forceRefresh && (now - lastScriptDataFetch < CACHE_TIMEOUT)) {
        return scriptDataCache;
    }
    
    try {
        // Fetch all script data from the scriptData endpoint
        const response = await fetch('/scriptData');
        if (!response.ok) {
            throw new Error(`Failed to fetch script data: ${response.status}`);
        }
        
        const scriptDataArray = await response.json();
        
        // Update cache
        scriptDataCache = scriptDataArray;
        lastScriptDataFetch = now;
        
        return scriptDataArray;
    } catch (error) {
        console.error('Error fetching script data:', error);
        throw error;
    }
}

// Add a helper function to get script data by name
async function getScriptDataByName(scriptName, forceRefresh = false) {
    try {
        // Get all script data (potentially from cache)
        const scriptDataArray = await getAllScriptData(forceRefresh);
        
        // Find the script with the matching name
        const scriptData = scriptDataArray.find(script => script.scriptName === scriptName);
        
        if (!scriptData) {
            throw new Error(`Script "${scriptName}" not found`);
        }
        
        return scriptData;
    } catch (error) {
        console.error('Error fetching script data:', error);
        throw error;
    }
}

// Function to render tags in the edit modal
function renderEditTags() {
    const tagContainer = document.getElementById('editModalTagContainer');
    tagContainer.innerHTML = '';
    
    currentEditingTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.classList.add('tag');
        tagElement.innerHTML = `
            ${tag}
            <span class="tag-remove" data-tag="${tag}" onclick="removeTag('${tag}')">×</span>
        `;
        tagContainer.appendChild(tagElement);
    });
}

// Function to add a new tag
async function addTag() {
    const tagInput = document.getElementById('tagInput');
    const tag = tagInput.value.trim();
    
    if (tag === '') {
        return;
    }
    
    // Don't add duplicate tags
    if (currentEditingTags.includes(tag)) {
        showToast(`Tag "${tag}" already exists`, 'error');
        return;
    }
    
    // Add tag to local array
    currentEditingTags.push(tag);
    
    try {
        // Get password for authentication
        const password = getPassword();
        if (!password) return;
        
        // Update tags on the server using the dedicated endpoint
        const response = await fetch(`/tags/${currentEditingScriptName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                tags: currentEditingTags,
                password 
            }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to add tag: ${response.statusText}`);
        }
        
        // Re-render tags and refresh cache
        renderEditTags();
        await getAllScriptData(true);
        
        // Update filter tags if needed (if tag is new)
        if (!allAvailableTags.includes(tag)) {
            allAvailableTags.push(tag);
            allAvailableTags.sort();
            renderTagDropdown();
        }
        
        // Clear the input
        tagInput.value = '';
        tagInput.focus();
        
    } catch (error) {
        // If there was an error, remove the tag from the local array
        currentEditingTags = currentEditingTags.filter(t => t !== tag);
        renderEditTags();
        showToast(`Error adding tag: ${error.message}`, 'error');
    }
}

// Function to remove a tag
async function removeTag(tag) {
    // Store the current tags in case we need to revert
    const previousTags = [...currentEditingTags];
    
    // Remove the tag from the local array first for immediate feedback
    currentEditingTags = currentEditingTags.filter(t => t !== tag);
    renderEditTags();
    
    try {
        // Get password for authentication
        const password = getPassword();
        if (!password) return;
        
        // Use the DELETE endpoint to remove the tag
        const response = await fetch(`/tags/${currentEditingScriptName}/${tag}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
    });

        if (!response.ok) {
            throw new Error(`Failed to remove tag: ${response.statusText}`);
        }
        
        // If successful, refresh the script data cache
        await getAllScriptData(true);
        
        // Check if we need to update the available tags (if this tag is no longer used by any script)
        const scriptData = await getAllScriptData(false); // Use cached data
        const tagsStillInUse = extractAllTags(scriptData);
        
        if (!tagsStillInUse.includes(tag)) {
            // Remove tag from available tags and filter selection if it's there
            allAvailableTags = allAvailableTags.filter(t => t !== tag);
            selectedTags = selectedTags.filter(t => t !== tag);
            renderTagDropdown();
            updateSelectedTagsDisplay();
        }
        
    } catch (error) {
        // If there was an error, restore the previous tag array
        currentEditingTags = previousTags;
        renderEditTags();
        showToast(`Error removing tag: ${error.message}`, 'error');
    }
}

// Add event listener for tag input
document.addEventListener('DOMContentLoaded', () => {
    const tagInput = document.getElementById('tagInput');
    if (tagInput) {
        tagInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });
    }
});

async function openEditModal(scriptName) {
    const password = getPassword();
    if (!password) return; // getPassword will redirect if no password

    currentEditingScriptName = scriptName;
    
    try {
        // Fetch the script content using the new endpoint
        const scriptData = await getScriptDataByName(scriptName);
        
        // Set the current editing tags
        currentEditingTags = scriptData.tags || [];
        
        // Populate the modal
        document.getElementById('editModalScriptName').textContent = scriptName;
        document.getElementById('editModalScriptContent').value = scriptData.content;
        renderEditTags();
        
        // Display the modal
        openModal('editModal');
    } catch (error) {
        showToast(`Error loading script: ${error.message}`, 'error');
    }
}

function closeEditModal() {
    closeModal('editModal');
    currentEditingScriptName = null;
    currentEditingTags = [];
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
        body: JSON.stringify({ 
            password, 
            scriptContent
            // Tags are now managed through dedicated tag endpoints
        }),
        });

        const responseText = await response.text();

        if (response.ok) {
            // Force refresh script data cache after updating
            await getAllScriptData(true);
            
            showToast(`Script "${currentEditingScriptName}" updated successfully.`, 'success');
            closeEditModal();
            fetchScripts(); // Refresh list to show updated tags and maintain filter state
        } else if (response.status === 401) {
            // If unauthorized, redirect to login page
            window.location.href = '/login.html?error=auth';
        } else {
            showToast(responseText, 'error');
        }
}

// Function to render tags in the view modal (read-only)
function renderViewTags(tags) {
    const tagContainer = document.getElementById('viewModalTagContainer');
    tagContainer.innerHTML = '';
    
    if (!tags || tags.length === 0) {
        const noTagsMsg = document.createElement('span');
        noTagsMsg.textContent = 'No tags';
        noTagsMsg.style.color = '#6b6b8a';
        noTagsMsg.style.fontStyle = 'italic';
        noTagsMsg.style.fontSize = '0.9em';
        tagContainer.appendChild(noTagsMsg);
        return;
    }
    
    tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.classList.add('tag');
        tagElement.textContent = tag;
        tagContainer.appendChild(tagElement);
    });
}

async function openViewModal(scriptName) {
    currentViewingScriptName = scriptName;
    
    try {
        // Fetch the script content using the new endpoint
        const scriptData = await getScriptDataByName(scriptName);
        
        // Populate the modal
        document.getElementById('viewModalScriptName').textContent = scriptName;
        document.getElementById('viewModalScriptContent').value = scriptData.content;
        renderViewTags(scriptData.tags);
        
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
    // Close any open context menu
    closeContextMenu();
    
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
        // Force refresh script data cache after deletion
        await getAllScriptData(true);
        
        // Check if the deleted script had a tag that is currently being filtered
        // If so, we may need to update the available tags list
        fetchScripts(); // This will update tags and maintain filter state appropriately
        
        showToast(`Script "${scriptToDelete}" deleted successfully.`, 'success');
    } else if (response.status === 401) {
        // If unauthorized, redirect to login page
        window.location.href = '/login.html?error=auth';
    } else {
        showToast(responseText, 'error');
    }
}

// Settings Functions
async function fetchSettings() {
    try {
        const password = getPassword();
        if (!password) return;

        const response = await fetch('/settings', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const settings = await response.json();
            currentSettings = settings;
            updateSettingsUI(settings);
            return settings;
        } else {
            showToast('Failed to fetch settings', 'error');
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
        showToast('Error fetching settings', 'error');
    }
}

function updateSettingsUI(settings) {
    // Update the settings form with values from the server
    if (settings.scriptsPerPage) {
        const scriptListLimitSelect = document.getElementById('scriptListLimit');
        scriptListLimitSelect.value = settings.scriptsPerPage;
        scriptListLimitSelect.disabled = false;
    }
    
    // Update OpenAI API Key field if it exists
    const apiKeyInput = document.getElementById('openAIAPIKey');
    if (apiKeyInput && settings.OpenAIAPIKey !== undefined) {
        apiKeyInput.value = settings.OpenAIAPIKey;
    }
    
    // Update AI context menu toggle if it exists
    const aiContextMenuToggle = document.getElementById('aiContextMenuToggle');
    if (aiContextMenuToggle && settings.aiContextMenuEnabled !== undefined) {
        aiContextMenuToggle.checked = settings.aiContextMenuEnabled;
    }
    
    // Enable the save button
    const saveBtn = document.querySelector('#settingsModal .save-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
    }
}

async function saveSettings() {
    try {
        const password = getPassword();
        if (!password) return;
        
        // Get values from the settings form
        const scriptListLimit = document.getElementById('scriptListLimit').value;
        const apiKeyInput = document.getElementById('openAIAPIKey');
        const openAIAPIKey = apiKeyInput ? apiKeyInput.value : '';
        
        // Get AI context menu toggle value
        const aiContextMenuToggle = document.getElementById('aiContextMenuToggle');
        const aiContextMenuEnabled = aiContextMenuToggle ? aiContextMenuToggle.checked : true;
        
        // Create settings object
        const updatedSettings = {
            scriptsPerPage: parseInt(scriptListLimit),
            OpenAIAPIKey: openAIAPIKey,
            aiContextMenuEnabled: aiContextMenuEnabled
        };
        
        const response = await fetch('/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedSettings)
        });
        
        if (response.ok) {
            showToast('Settings saved successfully', 'success');
            currentSettings = updatedSettings;
            closeSettingsModal();
        } else {
            showToast('Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'block';
    
    // Trigger animation after a small delay
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Add ESC key listener for modal
    document.addEventListener('keydown', handleSettingsModalKeydown);
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
    
    // Wait for animation to finish before hiding
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleSettingsModalKeydown);
}

function handleSettingsModalKeydown(event) {
    // Close on ESC key
    if (event.key === 'Escape') {
        closeSettingsModal();
    }
    
    // Save on Ctrl+S
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveSettings();
    }
}

// AI Context Menu Functions
function setupAiContextMenu() {
    console.log("Setting up AI context menu");
    
    const scriptContentTextarea = document.getElementById('scriptContent');
    const editModalScriptContent = document.getElementById('editModalScriptContent');
    const aiContextMenu = document.getElementById('aiContextMenu');
    const aiCompactButton = document.getElementById('aiCompactButton');
    const aiExpandedMenu = document.getElementById('aiExpandedMenu');
    const aiMinimizeBtn = document.getElementById('aiMinimizeBtn');
    const aiPromptInput = document.getElementById('aiPromptInput');
    const aiSubmitBtn = document.getElementById('aiSubmitBtn');
    const aiInsertBtn = document.getElementById('aiInsertBtn');
    const aiCopyBtn = document.getElementById('aiCopyBtn');
    const aiCloseBtn = document.getElementById('aiCloseBtn');
    
    if (!scriptContentTextarea) {
        console.error("Script content textarea not found");
        return;
    }
    
    if (!aiContextMenu) {
        console.error("AI context menu not found");
        return;
    }
    
    // Show context menu on right-click
    scriptContentTextarea.addEventListener('contextmenu', function(e) {
        console.log("Right-click detected on script textarea");
        // Store selected text if any
        selectedTextForAi = this.value.substring(this.selectionStart, this.selectionEnd);
        showAiContextMenu(e, this);
    });
    
    // Also add context menu to the edit modal textarea
    if (editModalScriptContent) {
        editModalScriptContent.addEventListener('contextmenu', function(e) {
            console.log("Right-click detected on edit modal textarea");
            // Store selected text if any
            selectedTextForAi = this.value.substring(this.selectionStart, this.selectionEnd);
            showAiContextMenu(e, this);
        });
    } else {
        console.warn("Edit modal textarea not found yet - will attach listener when modal opens");
    }
    
    // Handle compact button click to expand
    if (aiCompactButton) {
        aiCompactButton.addEventListener('click', function(e) {
            console.log("AI compact button clicked");
            expandAiMenu();
        });
    } else {
        console.error("AI compact button not found");
    }
    
    // Handle minimize button click
    if (aiMinimizeBtn) {
        aiMinimizeBtn.addEventListener('click', function(e) {
            console.log("AI minimize button clicked");
            e.stopPropagation();
            minimizeAiMenu();
        });
    }
    
    // Handle click on submit button
    if (aiSubmitBtn) {
        aiSubmitBtn.addEventListener('click', function() {
            submitAiPrompt();
        });
    }
    
    // Handle Enter key in prompt input
    if (aiPromptInput) {
        aiPromptInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                submitAiPrompt();
            }
        });
    }
    
    // Handle insert button
    if (aiInsertBtn) {
        aiInsertBtn.addEventListener('click', function() {
            insertAiResponse();
        });
    }
    
    // Handle copy button
    if (aiCopyBtn) {
        aiCopyBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(currentAiResponse)
                .then(() => {
                    showToast('AI response copied to clipboard', 'success');
                })
                .catch(err => {
                    console.error('Error copying to clipboard:', err);
                    showToast('Failed to copy response', 'error');
                });
        });
    }
    
    // Handle close button
    if (aiCloseBtn) {
        aiCloseBtn.addEventListener('click', function() {
            closeAiContextMenu();
        });
    }
    
    // Close the menu when clicking outside of it
    document.addEventListener('click', function(e) {
        if (aiContextMenuVisible && !aiContextMenu.contains(e.target)) {
            closeAiContextMenu();
        }
    });
    
    console.log("AI context menu setup complete");
}

function showAiContextMenu(e, textarea) {
    console.log("Showing AI context menu", e.pageX, e.pageY);
    
    // Check if AI context menu is enabled in settings
    if (currentSettings && currentSettings.aiContextMenuEnabled === false) {
        console.log("AI context menu is disabled in settings");
        return;
    }
    
    e.preventDefault(); // Prevent the default context menu
    
    const aiContextMenu = document.getElementById('aiContextMenu');
    if (!aiContextMenu) {
        console.error("AI context menu element not found");
        return;
    }
    
    // Position the menu near where user clicked
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    
    let top = e.pageY;
    let left = e.pageX;
    
    // Store the target textarea for later use when inserting text
    aiContextMenu.dataset.targetTextarea = textarea.id;
    
    // Reset to compact mode when showing
    resetToCompactMode();
    
    // Check if menu would go off screen and adjust positioning
    const menuWidth = 30; // Width of compact button (updated)
    const menuHeight = 24; // Height of compact button (updated)
    
    if (left + menuWidth > window.innerWidth + scrollLeft) {
        left = window.innerWidth + scrollLeft - menuWidth - 10;
    }
    
    if (top + menuHeight > window.innerHeight + scrollTop) {
        top = window.innerHeight + scrollTop - menuHeight - 10;
    }
    
    // Position the menu
    aiContextMenu.style.top = `${top}px`;
    aiContextMenu.style.left = `${left}px`;
    
    // Show the menu
    aiContextMenu.classList.add('active');
    aiContextMenuVisible = true;
    
    console.log("AI context menu displayed at", top, left);
}

function expandAiMenu() {
    const aiCompactButton = document.getElementById('aiCompactButton');
    const aiExpandedMenu = document.getElementById('aiExpandedMenu');
    const aiContextMenu = document.getElementById('aiContextMenu');
    
    // Hide the compact button
    aiCompactButton.style.display = 'none';
    
    // Show expanded menu
    aiExpandedMenu.style.display = 'block';
    
    // Reposition if needed
    const menuWidth = 450; // Updated to match the new width
    const menuHeight = 450; // Approximate expanded height
    const rect = aiContextMenu.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    
    let top = parseInt(aiContextMenu.style.top);
    let left = parseInt(aiContextMenu.style.left);
    
    if (left + menuWidth > window.innerWidth + scrollLeft) {
        left = window.innerWidth + scrollLeft - menuWidth - 10;
        aiContextMenu.style.left = `${left}px`;
    }
    
    if (top + menuHeight > window.innerHeight + scrollTop) {
        top = window.innerHeight + scrollTop - menuHeight - 10;
        aiContextMenu.style.top = `${top}px`;
    }
    
    // Clear any previous responses
    document.getElementById('aiResponseContent').textContent = '';
    document.getElementById('aiResponseContent').classList.remove('active');
    document.getElementById('aiResponseLoading').classList.remove('active');
    document.querySelector('.ai-response-placeholder').style.display = 'block';
    
    // Set placeholder text based on whether text is selected
    const aiPromptInput = document.getElementById('aiPromptInput');
    aiPromptInput.value = '';
    if (selectedTextForAi) {
        aiPromptInput.placeholder = 'Ask AI about the selected text...';
    } else {
        aiPromptInput.placeholder = 'Ask AI to help with your script...';
    }
    
    // Focus on the prompt input
    setTimeout(() => {
        aiPromptInput.focus();
    }, 100);
    
    aiCompactMode = false;
}

function minimizeAiMenu() {
    resetToCompactMode();
}

function resetToCompactMode() {
    const aiCompactButton = document.getElementById('aiCompactButton');
    const aiExpandedMenu = document.getElementById('aiExpandedMenu');
    
    // Show the compact button
    aiCompactButton.style.display = 'flex';
    
    // Hide expanded menu
    aiExpandedMenu.style.display = 'none';
    
    aiCompactMode = true;
}

function closeAiContextMenu() {
    const aiContextMenu = document.getElementById('aiContextMenu');
    aiContextMenu.classList.remove('active');
    aiContextMenuVisible = false;
    currentAiResponse = '';
    selectedTextForAi = '';
}

// Function to clean markdown code blocks from text
function stripMarkdownCodeBlocks(text) {
    // Check if the text contains markdown code block markers
    if (text.includes('```') || text.includes('~~~')) {
        console.log('Detected markdown code blocks, cleaning...');
        
        // Strip out any starting code block markers including language specs
        // For example: ```javascript, ```python, ```sh, etc.
        let cleaned = text.replace(/^```(\w+)?\s*\n/gm, '');
        cleaned = cleaned.replace(/^~~~(\w+)?\s*\n/gm, '');
        
        // Remove ending code block markers
        cleaned = cleaned.replace(/```\s*$/gm, '');
        cleaned = cleaned.replace(/~~~\s*$/gm, '');
        
        // Handle case where the entire response is wrapped in a single code block
        if (cleaned.startsWith('```') || cleaned.startsWith('~~~')) {
            cleaned = cleaned.replace(/^```(\w+)?\s*/, '');
            cleaned = cleaned.replace(/^~~~(\w+)?\s*/, '');
            
            const endIndex = cleaned.lastIndexOf('```');
            if (endIndex !== -1) {
                cleaned = cleaned.substring(0, endIndex);
            }
            
            const tildaEndIndex = cleaned.lastIndexOf('~~~');
            if (tildaEndIndex !== -1) {
                cleaned = cleaned.substring(0, tildaEndIndex);
            }
        }
        
        return cleaned.trim();
    }
    
    return text;
}

async function submitAiPrompt() {
    const aiPromptInput = document.getElementById('aiPromptInput');
    const prompt = aiPromptInput.value.trim();
    
    if (!prompt) {
        showToast('Please enter a prompt', 'error');
        return;
    }
    
    // Check if OpenAI API key is set
    if (!currentSettings || !currentSettings.OpenAIAPIKey) {
        showToast('OpenAI API key not set. Please add it in Settings.', 'error');
        return;
    }
    
    // Show loading state
    const responseContent = document.getElementById('aiResponseContent');
    const loadingIndicator = document.getElementById('aiResponseLoading');
    const placeholder = document.querySelector('.ai-response-placeholder');
    
    responseContent.textContent = '';
    responseContent.classList.remove('active');
    loadingIndicator.classList.add('active');
    placeholder.style.display = 'none';
    
    try {
        // Use the stored selected text
        const enhancedPrompt = selectedTextForAi 
            ? `${prompt}\n\nHere's the code I'm working with:\n\`\`\`\n${selectedTextForAi}\n\`\`\``
            : prompt;
        
        // Send request to backend
        const response = await fetch('/aigen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: enhancedPrompt })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get AI response');
        }
        
        // Process the SSE response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        responseContent.textContent = '';
        responseContent.classList.add('active');
        currentAiResponse = '';
        let fullResponse = '';
        
        // Hide loading indicator
        loadingIndicator.classList.remove('active');
        
        // Read the stream
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');
            
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const data = line.substring(5).trim();
                    if (data === '[DONE]') {
                        // Final cleanup of the full response once streaming is complete
                        currentAiResponse = stripMarkdownCodeBlocks(fullResponse);
                        responseContent.textContent = currentAiResponse;
                        break;
                    }
                    
                    try {
                        const parsedData = JSON.parse(data);
                        if (parsedData.content) {
                            fullResponse += parsedData.content;
                            
                            // Live update with incremental cleaning
                            // This is a simplified clean for the streaming updates
                            currentAiResponse = fullResponse.replace(/```\w*|```/g, '').replace(/~~~\w*|~~~/g, '');
                            responseContent.textContent = currentAiResponse;
                            
                            // Auto scroll to bottom
                            responseContent.parentElement.scrollTop = responseContent.parentElement.scrollHeight;
                        }
                    } catch (error) {
                        console.error('Error parsing SSE data:', error);
                    }
                }
            }
        }
        
        // Final cleanup after stream is complete (in case we missed anything)
        currentAiResponse = stripMarkdownCodeBlocks(fullResponse);
        responseContent.textContent = currentAiResponse;
        
    } catch (error) {
        console.error('Error getting AI response:', error);
        showToast('Error getting AI response: ' + error.message, 'error');
        
        // Hide loading state
        loadingIndicator.classList.remove('active');
        
        // Show error message in response area
        responseContent.textContent = 'Error: ' + error.message;
        responseContent.classList.add('active');
        placeholder.style.display = 'none';
    }
}

function insertAiResponse() {
    if (!currentAiResponse) {
        showToast('No AI response to insert', 'error');
        return;
    }
    
    // Get the target textarea
    const targetTextareaId = document.getElementById('aiContextMenu').dataset.targetTextarea;
    const targetTextarea = document.getElementById(targetTextareaId);
    
    if (!targetTextarea) {
        showToast('Target textarea not found', 'error');
        return;
    }
    
    // Insert the response at cursor position or replace selected text
    const startPos = targetTextarea.selectionStart;
    const endPos = targetTextarea.selectionEnd;
    const textBefore = targetTextarea.value.substring(0, startPos);
    const textAfter = targetTextarea.value.substring(endPos);
    
    targetTextarea.value = textBefore + currentAiResponse + textAfter;
    
    // Update cursor position after insertion
    const newCursorPos = startPos + currentAiResponse.length;
    targetTextarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Focus back on the textarea
    targetTextarea.focus();
    
    // Close the context menu
    closeAiContextMenu();
    
    // Show success message
    showToast('AI response inserted', 'success');
}

// Add a direct right-click event listener after the page loads
window.addEventListener('load', function() {
    console.log("Window load event - adding direct right-click listener");
    const scriptContentTextarea = document.getElementById('scriptContent');
    
    if (scriptContentTextarea) {
        console.log("Found script textarea, attaching contextmenu event listener directly");
        scriptContentTextarea.oncontextmenu = function(e) {
            console.log("Direct right-click event triggered");
            
            // Check if AI context menu is enabled in settings
            if (currentSettings && currentSettings.aiContextMenuEnabled === false) {
                console.log("AI context menu is disabled in settings");
                return true; // Allow default context menu
            }
            
            e.preventDefault();
            
            // Store selected text if any
            selectedTextForAi = this.value.substring(this.selectionStart, this.selectionEnd);
            
            // Show the AI context menu
            const aiContextMenu = document.getElementById('aiContextMenu');
            if (aiContextMenu) {
                // Adjust position to account for the smaller button size
                const menuWidth = 30; // Smaller width
                const menuHeight = 24; // Smaller height
                let top = e.pageY;
                let left = e.pageX;
                
                // Adjust if it would go off screen
                const scrollTop = window.scrollY || document.documentElement.scrollTop;
                const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
                
                if (left + menuWidth > window.innerWidth + scrollLeft) {
                    left = window.innerWidth + scrollLeft - menuWidth - 10;
                }
                
                if (top + menuHeight > window.innerHeight + scrollTop) {
                    top = window.innerHeight + scrollTop - menuHeight - 10;
                }
                
                // Position the menu at the cursor
                aiContextMenu.style.top = `${top}px`;
                aiContextMenu.style.left = `${left}px`;
                
                // Store the target textarea ID
                aiContextMenu.dataset.targetTextarea = this.id;
                
                // Reset to compact mode
                const aiCompactButton = document.getElementById('aiCompactButton');
                const aiExpandedMenu = document.getElementById('aiExpandedMenu');
                
                if (aiCompactButton && aiExpandedMenu) {
                    aiCompactButton.style.display = 'flex';
                    aiExpandedMenu.style.display = 'none';
                }
                
                // Show the context menu
                aiContextMenu.classList.add('active');
                aiContextMenuVisible = true;
                
                console.log("AI context menu activated directly");
            } else {
                console.error("AI context menu element not found during direct event");
            }
            
            return false;
        };
    } else {
        console.error("Script textarea not found in load event");
    }
});

// Helper function for view modal right-click
function handleViewTextareaRightClick(e) {
    console.log("Right-click handled in view modal textarea");
    
    // Check if AI context menu is enabled in settings
    if (currentSettings && currentSettings.aiContextMenuEnabled === false) {
        console.log("AI context menu is disabled in settings");
        return true; // Allow default context menu
    }
    
    e.preventDefault();
    // Store selected text if any
    selectedTextForAi = this.value.substring(this.selectionStart, this.selectionEnd);
    showAiContextMenu(e, this);
} 