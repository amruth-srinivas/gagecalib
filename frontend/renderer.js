const { ipcRenderer } = require('electron');

// Check authentication status
async function checkAuth() {
    const token = localStorage.getItem('authToken');
    console.log('Checking auth, token exists:', !!token);
    
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = 'pages/login.html';
        return;
    }

    try {
        console.log('Making auth check request to /api/auth/me');
        const response = await fetch('http://127.0.0.1:5005/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Auth check response status:', response.status);
        
        if (!response.ok) {
            console.log('Auth check failed, removing token and redirecting to login');
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userId');
            showError('Session expired. Please login again.');
            window.location.href = 'pages/login.html';
            return;
        }

        const user = await response.json();
        console.log('Auth check successful, user:', user);
        
        // Validate user data
        if (!user || !user.id) {
            console.error('Invalid user data received:', user);
            throw new Error('Invalid user data received from server');
        }
        
        // Store user info in localStorage
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userId', user.id);
        
        // Update user role in navbar
        const userRoleElement = document.getElementById('userRole');
        if (userRoleElement) {
            userRoleElement.textContent = user.role;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        showError('Connection error. Please check if the server is running.');
        window.location.href = 'pages/login.html';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #e74c3c;
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Logout function
function logout() {
    console.log('Logging out, removing token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    showError('Logged out successfully');
    // Small delay before redirect to show the message
    setTimeout(() => {
        window.location.href = 'pages/login.html';
    }, 1000);
}

// Make logout function available globally
window.logout = logout;

// Check auth when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, checking auth');
    checkAuth();
    
    // The initial page setup should be handled by the page loader functions
    // based on the URL or a default page.
    // For now, assuming a default page or relying on manual navigation after auth.
});

// Add auth token to all fetch requests
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    // Only add token to requests to our backend
    if (url.startsWith('http://127.0.0.1:5005')) {
        const token = localStorage.getItem('authToken');
        if (token) {
            console.log('Adding auth token to request:', url);
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        } else {
            console.log('No token available for request:', url);
        }
    }
    return originalFetch(url, options).catch(error => {
        console.error('Fetch error:', error);
        // Only show connection error if the error is likely network related
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
             showError('Connection error. Please check if the server is running.');
        }
       
        throw error; // Re-throw the error so calling code can handle it
    });
};

// Inventory Page Logic
let allItems = []; // Made global to be accessible by all functions
let editingRow = null;
let originalRowValues = [];

// --- Sorting and Filtering Logic ---
let currentSort = { key: 'gage_id', asc: true };

function getFilters() {
    return {
        gageId: document.getElementById('searchGageId').value.trim().toLowerCase(),
        status: document.getElementById('filterStatus').value
    };
}

function filterAndSortData(data) {
    const filters = getFilters();
    let filtered = data.filter(item => {
        let match = true;
        if (filters.gageId && !String(item.gage_id).toLowerCase().includes(filters.gageId)) match = false;
        if (filters.status && item.status !== filters.status) match = false;
        return match;
    });
    // Always sort by gage_id ascending
    filtered = filtered.slice().sort((a, b) => a.gage_id - b.gage_id);
    return filtered;
}

// Function to check if user is admin
function isAdmin() {
    const userRole = localStorage.getItem('userRole');
    return userRole === 'admin';
}

// Update renderTable to handle role-based access
function renderTable(data) {
    const tbody = document.querySelector('#gageTable tbody');
    if (!tbody) {
        console.error('Gage table tbody not found');
        return;
    }
    tbody.innerHTML = '';
    const filtered = filterAndSortData(data);
    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td title="${item.gage_id}">${item.gage_id}</td>
            <td title="${item.name}">${item.name}</td>
            <td title="${item.serial_number}">${item.serial_number}</td>
            <td title="${item.model_number}">${item.model_number}</td>
            <td title="${item.manufacturer}">${item.manufacturer}</td>
            <td title="${item.location}">${item.location}</td>
            <td title="${item.status}">${item.status}</td>
            <td title="${item.last_calibration_date}">${item.last_calibration_date}</td>
            <td title="${item.next_calibration_due}">${item.next_calibration_due}</td>
            <td title="${item.gage_type}">${item.gage_type}</td>
            <td title="${item.cal_category}">${item.cal_category}</td>
            <td>
                <div class="action-buttons">
                    ${isAdmin() ? `
                        <button class="action-icon edit-btn" onclick="editGage('${item.gage_id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-icon delete-btn" onclick="deleteGage('${item.gage_id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    console.log('Inventory table rendered.');
}

// Update loadInventory to handle role-based access
async function loadInventory() {
    console.log('loadInventory called');
    
    // Setup search input listener if not already set
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.removeEventListener('input', handleSearch);
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Setup filter status listener
    const filterStatusSelect = document.getElementById('filterStatus');
    if (filterStatusSelect) {
        filterStatusSelect.removeEventListener('change', handleSearch);
        filterStatusSelect.addEventListener('change', handleSearch);
    }

    // Hide action buttons for non-admin users
    const actionButtons = document.querySelectorAll('.inventory-actions .action-btn');
    actionButtons.forEach(button => {
        if (!isAdmin()) {
            button.style.display = 'none';
        }
    });

    // Fetch items regardless of page visibility
    await fetchItems();
}

// Handle search input (also called by filter changes)
function handleSearch() {
    renderTable(allItems);
}

// Update fetchItems to use /api/gages and new fields
async function fetchItems() {
    try {
        const response = await fetch('http://127.0.0.1:5005/api/gages', {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch gages:', response.status, response.statusText, errorText);
            throw new Error(`Failed to fetch gages: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        allItems = data;
        renderTable(allItems);
        updateSummary(allItems);
    } catch (err) {
        console.error('Error loading inventory data:', err);
        const tableBody = document.querySelector('#gageTable tbody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="12">Error loading data: ${err.message}</td></tr>`;
        }
         showError('Error loading inventory data.');
    }
}

// Note: The in-line editing functions (startEditRow, saveEdits, cancelEdits) are likely deprecated
// by the modal editing approach and can potentially be removed later.

function startEditRow(row, id) {
    editingRow = row;
    originalRowValues = Array.from(row.querySelectorAll('td')).map(td => td.textContent);
    // Make editable (skip gage_id and actions)
    for (let i = 1; i <= 13; i++) {
        row.cells[i].setAttribute('contenteditable', 'true');
        row.cells[i].classList.add('editable-cell');
    }
    // Replace actions with Save/Cancel
    row.cells[14].innerHTML = `
        <button type="button" class="action-icon save-btn" data-id="${id}" title="Save"><i class="fas fa-save"></i></button>
        <button type="button" class="action-icon cancel-btn" data-id="${id}" title="Cancel"><i class="fas fa-times"></i></button>
    `;
}

async function saveEdits(id, row) {
    try {
        const cells = row.querySelectorAll('td');
        const updatedItem = {
            name: cells[1].textContent.trim(),
            description: cells[2].textContent.trim(),
            serial_number: cells[3].textContent.trim(),
            model_number: cells[4].textContent.trim(),
            manufacturer: cells[5].textContent.trim(),
            purchase_date: cells[6].textContent.trim(),
            location: cells[7].textContent.trim(),
            status: cells[8].textContent.trim(),
            calibration_frequency: parseInt(cells[9].textContent.trim()) || 0,
            last_calibration_date: cells[10].textContent.trim(),
            next_calibration_due: cells[11].textContent.trim(),
            gage_type: cells[12].textContent.trim(),
            cal_category: cells[13].textContent.trim()
        };
        console.log('Attempting to save edits for gage ID', id, ':', updatedItem);
        const response = await fetch(`http://127.0.0.1:5005/api/gages/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(updatedItem)
        });
        
        console.log('Save edits response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
             console.error('Failed to update gage:', response.status, response.statusText, errorText);
            showNotification('Failed to update gage: ' + errorText, true);
            return;
        }
        showNotification('Changes saved successfully!');
        editingRow = null;
        await fetchItems();
    } catch (err) {
         console.error('Error saving changes:', err);
        showNotification('Error saving changes', true);
    }
}

function cancelEdits(row) {
    if (!editingRow) return;
    Array.from(row.querySelectorAll('td')).forEach((td, i) => {
        td.textContent = originalRowValues[i];
        td.removeAttribute('contenteditable');
        td.classList.remove('editable-cell');
    });
    // Restore actions
    const id = row.getAttribute('data-gage-id'); // Assuming data-gage-id is set
    // Need to find the correct cell for actions, assuming it's the last one (index 11)
    const actionCellIndex = 11; // Adjust if table structure changes
     if (row.cells.length > actionCellIndex) {
        row.cells[actionCellIndex].innerHTML = `
            <button class="action-icon edit-btn" onclick="editGage('${id}')"><i class="fas fa-edit"></i></button>
            <button class="action-icon delete-btn" onclick="deleteGage('${id}')"><i class="fas fa-trash"></i></button>
        `;
     }

    editingRow = null;
     console.log('Edits cancelled.');
}

// Function to handle deleting an item
async function deleteItem(id) {
    console.log('Deleting item with ID:', id);
    if (!confirm(`Are you sure you want to delete item ${id}?`)) return;
    
    try {
        const response = await fetch(`http://127.0.0.1:5005/api/gages/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
         console.log('Delete response status:', response.status);

        if (!response.ok) {
             const errorText = await response.text();
             console.error('Failed to delete item:', response.status, response.statusText, errorText);
            throw new Error('Failed to delete item');
        }
        
        showNotification('Item deleted successfully');
        await fetchItems(); // Refresh the data
    } catch (err) {
        console.error('Error deleting item:', err);
        showNotification('Error deleting item', true);
    }
}

function updateSummary(items) {
    const totalGaugesEl = document.getElementById('totalGauges');
    const activeGaugesEl = document.getElementById('activeGauges');
    const issuedGaugesEl = document.getElementById('issuedGauges');

    // Update summary card values
    // Assuming createSummaryCard is defined elsewhere or static HTML is used
    if (totalGaugesEl) totalGaugesEl.textContent = items.length;
    
    if (activeGaugesEl) {
        activeGaugesEl.textContent = items.filter(i => i.status && i.status.toLowerCase() === 'active').length;
    }
    
    if (issuedGaugesEl) {
         issuedGaugesEl.textContent = items.filter(i => i.status && i.status.toLowerCase() === 'issued').length;
    }
     console.log('Inventory summary updated.');
}

// Assuming createSummaryCard is defined elsewhere or static HTML is used in index.html
// function createSummaryCard(title, value, color) { ... }

// Add this CSS to your existing styles (assuming styles are managed elsewhere or in index.html)
/*
const styles = `...`;
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
*/

// Load inventory page when it becomes visible
function setupInventoryPageLoader() {
    console.log('Setting up inventory page loader');
    const inventoryPage = document.getElementById('inventory');
    if (!inventoryPage) {
        console.error('Inventory page element not found');
        return;
    }
    
    // Initial load if page is active on DOMContentLoaded
     // This might conflict with showPage logic if showPage is also called on DOMContentLoaded
     // The current index.html seems to handle initial page display via class 'active'
    // if (inventoryPage.classList.contains('active') || inventoryPage.style.display === 'block') {
    //     console.log('Inventory page is active on load, initializing...');
    //     loadInventory();
    // }
    
    // Setup mutation observer for visibility changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                // Check if the page is now visible (either has class 'active' or display is not 'none')
                if (inventoryPage.classList.contains('active') || inventoryPage.style.display !== 'none') {
                     console.log('Inventory page became active, initializing...');
                    loadInventory();
                }
            }
        });
    });
    
    // Observe changes to 'class' and 'style' attributes on the inventory page element
    observer.observe(inventoryPage, { 
        attributes: true,
        attributeFilter: ['class', 'style']
    });
     console.log('Inventory page mutation observer setup.');
}

// Add this after the setupInventoryPageLoader function
function setupReportsPageLoader() {
    console.log('Setting up reports page loader');
    const reportsPage = document.getElementById('reports');
    if (!reportsPage) {
        console.error('Reports page element not found');
        return;
    }
    
    // Setup mutation observer for visibility changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                // Check if the page is now visible
                if (reportsPage.classList.contains('active') || reportsPage.style.display !== 'none') {
                    console.log('Reports page became active, initializing...');
                    // Re-initialize the ReportManager
                    if (typeof window.initializeReportManager === 'function') {
                        window.initializeReportManager();
                    }
                }
            }
        });
    });
    
    // Observe changes to 'class' and 'style' attributes
    observer.observe(reportsPage, { 
        attributes: true,
        attributeFilter: ['class', 'style']
    });
    console.log('Reports page mutation observer setup.');
}

// Update the showPage function to include reports page initialization
function showPage(pageId) {
    console.log('Showing page:', pageId);
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
        page.classList.remove('active');
    });
    
    // Show the selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        console.log('Found selected page element:', selectedPage.id);
        selectedPage.style.display = 'block';
        selectedPage.classList.add('active');
        
        // Initialize page-specific logic
        if (pageId === 'calibrationPlanner') {
            console.log('Initializing calibration planner page.');
            if (typeof initializeCalendar === 'function') {
                initializeCalendar();
            } else {
                console.error('initializeCalendar function not found.');
            }
        } else if (pageId === 'inventory') {
            console.log('Initializing inventory page.');
            loadInventory();
        } else if (pageId === 'reports') {
            console.log('Initializing reports page.');
            if (typeof window.initializeReportManager === 'function') {
                window.initializeReportManager();
            } else {
                console.error('initializeReportManager function not found.');
            }
        } else if (pageId === 'issue-log') {
            console.log('Initializing Issue Log page.');
            if (typeof setupIssueLogPageLoader === 'function') {
                setupIssueLogPageLoader();
            } else {
                console.error('setupIssueLogPageLoader function not found.');
            }
        } else if (pageId === 'tracker') {
            console.log('Initializing Gage Tracker page.');
        }
    } else {
        console.error('Page element not found:', pageId);
    }
    
    // Update active state in navigation
    pages.forEach(page => {
        const link = document.getElementById(page.link);
        if (link) {
            if (page.id === pageId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        }
    });
    console.log('Navigation updated.');
}

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up page loaders');
    setupInventoryPageLoader();
    setupReportsPageLoader();
    setupAddGageModal();
});

// Add New Gage Modal Handling
function setupAddGageModal() {
    console.log('Setting up add gage modal');
    const addBtn = document.getElementById('addGageBtn');
    const modal = document.getElementById('addGageModal');
    const closeBtn = document.querySelector('#addGageModal .close-modal');
    const cancelBtn = document.getElementById('cancelAddGage');
    const form = document.getElementById('addGageForm');
    
    if (!addBtn || !modal || !closeBtn || !cancelBtn || !form) {
        console.error('Required modal elements not found for add gage modal', { // More specific error message
            addBtn: !!addBtn,
            modal: !!modal,
            closeBtn: !!closeBtn,
            cancelBtn: !!cancelBtn,
            form: !!form
        });
        return;
    }
    
    // Open modal
    addBtn.addEventListener('click', () => {
        console.log('Opening add gage modal');
        modal.style.display = 'block';
        // Reset form
        form.reset();
        // Set title to Add New Gage
        const title = modal.querySelector('h2');
         if (title) title.textContent = 'Add New Gage';
         // Set button text to Save
         const submitBtn = modal.querySelector('#saveGage');
         if (submitBtn) submitBtn.textContent = 'Save';
    });
    
    // Close modal function
    function closeModal() {
        console.log('Closing add gage modal');
        modal.style.display = 'none';
        form.reset();
         // Reset form submit handler to default add handler
         form.onsubmit = handleAddGageSubmit;
    }
    
    // Close button handlers
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Initial form submit handler setup
     form.onsubmit = handleAddGageSubmit;
}

// Handle form submit for adding a new gage
async function handleAddGageSubmit(e) {
    e.preventDefault();
    console.log('Add Gage Form submitted');

    // Check which button was clicked (Save for Add or Update for Edit)
    const submitBtn = e.submitter; // Get the button that triggered the submit
    const gageId = submitBtn.dataset.gageId; // Check for gageId attribute on the button

    if (gageId) {
        // This is an update operation
        await updateGage(gageId);
    } else {
         // This is an add operation
        
        // Prepare formData without gage_id for creation
        const formData = {
            name: document.getElementById('name').value.trim(),
            description: document.getElementById('description').value.trim(),
            serial_number: document.getElementById('serial_number').value.trim(),
            model_number: document.getElementById('model_number').value.trim(),
            manufacturer: document.getElementById('manufacturer').value.trim(),
            purchase_date: document.getElementById('purchase_date').value,
            location: document.getElementById('location').value.trim(),
            status: document.getElementById('gageStatus').value, // Assuming this is the ID for the status select
            calibration_frequency: parseInt(document.getElementById('calibration_frequency').value) || 0, // Assuming ID
            last_calibration_date: document.getElementById('last_calibration_date').value,
            next_calibration_due: document.getElementById('next_calibration_due').value,
            gage_type: document.getElementById('gage_type').value.trim(),
            cal_category: document.getElementById('cal_category').value.trim() // Assuming ID
        };

        console.log('New Gage FormData:', formData); 

        // Basic validation
        if (!formData.name || !formData.description || !formData.status) { // Added status to required fields
            showNotification('Please fill in all required fields', true);
            return; // Stop here if validation fails
        }
        
        try {
            // POST request for new gage (no gage_id)
            console.log('Sending POST request to /api/gages');
            const response = await fetch('http://127.0.0.1:5005/api/gages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            console.log('POST response status:', response.status);

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Server error adding gage:', response.status, response.statusText, errorData);
                throw new Error(errorData || 'Failed to add gage');
            }
            
            const result = await response.json();
            console.log('Gage added successfully:', result);
            
            // Close modal and refresh table after successful add
            const modal = document.getElementById('addGageModal');
            if (modal) modal.style.display = 'none';
            
            showNotification('New gage added successfully!');
            await fetchItems(); // Refresh the table
            
        } catch (err) {
            console.error('Error adding gage:', err);
            showNotification(err.message || 'Error adding gage', true); // Show detailed error if available
        }
    }
}

// Function to show notifications
function showNotification(message, isError = false) {
    console.log('Showing notification:', message, 'Is Error:', isError);
    const notification = document.getElementById('notification');
    if (!notification) {
        console.error('Notification element not found');
        return;
    }
    
    const notificationContent = notification.querySelector('.notification-content');
    const notificationMessage = notification.querySelector('.notification-message');
    
    if (!notificationContent || !notificationMessage) {
        console.error('Notification sub-elements not found');
        return;
    }
    
    notificationContent.style.backgroundColor = isError ? '#e74c3c' : '#2ecc71';
    notificationMessage.textContent = message;
    notification.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Update the navigation links array to include calibration planner
const pages = [ // Define globally if used by showPage and event listeners
    { id: 'home', link: 'homeLink' },
    { id: 'inventory', link: 'inventoryLink' },
    { id: 'calibrationPlanner', link: 'calibrationLink' },
    { id: 'tracker', link: 'trackerLink' }, // Keep 'tracker' ID here for sidebar logic
    { id: 'perform', link: 'performLink' },
    { id: 'report', link: 'reportLink' },
    { id: 'label', link: 'labelLink' }
];

// Add these functions for edit and delete functionality (Gage Inventory)
// These functions are called by onclick attributes in renderTable
async function editGage(gageId) {
    console.log('Edit Gage called for ID:', gageId);
    try {
        console.log('Fetching gage details for ID:', gageId);
        const response = await fetch(`http://127.0.0.1:5005/api/gages/${gageId}`);
        
        console.log('Fetch gage details response status:', response.status);
        if (!response.ok) {
             const errorText = await response.text();
             console.error('Failed to fetch gage details:', response.status, response.statusText, errorText);
            throw new Error('Failed to fetch gage details');
        }
        
        const gage = await response.json();
        console.log('Gage details fetched:', gage);

        // Get the modal and form elements
        const modal = document.getElementById('addGageModal');
        const form = document.getElementById('addGageForm');
        
         if (!modal || !form) {
             console.error('Add/Edit Gage Modal or Form not found.');
             showError('Modal elements missing.');
             return;
         }

        // Populate form with gage data
        // Ensure all form elements exist before setting value
        const formElements = {
            name: document.getElementById('name'),
            description: document.getElementById('description'),
            serial_number: document.getElementById('serial_number'),
            model_number: document.getElementById('model_number'),
            manufacturer: document.getElementById('manufacturer'),
            purchase_date: document.getElementById('purchase_date'),
            location: document.getElementById('location'),
            status: document.getElementById('gageStatus'), // Assuming ID
            calibration_frequency: document.getElementById('calibration_frequency'), // Assuming ID
            last_calibration_date: document.getElementById('last_calibration_date'),
            next_calibration_due: document.getElementById('next_calibration_due'),
            gage_type: document.getElementById('gage_type'), // Assuming ID
            cal_category: document.getElementById('cal_category') // Assuming ID
        };

        Object.entries(formElements).forEach(([key, element]) => {
            if (element) {
                // Handle date fields separately to format them for input[type="date"]
                 if (key.includes('date') && gage[key]) {
                     try {
                        // Ensure date is in YYYY-MM-DD format
                         const dateObj = new Date(gage[key]);
                         if (!isNaN(dateObj.getTime())) {
                              element.value = dateObj.toISOString().split('T')[0];
                         } else {
                             element.value = ''; // Set empty if date is invalid
                             console.warn(`Invalid date format for ${key}: ${gage[key]}`);
                         }
                     } catch (dateErr) {
                          console.error(`Error processing date field ${key}: ${gage[key]}`, dateErr);
                         element.value = '';
                     }
                 } else {
                     element.value = gage[key] || ''; // Set value, default to empty string if null/undefined
                 }
            } else {
                console.warn(`Form element not found when populating for edit: ${key}`);
            }
        });

        // Set form title and submit button text for editing
        const title = modal.querySelector('h2');
        const submitBtn = modal.querySelector('#saveGage'); // Assuming the submit button has ID saveGage
        if (title) title.textContent = 'Edit Gage';
        if (submitBtn) {
            submitBtn.textContent = 'Update';
            submitBtn.dataset.gageId = gageId; // Store gageId on the button
            // Update the form's onsubmit to use the update logic when this button is clicked
             form.onsubmit = handleAddGageSubmit; // Re-use the handler that checks for data-gage-id
        }
        
        // Show the modal
        modal.style.display = 'block';
        console.log('Edit Gage modal shown.');

    } catch (error) {
        console.error('Error fetching gage details for edit:', error);
        showNotification('Error loading gage details for editing.', true);
    }
}

// updateGage function is now integrated into handleAddGageSubmit
/*
async function updateGage(gageId) {
    // ... update logic ...
}
*/

async function deleteGage(gageId) {
    console.log('Deleting gage with ID:', gageId);
    if (!confirm('Are you sure you want to delete this gage?')) {
        console.log('Delete cancelled.');
        return;
    }

    try {
        console.log('Sending DELETE request to /api/gages/', gageId);
        const response = await fetch(`http://127.0.0.1:5005/api/gages/${gageId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

         console.log('Delete response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
             console.error('Failed to delete gage:', response.status, response.statusText, errorText);
            throw new Error('Failed to delete gage');
        }

        showNotification('Gage deleted successfully');
        await fetchItems(); // Refresh the table
         console.log('Gage deleted and table refreshed.');
    } catch (error) {
        console.error('Error deleting gage:', error);
        showNotification('Error deleting gage', true);
    }
}

// Make these functions available globally if needed by onclick attributes
window.editGage = editGage;
window.deleteGage = deleteGage;

// --- Event Listeners for Filters ---
['searchGageId', 'filterStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        // Use 'input' for text and 'change' for select
        const eventType = (el.tagName.toLowerCase() === 'select') ? 'change' : 'input';
        el.addEventListener(eventType, handleSearch);
         console.log(`Added ${eventType} listener to #${id}`);
    }
});

// Gage Tracker related functions and listeners are being removed as they are handled by gage-tracker.js
/*
let allLogs = []; // Redundant

function renderTrackingPage() { // Redundant
    // ... removed innerHTML assignment ...
    loadTrackingData();
}

async function loadTrackingData() { // Redundant
    // ... fetch logic ...
}

function updateTrackingSummary(logs) { // Redundant
    // ... summary update logic ...
}

function renderTrackingTable(logs) { // Redundant
    // ... table rendering logic ...
}

function setupTrackerEventListeners() { // Redundant
    // ... event listener setup ...
}

function setupIssueGageModal() { // Redundant, handled by gage-tracker.js
    // ... modal setup ...
}

async function loadGageOptions() { // Redundant, handled by gage-tracker.js
    // ... load options ...
}

async function handleIssueGage() { // Redundant, handled by gage-tracker.js
    // ... handle issue ...
}

async function returnGage(logId) { // Redundant, handled by gage-tracker.js
    // ... handle return ...
}
*/

// Import gage tracker functionality - this line already exists in index.html script tags
// require('./gage-tracker.js');

// Make functions from gage-tracker.js globally available if needed by onclick attributes
// These should ideally be handled by event delegation in gage-tracker.js
// window.editIssueLog = editIssueLog; // Redundant as editIssueLog is in gage-tracker.js
// window.returnGage = returnGage; // Redundant as returnGage is in gage-tracker.js
// window.deleteIssueLog = deleteIssueLog; // Redundant as deleteIssueLog is in gage-tracker.js

// Note: The modals for Issue Log are in index.html, but their handling logic
// is expected to be within gage-tracker.js based on its content.

// This initial checkAuth() call should ideally trigger showing the default page after authentication.
// Consider calling showPage('home'); or checking the URL hash here after checkAuth() succeeds.
// For now, relying on index.html having an 'active' class on the default page.
