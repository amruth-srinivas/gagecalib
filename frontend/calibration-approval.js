// Calibration Approval Page
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Content Loaded - Setting up calibration approval page");
    // Initialize the page when it becomes visible
    const performPage = document.getElementById('perform');
    if (performPage) {
        console.log("Found perform page element, setting up observer");
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                    if (performPage.classList.contains('active') || performPage.style.display !== 'none') {
                        console.log('Calibration approval page became active, initializing...');
                        initializeCalibrationApproval();
                    }
                }
            });
        });

        observer.observe(performPage, { 
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    } else {
        console.error("Could not find perform page element");
    }
});

const API_BASE = "http://127.0.0.1:5005";

async function initializeCalibrationApproval() {
    console.log("Initializing Calibration Approval Page...");
    try {
        setupSearchInputs();
        console.log("Calling loadPendingApprovalsTable...");
        await loadPendingApprovalsTable();
        
        const searchGageId = document.getElementById('searchGageId');
        const searchCalibrationId = document.getElementById('searchCalibrationId');
        
        if (searchGageId) {
            searchGageId.addEventListener('input', debounce(searchCalibrations, 300));
        }
        if (searchCalibrationId) {
            searchCalibrationId.addEventListener('input', debounce(searchCalibrations, 300));
        }
        
        console.log("Calibration approval page initialized");
    } catch (error) {
        console.error('Error initializing calibration approval page:', error);
        showAlert('Error initializing page. Please try refreshing.', 'danger');
    }
}

async function loadDashboardData() {
    console.log("Loading dashboard data...");
    try {
        // Clear both tables first
        clearCalibrationTables();
        
        // Reset the global arrays
        window.pendingCalibrations = [];
        window.approvedCalibrations = [];
        
        console.log("Arrays reset in loadDashboardData:", {
            pendingCalibrations: window.pendingCalibrations,
            approvedCalibrations: window.approvedCalibrations
        });
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Error loading data. Please try again.', 'danger');
    }
}

function updateDashboardCounts(pendingCount, approvedCount) {
    const pendingCountEl = document.getElementById('pendingCount');
    const approvedCountEl = document.getElementById('approvedCount');
    
    if (pendingCountEl) pendingCountEl.textContent = pendingCount;
    if (approvedCountEl) approvedCountEl.textContent = approvedCount;
}

function normalizeResult(result) {
    if (!result) return 'Pending';
    switch(result.toString().toLowerCase()) {
        case 'approved':
            return 'PASS';
        case 'rejected':
            return 'FAIL';
        default:
            return result;
    }
}

// Store frontend state for pending/approved calibrations
window._pendingCalibrations = [];
window._approvedCalibrations = [];

// Helper to find calibration by id in a list
function findCalibrationById(list, calibrationId) {
    return list.find(cal => cal.calibration_id == calibrationId);
}

window.reviewCalibration = async function(calibrationId, isApproved = false) {
    // Find calibration in the correct list
    const cal = isApproved
        ? findCalibrationById(window._approvedCalibrations, calibrationId)
        : findCalibrationById(window._pendingCalibrations, calibrationId);
    if (!cal) {
        showAlert('Calibration not found', 'danger');
        return;
    }
    // Populate modal fields
    document.getElementById('modalGageId').textContent = cal.gage_id || 'N/A';
    document.getElementById('modalCalibrationId').textContent = cal.calibration_id || 'N/A';
    document.getElementById('modalCalibrationDate').textContent = formatDate(cal.calibration_date) || 'N/A';
    document.getElementById('modalPerformedBy').textContent = cal.performed_by_name || 'N/A';

    // Fetch real measurement points from backend using both gage_id and calibration_id
    const measurementTableBody = document.getElementById('modalMeasurementTableBody');
    measurementTableBody.innerHTML = '';
    let points = [];
    try {
        const url = `${API_BASE}/api/measurements?gage_id=${cal.gage_id}&calibration_id=${cal.calibration_id}`;
        const resp = await fetch(url);
        if (resp.ok) {
            points = await resp.json();
            console.log('Fetched measurement points:', points);
        } else {
            console.warn('Measurement fetch failed:', resp.status);
        }
    } catch (err) {
        console.error('Error fetching measurement points:', err);
    }
    if (!points || points.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center text-muted">No measurement data found for this calibration.</td>';
        measurementTableBody.appendChild(row);
    } else {
        points.forEach(pt => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pt.function_point || ''}</td>
                <td>${pt.nominal_value ?? ''}</td>
                <td>${pt.tolerance_plus ?? ''}</td>
                <td>${pt.tolerance_minus ?? ''}</td>
                <td>${pt.before_measurement ?? ''}</td>
                <td>${pt.after_measurement ?? ''}</td>
            `;
            measurementTableBody.appendChild(row);
        });
    }

    // Populate temp/humidity (mock if not available)
    document.getElementById('modalTemperature').textContent = cal.temperature || '23';
    document.getElementById('modalHumidity').textContent = cal.humidity || '45';

    // Show/hide approve/reject/reverse buttons
    document.getElementById('approveCalibrationBtn').style.display = isApproved ? 'none' : '';
    document.getElementById('rejectCalibrationBtn').style.display = isApproved ? 'none' : '';
    document.getElementById('reverseCalibrationBtn').classList.toggle('d-none', !isApproved);

    // Store current calibration id for actions
    window._currentReviewCalibrationId = calibrationId;
    window._currentReviewIsApproved = isApproved;

    // Show modal (Bootstrap 5)
    const modal = new bootstrap.Modal(document.getElementById('reviewCalibrationModal'));
    modal.show();
    window._activeReviewModal = modal;
}

// Approve/Reject/Reverse logic
function moveCalibration(calibrationId, fromList, toList) {
    const idx = fromList.findIndex(cal => cal.calibration_id == calibrationId);
    if (idx !== -1) {
        const [cal] = fromList.splice(idx, 1);
        toList.push(cal);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Approve
    document.getElementById('approveCalibrationBtn').onclick = function() {
        const id = window._currentReviewCalibrationId;
        moveCalibration(id, window._pendingCalibrations, window._approvedCalibrations);
        populatePendingTable(window._pendingCalibrations);
        populateApprovedTable(window._approvedCalibrations);
        window._activeReviewModal.hide();
    };
    // Reject (remove from pending)
    document.getElementById('rejectCalibrationBtn').onclick = function() {
        const id = window._currentReviewCalibrationId;
        const idx = window._pendingCalibrations.findIndex(cal => cal.calibration_id == id);
        if (idx !== -1) window._pendingCalibrations.splice(idx, 1);
        populatePendingTable(window._pendingCalibrations);
        window._activeReviewModal.hide();
    };
    // Reverse (move from approved to pending)
    document.getElementById('reverseCalibrationBtn').onclick = function() {
        const id = window._currentReviewCalibrationId;
        moveCalibration(id, window._approvedCalibrations, window._pendingCalibrations);
        populatePendingTable(window._pendingCalibrations);
        populateApprovedTable(window._approvedCalibrations);
        window._activeReviewModal.hide();
    };
});

// Patch populatePendingTable and populateApprovedTable to use frontend state and add reverse icon
function populatePendingTable(calibrations) {
    window._pendingCalibrations = calibrations;
    console.log("Populating pending table with data:", calibrations);
    const tableBody = document.getElementById('pendingTableBody');
    if (!tableBody) {
        console.error("Could not find pendingTableBody element");
        return;
    }
    
    tableBody.innerHTML = '';
    if (!calibrations || calibrations.length === 0) {
        console.log("No calibrations to display");
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center text-muted py-4">No calibrations found</td>';
        tableBody.appendChild(row);
        return;
    }

    console.log("Adding rows to table");
    calibrations.forEach(cal => {
        const normalizedResult = normalizeResult(cal.calibration_result);
        const row = document.createElement('tr');
        row.className = 'align-middle';
        row.innerHTML = `
            <td class="fw-medium">${cal.gage_id || 'N/A'}</td>
            <td>${cal.calibration_id || 'N/A'}</td>
            <td>${formatDate(cal.calibration_date) || 'N/A'}</td>
            <td><span class="badge ${getStatusBadgeClass(normalizedResult)}">${normalizedResult}</span></td>
            <td>${cal.performed_by_name || 'N/A'}</td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="reviewCalibration(${cal.calibration_id}, false)">
                        <i class="bi bi-eye"></i> Review
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="printCalibration(${cal.calibration_id})">
                        <i class="bi bi-printer"></i> Print
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    console.log("Finished populating table");
}

function populateApprovedTable(calibrations) {
    window._approvedCalibrations = calibrations;
    const tableBody = document.getElementById('approvedTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    if (!calibrations || calibrations.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center text-muted py-4">No approved calibrations found</td>';
        tableBody.appendChild(row);
        return;
    }
    
    calibrations.forEach(cal => {
        const normalizedResult = normalizeResult(cal.calibration_result);
        const row = document.createElement('tr');
        row.className = 'align-middle';
        row.innerHTML = `
            <td class="fw-medium">${cal.gage_id || 'N/A'}</td>
            <td>${cal.calibration_id || 'N/A'}</td>
            <td>${formatDate(cal.calibration_date) || 'N/A'}</td>
            <td><span class="badge ${getStatusBadgeClass(normalizedResult)}">${normalizedResult}</span></td>
            <td>${cal.performed_by_name || 'N/A'}</td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="reviewCalibration(${cal.calibration_id}, true)">
                        <i class="bi bi-eye"></i> Review
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="printCalibration(${cal.calibration_id})">
                        <i class="bi bi-printer"></i> Print
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="reviewCalibration(${cal.calibration_id}, true)">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function searchCalibrations() {
    const gageId = document.getElementById('searchGageId')?.value.trim();
    const calibrationId = document.getElementById('searchCalibrationId')?.value.trim();
    
    try {
        const response = await fetch('http://127.0.0.1:5005/api/measurements/unique-gage-calibrations');
        if (!response.ok) {
            throw new Error('Failed to fetch calibration data');
        }
        
        const data = await response.json();
        
        // Filter the data based on search criteria
        const filteredData = data.filter(cal => {
            const matchesGageId = !gageId || cal.gage_id.toString().includes(gageId);
            const matchesCalibrationId = !calibrationId || cal.calibration_id.toString().includes(calibrationId);
            return matchesGageId && matchesCalibrationId;
        });
        
        // Update the table with filtered data
        populatePendingTable(filteredData);
        updateDashboardCounts(filteredData.length, 0);
        
    } catch (error) {
        console.error('Error searching calibrations:', error);
        showAlert('Error searching data. Please try again.', 'danger');
    }
}

async function approveCalibration(calibrationId) {
    if (!confirm('Are you sure you want to approve this calibration?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/calibrations/${calibrationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                calibration_result: 'Approved',
                approved_at: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to approve calibration');
        }
        
        // Reload dashboard data
        await loadDashboardData();
        showAlert('Calibration approved successfully', 'success');
        
    } catch (error) {
        console.error('Error approving calibration:', error);
        showAlert('Error approving calibration. Please try again.', 'danger');
    }
}

async function rejectCalibration(calibrationId) {
    if (!confirm('Are you sure you want to reject this calibration?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/calibrations/${calibrationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                calibration_result: 'Rejected',
                rejected_at: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to reject calibration');
        }
        
        // Reload dashboard data
        await loadDashboardData();
        showAlert('Calibration rejected successfully', 'success');
        
    } catch (error) {
        console.error('Error rejecting calibration:', error);
        showAlert('Error rejecting calibration. Please try again.', 'danger');
    }
}

// Fetch and display unique gage/calibration pairs in the pending approvals table
async function loadPendingApprovalsTable() {
    console.log("Loading pending approvals table...");
    try {
        const url = 'http://127.0.0.1:5005/api/measurements/unique-gage-calibrations';
        console.log("Fetching from URL:", url);
        
        const response = await fetch(url);
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch unique gage/calibration pairs: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Fetched unique calibrations:", data);
        
        if (!data || data.length === 0) {
            console.log("No data received from the server");
            populatePendingTable([]);
            updateDashboardCounts(0, 0);
            return;
        }
        
        // Display all calibrations in the pending table
        populatePendingTable(data);
        
        // Update the count
        updateDashboardCounts(data.length, 0);
        
    } catch (error) {
        console.error('Error loading pending approvals:', error);
        showAlert('Error loading pending approvals. Please try again.', 'danger');
    }
}

// Helper functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

async function getUserName(userId) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/users/${userId}`);
        if (!response.ok) {
            return 'Unknown User';
        }
        const user = await response.json();
        return user.username;
    } catch (error) {
        console.error('Error fetching user:', error);
        return 'Unknown User';
    }
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.container-fluid');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

// Utility function for debouncing search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions available globally
window.approveCalibration = approveCalibration;
window.rejectCalibration = rejectCalibration;
window.searchCalibrations = searchCalibrations;

// Add placeholder functions for actions
document.printCalibration = function(calibrationId) {
    alert('Print Calibration: ' + calibrationId);
};

function clearCalibrationTables() {
    console.log("Clearing calibration tables...");
    
    // Clear the table elements
    const pendingTableBody = document.getElementById('pendingTableBody');
    const approvedTableBody = document.getElementById('approvedTableBody');
    
    if (pendingTableBody) {
        console.log("Clearing pending table...");
        pendingTableBody.innerHTML = '';
        const pendingRow = document.createElement('tr');
        pendingRow.innerHTML = '<td colspan="6" class="text-center">No pending calibrations</td>';
        pendingTableBody.appendChild(pendingRow);
        
        // Log the contents of pending table after clearing
        console.log("Pending table contents after clearing:", {
            innerHTML: pendingTableBody.innerHTML,
            childNodes: Array.from(pendingTableBody.childNodes).map(node => node.outerHTML),
            rows: pendingTableBody.rows.length
        });
    }
    
    if (approvedTableBody) {
        console.log("Clearing approved table...");
        approvedTableBody.innerHTML = '';
        const approvedRow = document.createElement('tr');
        approvedRow.innerHTML = '<td colspan="5" class="text-center">No approved calibrations</td>';
        approvedTableBody.appendChild(approvedRow);
        
        // Log the contents of approved table after clearing
        console.log("Approved table contents after clearing:", {
            innerHTML: approvedTableBody.innerHTML,
            childNodes: Array.from(approvedTableBody.childNodes).map(node => node.outerHTML),
            rows: approvedTableBody.rows.length
        });
    }

    // Reset the counts and log them
    updateDashboardCounts(0, 0);
    console.log("Dashboard counts after clearing:", {
        pendingCount: document.getElementById('pendingCount')?.textContent,
        approvedCount: document.getElementById('approvedCount')?.textContent
    });

    // Also log any stored arrays if they exist in window scope
    console.log("Stored arrays after clearing:", {
        pendingCalibrations: window.pendingCalibrations || [],
        approvedCalibrations: window.approvedCalibrations || []
    });
    
    console.log("Tables cleared successfully");
}

// Add these variables to track the arrays globally
window.pendingCalibrations = [];
window.approvedCalibrations = [];

// Add clear button event listener
document.addEventListener('DOMContentLoaded', () => {
    const clearButton = document.getElementById('clearCalibrations');
    if (clearButton) {
        clearButton.addEventListener('click', clearCalibrationTables);
    }
});

// Add this to your HTML head section if not already present
function addBootstrapIcons() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
    document.head.appendChild(link);
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
    addBootstrapIcons();
    // ... rest of your initialization code ...
});

// Update the search inputs to have Bootstrap styling
function setupSearchInputs() {
    const searchGageId = document.getElementById('searchGageId');
    const searchCalibrationId = document.getElementById('searchCalibrationId');
    
    if (searchGageId) {
        searchGageId.className = 'form-control';
        searchGageId.placeholder = 'Search by Gage ID...';
    }
    if (searchCalibrationId) {
        searchCalibrationId.className = 'form-control';
        searchCalibrationId.placeholder = 'Search by Calibration ID...';
    }
}

function getStatusBadgeClass(status) {
    if (!status) return 'bg-warning text-dark';
    switch(status.toString().toLowerCase()) {
        case 'approved':
        case 'pass':
            return 'bg-success';
        case 'rejected':
        case 'fail':
            return 'bg-danger';
        case 'pending':
        default:
            return 'bg-warning text-dark';
    }
} 