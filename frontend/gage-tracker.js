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

    // Removing MutationObserver as showPage will call this directly
    /*
    // Initial load if page is active
    if (issueLogPage.classList.contains('active') || issueLogPage.style.display === 'block') {
        console.log('Issue Log page is initially active, loading data...');
        loadIssueLogs();
    }

    // Setup mutation observer for visibility changes
    const observer = new MutationObserver((mutations) => {
        console.log('MutationObserver triggered.');
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                if (issueLogPage.classList.contains('active') || issueLogPage.style.display !== 'none') {
                    console.log('Issue Log page became active, loading data...');
                    loadIssueLogs();
                }
            }
        });
    });

    observer.observe(issueLogPage, {
        attributes: true,
        attributeFilter: ['class', 'style']
    });
     console.log('MutationObserver for #issue-log setup.');
    */
}

// Load issue logs from API
async function loadIssueLogs() {
    console.log('--- Inside loadIssueLogs function ---');
    try {
        console.log('Fetching issue logs from:', 'http://127.0.0.1:5005/api/issue-log');
        const response = await fetch('http://127.0.0.1:5005/api/issue-log');

        console.log('Fetch issue logs response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch issue logs:', response.status, response.statusText, errorText);
            throw new Error(`Failed to fetch issue logs: ${response.status} ${response.statusText}`);
        }

        allIssueLogs = await response.json();
        console.log('Successfully fetched and parsed issue logs:', allIssueLogs);

        updateIssueLogSummary(allIssueLogs);
        console.log('Updated issue log summary.');
        renderIssueLogTable(allIssueLogs);
        console.log('Rendered issue log table.');

    } catch (err) {
        console.error('Error in loadIssueLogs:', err);
        showError('Error loading issue logs: ' + err.message);
    }
}

// Update summary cards
function updateIssueLogSummary(logs) {
    console.log('--- Inside updateIssueLogSummary function ---');
    const totalGagesEl = document.getElementById('total-gages-count');
    const issuedOutEl = document.getElementById('issued-out-count');
    const returnedEl = document.getElementById('returned-count');

    if (totalGagesEl) totalGagesEl.textContent = logs.length;
    if (issuedOutEl) issuedOutEl.textContent = logs.filter(log => !log.return_date).length;
    if (returnedEl) returnedEl.textContent = logs.filter(log => log.return_date).length;
    console.log('Issue log summary updated.');
}

// Render issue log table
function renderIssueLogTable(logs) {
    console.log('--- Inside renderIssueLogTable function ---', logs);
    const tbody = document.querySelector('#issue-log-table tbody');
    if (!tbody) {
        console.error('Issue log table tbody not found.');
        return;
    }
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        console.log('No issue logs to render.');
        tbody.innerHTML = '<tr><td colspan="10">No issue logs found.</td></tr>';
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');

        // Determine status based on return_date
        let status = !log.return_date ? 'Issued' : 'Returned';
        // Further refine status based on expected_return if not returned
         if (status === 'Issued' && log.expected_return && new Date(log.expected_return) < new Date()) {
             status = 'Overdue';
         }

        tr.innerHTML = `
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
                    <button class="action-icon edit-btn" onclick="editIssueLog('${log.issue_id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!log.return_date ? `
                        <button class="action-icon return-btn" onclick="returnGage('${log.issue_id}')">
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                    <button class="action-icon delete-btn" onclick="deleteIssueLog('${log.issue_id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
     console.log(`${logs.length} issue log rows rendered.`);
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
        // You'll need to fetch the existing issue log data first
        const response = await fetch(`http://127.0.0.1:5005/api/issue-log/${issueId}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch issue log for return:', response.status, response.statusText, errorText);
            throw new Error('Failed to fetch issue log for return');
        }
        const issueLog = await response.json();
        console.log('Fetched issue log for return:', issueLog);

        // Now update the return_date, returned_by (assuming a default or logged-in user), and condition
        // For simplicity, let's just set return_date to now. In a real app, you'd get returned_by and condition from a form/modal.
        const updateData = {
            ...issueLog, // Keep existing data
            return_date: new Date().toISOString(), // Set current date/time
            returned_by: issueLog.handled_by, // Example: set returned_by to handled_by
            condition_on_return: "Good" // Example: set a default condition
        };

        const updateResponse = await fetch(`http://127.0.0.1:5005/api/issue-log/${issueId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        console.log('Return gage update response status:', updateResponse.status);
        if (!updateResponse.ok) {
             const errorText = await updateResponse.text();
             console.error('Failed to update issue log for return:', updateResponse.status, updateResponse.statusText, errorText);
            throw new Error('Failed to update issue log for return');
        }

        showNotification('Gage marked as returned successfully');
        await loadIssueLogs(); // Refresh the table
         console.log('Gage returned and table refreshed.');

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