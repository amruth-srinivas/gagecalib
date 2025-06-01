// Gage Tracker functionality
let allIssueLogs = [];

// Load issue logs when page becomes visible
function setupIssueLogPageLoader() {
    console.log('--- Inside setupIssueLogPageLoader ---');
    const issueLogPage = document.getElementById('issue-log');
    if (!issueLogPage) {
        console.error('Issue Log page element #issue-log not found.');
        return;
    }

    console.log('Issue Log page element found.');
    // Initial load of data
    loadIssueLogs();
    console.log('Initial loadIssueLogs called from setupIssueLogPageLoader.');
}

// Load issue logs from API
async function loadIssueLogs() {
    console.log('--- Inside loadIssueLogs function ---');
    try {
        // Get current user role and ID
        const userRoleElement = document.getElementById('userRole');
        const userRole = userRoleElement ? userRoleElement.textContent : 'user';
        const userId = parseInt(localStorage.getItem('userId'));
        
        console.log('Current user role:', userRole, 'User ID:', userId);

        if (userRole === 'admin') {
            // For admin, fetch all logs
            console.log('Fetching all issue logs for admin');
            const response = await fetch('http://127.0.0.1:5005/api/issue-log');
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to fetch issue logs:', response.status, response.statusText, errorText);
                throw new Error(`Failed to fetch issue logs: ${response.status} ${response.statusText}`);
            }

            allIssueLogs = await response.json();
            
            // Create and show admin table
            const adminTableContainer = document.createElement('div');
            adminTableContainer.id = 'admin-issue-log-table';
            adminTableContainer.innerHTML = `
                <div class="table-section">
                    <h3>All Gage Issue Logs</h3>
                    <div class="table-container" style="max-height: 600px; overflow: auto;">
                        <table class="data-table" id="issue-log-table">
                            <thead>
                            <tr>
                                <th>Issue ID</th>
                                <th>Gage ID</th>
                                <th>Issue Date</th>
                                <th>Issued From</th>
                                <th>Issued To</th>
                                <th>Handled By</th>
                                <th>Return Date</th>
                                <th>Returned By</th>
                                <th>Condition on Return</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allIssueLogs.map(log => `
                                <tr>
                                    <td>${log.issue_id}</td>
                                    <td>${log.gage_id}</td>
                                    <td>${log.issue_date ? new Date(log.issue_date).toLocaleDateString() : '-'}</td>
                                    <td>${log.issued_from || '-'}</td>
                                    <td>${log.issued_to || '-'}</td>
                                    <td>${log.handled_by || '-'}</td>
                                    <td>${log.return_date ? new Date(log.return_date).toLocaleDateString() : '-'}</td>
                                    <td>${log.returned_by || '-'}</td>
                                    <td>${log.condition_on_return || '-'}</td>
                                    <td>
                                        <div class="action-buttons">
                                            ${!log.return_date ? `
                                                <button class="action-icon return-btn" onclick="returnGage('${log.issue_id}')">
                                                    <i class="fas fa-undo"></i>
                                                </button>
                                            ` : ''}
                                            <button class="action-icon edit-btn" onclick="editIssueLog('${log.issue_id}')">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="action-icon delete-btn" onclick="deleteIssueLog('${log.issue_id}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Replace existing tables with admin table
            const issueLogPage = document.getElementById('issue-log');
            if (issueLogPage) {
                const existingTables = issueLogPage.querySelectorAll('.table-section');
                existingTables.forEach(table => table.remove());
                issueLogPage.appendChild(adminTableContainer);
            }

            // Update summary to show total counts
            const totalGagesEl = document.getElementById('total-gages-count');
            const issuedOutEl = document.getElementById('issued-out-count');
            const returnedEl = document.getElementById('returned-count');

            if (totalGagesEl) totalGagesEl.textContent = allIssueLogs.length;
            if (issuedOutEl) issuedOutEl.textContent = allIssueLogs.filter(log => !log.return_date).length;
            if (returnedEl) returnedEl.textContent = allIssueLogs.filter(log => log.return_date).length;

        } else {
            // For regular users, validate user ID
            if (!userId || userId <= 0) {
                console.error('Invalid or missing user ID');
                showError('Please log in to view your gages');
                return;
            }

            // For regular users, fetch their specific logs
            console.log('Fetching user-specific logs for user ID:', userId);
            const response = await fetch(`http://127.0.0.1:5005/api/issue-log/user/${userId}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to fetch user gages:', response.status, response.statusText, errorText);
                throw new Error(`Failed to fetch user gages: ${response.status} ${response.statusText}`);
            }

            const userGages = await response.json();
            console.log('User gages data:', userGages);

            // Show user tables
            const handledTable = document.querySelector('#user-handled-table');
            const returnedTable = document.querySelector('#user-returned-table');
            
            if (handledTable) handledTable.style.display = 'table';
            if (returnedTable) returnedTable.style.display = 'table';
            
            // Update table headers for user view
            const handledTableHeader = document.querySelector('#user-handled-table thead tr');
            const returnedTableHeader = document.querySelector('#user-returned-table thead tr');
            
            if (handledTableHeader) {
                handledTableHeader.innerHTML = `
                    <th>Issue ID</th>
                    <th>Gage ID</th>
                    <th>Issue Date</th>
                    <th>Issued From</th>
                    <th>Issued To</th>
                    <th>Actions</th>
                `;
            }
            
            if (returnedTableHeader) {
                returnedTableHeader.innerHTML = `
                    <th>Issue ID</th>
                    <th>Gage ID</th>
                    <th>Issue Date</th>
                    <th>Issued From</th>
                    <th>Issued To</th>
                    <th>Return Date</th>
                    <th>Condition on Return</th>
                `;
            }

            // Update summaries
            updateIssueLogSummary(userGages.handled_gages, userGages.returned_gages);
            
            // Render both tables
            renderUserHandledTable(userGages.handled_gages, userRole);
            renderUserReturnedTable(userGages.returned_gages, userRole);
        }

    } catch (err) {
        console.error('Error in loadIssueLogs:', err);
        showError('Error loading issue logs: ' + err.message);
    }
}

// Update summary cards
function updateIssueLogSummary(handledLogs, returnedLogs) {
    console.log('--- Inside updateIssueLogSummary function ---');
    const totalGagesEl = document.getElementById('total-gages-count');
    const issuedOutEl = document.getElementById('issued-out-count');
    const returnedEl = document.getElementById('returned-count');

    if (totalGagesEl) totalGagesEl.textContent = handledLogs.length + returnedLogs.length;
    if (issuedOutEl) issuedOutEl.textContent = handledLogs.length;
    if (returnedEl) returnedEl.textContent = returnedLogs.length;
    console.log('Issue log summary updated.');
}

// Render table for gages currently handled by user
function renderUserHandledTable(logs, userRole) {
    console.log('--- Inside renderUserHandledTable function ---', logs);
    const tbody = document.querySelector('#user-handled-table tbody');
    if (!tbody) {
        console.error('User handled table tbody not found.');
        return;
    }
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        console.log('No handled logs to render.');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No gages currently in possession.</td></tr>';
        return;
    }

    // Sort logs by issue_date in ascending order
    logs.sort((a, b) => new Date(a.issue_date) - new Date(b.issue_date));

    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.issue_id}</td>
            <td>${log.gage_id}</td>
            <td>${log.issue_date ? new Date(log.issue_date).toLocaleDateString() : '-'}</td>
            <td>${log.issued_from || '-'}</td>
            <td>${log.issued_to || '-'}</td>
            <td>${log.expected_return_date ? new Date(log.expected_return_date).toLocaleDateString() : '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-icon return-btn" onclick="returnGage('${log.issue_id}')" title="Return Gage">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    console.log(`${logs.length} handled gage rows rendered.`);
}

// Render table for gages returned by user
function renderUserReturnedTable(logs, userRole) {
    console.log('--- Inside renderUserReturnedTable function ---', logs);
    const tbody = document.querySelector('#user-returned-table tbody');
    if (!tbody) {
        console.error('User returned table tbody not found.');
        return;
    }
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        console.log('No returned logs to render.');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No gage return history found.</td></tr>';
        return;
    }

    // Sort logs by return_date in ascending order
    logs.sort((a, b) => new Date(a.return_date) - new Date(b.return_date));

    logs.forEach(log => {
        const tr = document.createElement('tr');
        const conditionClass = getConditionClass(log.condition_on_return);
        tr.innerHTML = `
            <td>${log.issue_id}</td>
            <td>${log.gage_id}</td>
            <td>${log.issue_date ? new Date(log.issue_date).toLocaleDateString() : '-'}</td>
            <td>${log.issued_from || '-'}</td>
            <td>${log.issued_to || '-'}</td>
            <td>${log.return_date ? new Date(log.return_date).toLocaleDateString() : '-'}</td>
            <td><span class="status-badge ${conditionClass}">${log.condition_on_return || '-'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    console.log(`${logs.length} returned gage rows rendered.`);
}

// Helper function to get condition class for styling
function getConditionClass(condition) {
    switch(condition?.toLowerCase()) {
        case 'good':
            return 'status-good';
        case 'fair':
            return 'status-fair';
        case 'poor':
            return 'status-poor';
        case 'damaged':
            return 'status-damaged';
        default:
            return '';
    }
}

// Add new issue log
async function addIssueLog(formData) {
    console.log('--- Inside addIssueLog function ---', formData);
    try {
        const response = await fetch('http://127.0.0.1:5005/api/issue-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        console.log('Add issue log response status:', response.status);
        if (!response.ok) {
             const errorText = await response.text();
             console.error('Failed to create issue log:', response.status, response.statusText, errorText);
            throw new Error('Failed to create issue log');
        }

        showNotification('Issue log created successfully');
        await loadIssueLogs();
         console.log('Issue log added and table refreshed.');
    } catch (err) {
        console.error('Error creating issue log:', err);
        showError('Error creating issue log: ' + err.message);
    }
}

// Edit issue log
async function editIssueLog(issueId) {
     console.log('--- Inside editIssueLog function ---', issueId);
    try {
         console.log('Fetching issue log details for ID:', issueId);
        const response = await fetch(`http://127.0.0.1:5005/api/issue-log/${issueId}`);

        console.log('Fetch issue log details response status:', response.status);
        if (!response.ok) {
             const errorText = await response.text();
             console.error('Failed to fetch issue log details:', response.status, response.statusText, errorText);
            throw new Error('Failed to fetch issue log details');
        }

        const issueLog = await response.json();
         console.log('Issue log details fetched:', issueLog);

        // Populate form with issue log data
        // Ensure elements exist before setting values
        const editIssueIdEl = document.getElementById('editIssueId');
        const editGageIdEl = document.getElementById('editGageId');
        const editIssueDateEl = document.getElementById('editIssueDate');
        const editIssuedFromEl = document.getElementById('editIssuedFrom');
        const editIssuedToEl = document.getElementById('editIssuedTo');
        const editHandledByEl = document.getElementById('editHandledBy');
        const editReturnDateEl = document.getElementById('editReturnDate');
        const editReturnedByEl = document.getElementById('editReturnedBy');
        const editConditionEl = document.getElementById('editCondition');

        if (editIssueIdEl) editIssueIdEl.value = issueLog.issue_id;
        if (editGageIdEl) editGageIdEl.value = issueLog.gage_id;
        if (editIssueDateEl) editIssueDateEl.value = issueLog.issue_date;
        if (editIssuedFromEl) editIssuedFromEl.value = issueLog.issued_from;
        if (editIssuedToEl) editIssuedToEl.value = issueLog.issued_to;
        if (editHandledByEl) editHandledByEl.value = issueLog.handled_by;
        if (editReturnDateEl) editReturnDateEl.value = issueLog.return_date || '';
        if (editReturnedByEl) editReturnedByEl.value = issueLog.returned_by || '';
        if (editConditionEl) editConditionEl.value = issueLog.condition_on_return || '';


        // Show edit modal
         const editModal = document.getElementById('editIssueLogModal');
         if (editModal) {
             editModal.style.display = 'block';
             console.log('Edit Issue Log modal shown.');
         } else {
             console.error('Edit Issue Log Modal element not found.');
         }

    } catch (err) {
        console.error('Error loading issue log details:', err);
        showError('Error loading issue log details: ' + err.message);
    }
}

// Update issue log
async function updateIssueLog(formData) {
    console.log('--- Inside updateIssueLog function ---', formData);
    try {
         console.log('Sending PUT request to /api/issue-log/', formData.issue_id, ':', formData);
        const response = await fetch(`http://127.0.0.1:5005/api/issue-log/${formData.issue_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        console.log('Update issue log response status:', response.status);
        if (!response.ok) {
             const errorText = await response.text();
             console.error('Failed to update issue log:', response.status, response.statusText, errorText);
            throw new Error('Failed to update issue log');
        }

        showNotification('Issue log updated successfully');
         const editModal = document.getElementById('editIssueLogModal');
         if (editModal) {
             editModal.style.display = 'none';
              console.log('Edit Issue Log modal hidden.');
         }

        await loadIssueLogs();
         console.log('Issue log updated and table refreshed.');

    } catch (err) {
        console.error('Error updating issue log:', err);
        showError('Error updating issue log: ' + err.message);
    }
}

// Return gage
async function returnGage(issueId) {
    console.log('--- Inside returnGage function ---', issueId);
    if (!confirm('Are you sure you want to mark this gage as returned?')) {
        console.log('Return cancelled.');
        return;
    }

    try {
        // Get current user ID
        const currentUserId = localStorage.getItem('userId');
        if (!currentUserId) {
            throw new Error('No user ID found');
        }

        // Fetch the existing issue log data
        const response = await fetch(`http://127.0.0.1:5005/api/issue-log/${issueId}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch issue log for return:', response.status, response.statusText, errorText);
            throw new Error('Failed to fetch issue log for return');
        }
        const issueLog = await response.json();
        console.log('Fetched issue log for return:', issueLog);

        // Update with return information
        const updateData = {
            ...issueLog,
            return_date: new Date().toISOString(),
            returned_by: parseInt(currentUserId),
            condition_on_return: "Good" // You might want to add a form to get this from the user
        };

        const updateResponse = await fetch(`http://127.0.0.1:5005/api/issue-log/${issueId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('Failed to update issue log for return:', updateResponse.status, updateResponse.statusText, errorText);
            throw new Error('Failed to update issue log for return');
        }

        showNotification('Gage marked as returned successfully');
        await loadIssueLogs(); // Refresh both tables
        console.log('Gage returned and tables refreshed.');

    } catch (err) {
        console.error('Error returning gage:', err);
        showError('Error marking gage as returned: ' + err.message);
    }
}

// Delete issue log
async function deleteIssueLog(issueId) {
    console.log('--- Inside deleteIssueLog function ---', issueId);
    if (!confirm('Are you sure you want to delete this issue log?')) {
         console.log('Delete issue log cancelled.');
        return;
    }

    try {
         console.log('Sending DELETE request to /api/issue-log/', issueId);
        const response = await fetch(`http://127.0.0.1:5005/api/issue-log/${issueId}`, {
            method: 'DELETE'
        });

        console.log('Delete issue log response status:', response.status);
        if (!response.ok) {
             const errorText = await response.text();
             console.error('Failed to delete issue log:', response.status, response.statusText, errorText);
            throw new Error('Failed to delete issue log');
        }

        showNotification('Issue log deleted successfully');
        await loadIssueLogs();
         console.log('Issue log deleted and table refreshed.');

    } catch (err) {
        console.error('Error deleting issue log:', err);
        showError('Error deleting issue log: ' + err.message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up Issue Log page loader and event listeners.');
    setupIssueLogPageLoader();

    // Setup add issue log button
    const addBtn = document.getElementById('addIssueLogBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            console.log('Add New Issue Log button clicked.');
             // Reset form and populate gage select options
             const addForm = document.getElementById('addIssueLogForm');
             if (addForm) addForm.reset();
             loadGageOptions('newGageId');

            const addModal = document.getElementById('addIssueLogModal');
             if (addModal) {
                addModal.style.display = 'block';
                 console.log('Add Issue Log modal shown.');
             } else {
                 console.error('Add Issue Log Modal element not found.');
             }
        });
    } else {
        console.error('Add New Issue Log button not found.');
    }

    // Setup form submissions
    const addForm = document.getElementById('addIssueLogForm');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
             console.log('Add Issue Log form submitted.');
            const formData = {
                gage_id: parseInt(document.getElementById('newGageId').value),
                issue_date: document.getElementById('newIssueDate').value,
                issued_from: document.getElementById('newIssuedFrom').value,
                issued_to: document.getElementById('newIssuedTo').value,
                handled_by: parseInt(document.getElementById('newHandledBy').value)
            };
             console.log('Add Issue Log FormData:', formData);
            await addIssueLog(formData);
            const addModal = document.getElementById('addIssueLogModal');
             if (addModal) addModal.style.display = 'none';
        });
    } else {
        console.error('Add Issue Log Form not found.');
    }

    const editForm = document.getElementById('editIssueLogForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
             console.log('Edit Issue Log form submitted.');
            const formData = {
                issue_id: parseInt(document.getElementById('editIssueId').value),
                gage_id: parseInt(document.getElementById('editGageId').value),
                issue_date: document.getElementById('editIssueDate').value,
                issued_from: document.getElementById('editIssuedFrom').value,
                issued_to: document.getElementById('editIssuedTo').value,
                handled_by: parseInt(document.getElementById('editHandledBy').value),
                return_date: document.getElementById('editReturnDate').value || null,
                returned_by: document.getElementById('editReturnedBy').value || null,
                condition_on_return: document.getElementById('editCondition').value || null
            };
            console.log('Edit Issue Log FormData:', formData);
            await updateIssueLog(formData);
        });
    } else {
        console.error('Edit Issue Log Form not found.');
    }

    // Setup edit and return button listeners using event delegation on the table body
     const issueLogTableBody = document.querySelector('#issue-log-table tbody');
     if (issueLogTableBody) {
         issueLogTableBody.addEventListener('click', async (e) => {
             const target = e.target.closest('button');
             if (!target) return;

             const issueId = target.dataset.issueId;
             if (!issueId) {
                 console.warn('Button clicked but no data-issue-id found.', target);
                 return;
             }

             if (target.classList.contains('edit-btn')) {
                 console.log('Edit button clicked for issue ID:', issueId);
                 editIssueLog(issueId);
             } else if (target.classList.contains('return-btn')) {
                  console.log('Return button clicked for issue ID:', issueId);
                 returnGage(issueId);
             } else if (target.classList.contains('delete-btn')) {
                  console.log('Delete button clicked for issue ID:', issueId);
                 deleteIssueLog(issueId);
             }
         });
         console.log('Event delegation listeners setup for #issue-log-table tbody.');

     } else {
         console.error('Issue log table tbody for event delegation not found.');
     }

     // Correcting loadGageOptions to populate the select in the Add Issue Log modal
     async function loadGageOptions(selectId) {
         console.log('--- Inside loadGageOptions function ---', selectId);
         try {
             console.log('Fetching gages for select options...');
             const response = await fetch('http://127.0.0.1:5005/api/gages');

             console.log('Fetch gages response status for options:', response.status);
             if (!response.ok) {
                  const errorText = await response.text();
                  console.error('Failed to fetch gages for options:', response.status, response.statusText, errorText);
                 throw new Error('Failed to fetch gages for options');
             }

             const gages = await response.json();
             console.log('Successfully fetched gages for options:', gages);

             const selectElement = document.getElementById(selectId);
             if (!selectElement) {
                 console.error(`Select element with ID ${selectId} not found.`);
                 return;
             }

             selectElement.innerHTML = gages
                 .filter(gage => gage.status === 'Active')
                 .map(gage => `<option value="${gage.gage_id}">${gage.gage_id} - ${gage.name}</option>`)
                 .join('');
             console.log('Gage select options populated.');

         } catch (err) {
             console.error('Error loading gage options:', err);
             showError('Error loading gage options: ' + err.message);
         }
     }

});

// Make functions available globally if they are called from onclick attributes in HTML
// It's better to use event delegation where possible, but if onclick is used, expose the function.
window.editIssueLog = editIssueLog;
window.returnGage = returnGage;
window.deleteIssueLog = deleteIssueLog; 