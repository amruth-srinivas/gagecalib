let calendar;
let calibrationData = []; // Store all calibration data
let gageMap = {};

document.addEventListener('DOMContentLoaded', async function() {
    await loadGageMap();
    calendar = initializeCalendar();
    await loadCalibrationData();
    setupEventListeners();
});

function setupEventListeners() {
    // Remove all detailsPanel logic
    // Only keep view toggle and form submission for calibrationDetailsForm if needed
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.target.dataset.view;
            showView(view);
        });
    });
}

function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) {
        console.error('Calendar element not found');
        return null;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        
        eventContent: function(arg) {
            // Show gage name (bold) and ID (smaller, lighter, with 'ID:')
            const gageId = arg.event.extendedProps.gageId || '';
            const gageName = gageMap[gageId] || '';
            return {
                html: `
                    <div class=\"fc-event-main-inner\" style=\"padding:2px 0;\">
                        <div style=\"font-weight:600;font-size:1em;line-height:1.2;\">${gageName}</div>
                        <div style=\"font-size:0.92em;opacity:0.85;\">ID: ${gageId}</div>
                    </div>
                `
            };
        },
        eventDidMount: function(info) {
            const status = info.event.extendedProps.status || 'scheduled';
            info.el.classList.add(`status-${status.toLowerCase()}`);
        },
        eventClick: function(info) {
            const eventId = info.event.id;
            // Find the calibration details using the original data structure
            const details = calibrationData.find(item => {
                // Check both possible ID fields
                const itemId = item.id?.toString();
                const calibrationId = item.calibration_id?.toString();
                const eventIdStr = eventId?.toString();
                
                return itemId === eventIdStr || calibrationId === eventIdStr;
            });

            if (!details) {
                console.error('No details found for event:', eventId);
                return;
            }

            // Create modal if it doesn't exist
            let modalContainer = document.getElementById('eventDetailsModal');
            if (!modalContainer) {
                modalContainer = document.createElement('div');
                modalContainer.id = 'eventDetailsModal';
                modalContainer.className = 'modal';
                modalContainer.setAttribute('tabindex', '-1');
                modalContainer.setAttribute('role', 'dialog');
                modalContainer.setAttribute('aria-hidden', 'true');
                
                modalContainer.innerHTML = `
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Calibration Details</h5>
                                <button type="button" class="close-btn" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="details-content"></div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary btn-sm" id="sendNotificationBtn">Send Email Notification</button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modalContainer);
            }

            // Update modal content with the original data structure
            const detailsContent = modalContainer.querySelector('.details-content');
            // Clear previous content
            detailsContent.innerHTML = '';
            
            // Iterate over all properties in the details object and display them
            // Exclude properties used internally or already handled (like id, calibration_id)
            const excludedKeys = ['id', 'calibration_id', 'next_calibration', 'inventory_item'];

            for (const key in details) {
                if (details.hasOwnProperty(key) && !excludedKeys.includes(key)) {
                    let label = key.replace(/_/g, ' '); // Replace underscores with spaces
                    label = label.charAt(0).toUpperCase() + label.slice(1); // Capitalize first letter
                    let value = details[key];

                    // Handle specific keys for better display names or formatting
                    if (key === 'gage_id' || key === 'inventory_item') {
                         label = 'Gage ID';
                         value = value || '';
                    } else if (key === 'next_due_date' || key === 'next_calibration') { // Explicitly include next_calibration
                         label = 'Next Due Date';
                         value = value || details.next_calibration || '';
                    } else if (key === 'status') {
                         value = getStatus(details); // Use the helper function for status
                    } else if (key === 'gage_id') {
                         label = 'Gage Name';
                         value = gageMap[value] || ''; // Get gage name from map
                    }

                    detailsContent.innerHTML += `
                        <div class="detail-row">
                            <span class="detail-label">${label}:</span>
                            <span class="detail-value">${value || ''}</span>
                        </div>
                    `;
                }
            }

            // Also explicitly add Gage Name if not already added via gage_id or inventory_item key
            // This covers cases where the key might be different or missing but gage_id/inventory_item exists
            const hasGageName = detailsContent.innerHTML.includes('Gage Name');
            if (!hasGageName && (details.gage_id || details.inventory_item)) {
                 detailsContent.innerHTML = `
                    <div class="detail-row">
                        <span class="detail-label">Gage Name:</span>
                        <span class="detail-value">${gageMap[details.gage_id || details.inventory_item] || ''}</span>
                    </div>
                 ` + detailsContent.innerHTML; // Add Gage Name at the top
            }
             // Ensure Gage ID is shown if gage_id or inventory_item exists and is not already explicitly added
            const hasGageId = detailsContent.innerHTML.includes('Gage ID');
            if (!hasGageId && (details.gage_id || details.inventory_item)) {
                 detailsContent.innerHTML = `
                     <div class="detail-row">
                         <span class="detail-label">Gage ID:</span>
                         <span class="detail-value">${details.gage_id || details.inventory_item || ''}</span>
                     </div>
                 ` + detailsContent.innerHTML; // Add Gage ID at the top if missing
            }

            // Ensure Next Due Date is explicitly added if not already present
            const hasNextDueDate = detailsContent.innerHTML.includes('Next Due Date');
            if (!hasNextDueDate && (details.next_due_date || details.next_calibration)) {
                 detailsContent.innerHTML += `
                     <div class="detail-row">
                         <span class="detail-label">Next Due Date:</span>
                         <span class="detail-value">${details.next_due_date || details.next_calibration || ''}</span>
                     </div>
                 `; // Add Next Due Date at the end if missing
            }

            // Show modal
            modalContainer.style.display = 'flex'; // Use flex to center
            document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open

            // Add event listener for the Send Notification button in the footer
            const sendBtn = modalContainer.querySelector('#sendNotificationBtn');
            if (sendBtn) {
                // Pass the details to the function
                sendBtn.onclick = () => sendEmailNotification(details);
            }

            // Close modal handlers
            const closeModal = () => {
                modalContainer.style.display = 'none';
                document.body.style.overflow = ''; // Restore scrolling
            };

            // Add close handlers
            const closeButtons = modalContainer.querySelectorAll('.close-btn');
            closeButtons.forEach(btn => {
                btn.onclick = closeModal;
            });

            // Close on backdrop click
            modalContainer.onclick = (e) => {
                if (e.target === modalContainer) closeModal();
            };

            // Close on escape key
            const closeOnEscape = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', closeOnEscape);
                }
            };
            document.addEventListener('keydown', closeOnEscape);
        },
        events: function(info, successCallback, failureCallback) {
            if (calibrationData.length > 0) {
                const events = calibrationData.map(schedule => ({
                    id: schedule.id || schedule.calibration_id,
                    title: `Calibration: ${schedule.gage_id || schedule.inventory_item}`,
                    start: schedule.next_due_date || schedule.next_calibration,
                    className: getStatusClass(schedule),
                    extendedProps: {
                        gageId: schedule.gage_id || schedule.inventory_item,
                        type: schedule.calibration_type,
                        frequency: schedule.frequency_days,
                        remarks: schedule.remarks || '',
                        status: getStatus(schedule),
                        calibration_date: schedule.calibration_date,
                        calibrated_by: schedule.calibrated_by,
                        calibration_method: schedule.calibration_method,
                        calibration_result: schedule.calibration_result,
                        deviation_recorded: schedule.deviation_recorded,
                        certificate_number: schedule.certificate_number
                    }
                }));
                successCallback(events);
            } else {
                failureCallback(new Error('No calibration data available'));
            }
        }
    });

    // Add styles for event display
    const style = document.createElement('style');
    style.textContent = `
        .fc-event {
            border: none !important;
            border-radius: 6px !important;
            margin: 2px 0 !important;
            cursor: pointer !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease !important;
        }
        
        .fc-event:hover {
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
        }
        
        .status-scheduled {
            background-color: #fff3cd !important;
            border-left: 4px solid #ffc107 !important;
            color: #856404 !important;
        }
        
        .status-overdue {
            background-color: #f8d7da !important;
            border-left: 4px solid #dc3545 !important;
            color: #721c24 !important;
        }
        
        .status-completed {
            background-color: #d4edda !important;
            border-left: 4px solid #28a745 !important;
            color: #155724 !important;
        }

        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.6);
            z-index: 1050;
            justify-content: center; /* Center horizontally */
            align-items: center; /* Center vertically */
        }

        .modal-dialog {
            position: relative;
            width: auto;
            margin: 1.75rem auto;
            max-width: 500px;
            transform: none;
            transition: none;
        }

        .modal-content {
            position: relative;
            background-color: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            border: 1px solid rgba(0,0,0,0.08);
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.2rem 1.8rem;
            border-bottom: 1px solid #eee;
        }

        .modal-title {
            margin: 0;
            font-size: 1.4rem;
            color: #333;
            font-weight: 600;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 1.4rem; /* Smaller size for the x icon */
            line-height: 1;
            color: #dc3545; /* Red color */
            cursor: pointer;
            padding: 0.3rem; /* Smaller padding */
            transition: color 0.2s ease;
        }

        .close-btn:hover {
            color: #c82333; /* Darker red on hover */
        }

        .modal-body {
            padding: 1.5rem 1.8rem;
            max-height: calc(100vh - 200px); /* Adjusted height back as button moved to footer */
            overflow-y: auto;
            color: #444;
        }

        .modal-footer {
            display: flex; /* Show footer */
            justify-content: flex-end; /* Align button to the right */
            padding: 1rem 1.8rem;
            border-top: 1px solid #eee;
        }

        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 0.6rem 0;
            border-bottom: 1px dashed #eee;
            align-items: baseline;
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-label {
            font-weight: 600;
            color: #666;
            min-width: 160px;
            flex-shrink: 0;
        }

        .detail-value {
            color: #333;
            text-align: right;
            flex-grow: 1;
            margin-left: 1.5rem;
            word-break: break-word;
        }

        /* Button Styles */
        .btn {
            padding: 0.6rem 1.2rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
            border: 1px solid transparent;
        }

        .btn-primary {
            background-color: #007bff;
            color: white;
            border-color: #007bff;
        }

        .btn-primary:hover {
            background-color: #0056b3;
            border-color: #004085;
        }

        .btn-sm {
            padding: 0.25rem 0.5rem; /* Smaller padding */
            font-size: 0.875rem; /* Smaller font size */
            line-height: 1.5; /* Adjust line height */
            border-radius: 0.2rem; /* Smaller border radius */
        }
    `;
    document.head.appendChild(style);

    calendar.render();
    
    // Setup event listeners after calendar is initialized
    setupEventListeners();
    
    return calendar;
}

// Switch between calendar and table views
function showView(viewType) {
    console.log('Switching to view:', viewType); // Debug log
    
    // Get view containers
    const tableView = document.getElementById('tableView');
    const calendarView = document.getElementById('calendarView');
    
    if (!tableView || !calendarView) {
        console.error('View containers not found');
        return;
    }

    // Update toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        if (btn.dataset.view === viewType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Switch views
    if (viewType === 'calendar') {
        tableView.style.display = 'none';
        calendarView.style.display = 'block';
        
        // Force calendar refresh
        if (calendar) {
            setTimeout(() => {
                calendar.updateSize();
                calendar.refetchEvents();
            }, 100);
        }
    } else {
        calendarView.style.display = 'none';
        tableView.style.display = 'block';
    }
}

// Load calibration data from the backend
async function loadCalibrationData() {
    try {
        const response = await fetch('http://127.0.0.1:5005/api/calibrations');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        calibrationData = data;
        renderCalibrationTable(data);
        if (calendar) {
            calendar.refetchEvents();
        }
        return data;
    } catch (error) {
        showNotification('Failed to load calibration data', true);
        return [];
    }
}

// --- Filtering for Table View ---
function getCalibrationTableFilters() {
    return {
        gageId: document.getElementById('calibrationSearchGageId').value.trim().toLowerCase(),
        result: document.getElementById('calibrationSearchResult').value.trim().toLowerCase()
    };
}

function filterCalibrationTableData(data) {
    const filters = getCalibrationTableFilters();
    return data.filter(item => {
        let match = true;
        if (filters.gageId && !(item.gage_id || '').toString().toLowerCase().includes(filters.gageId)) match = false;
        if (filters.result && !(item.calibration_result || '').toLowerCase().includes(filters.result)) match = false;
        return match;
    });
}

function renderCalibrationTable(data) {
    const tbody = document.querySelector('#calibrationTable tbody');
    tbody.innerHTML = '';
    const filtered = filterCalibrationTableData(data);
    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.calibration_id}</td>
            <td>${item.gage_id}</td>
            <td>${item.calibration_date}</td>
            <td>${item.calibrated_by}</td>
            <td>${item.calibration_method}</td>
            <td>${item.calibration_result}</td>
            <td>${item.deviation_recorded}</td>
            <td>${item.certificate_number}</td>
            <td>${item.next_due_date}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-icon edit-btn" onclick="editCalibration(${item.calibration_id})"><i class="fas fa-edit"></i></button>
                    <button class="action-icon delete-btn" onclick="deleteCalibration(${item.calibration_id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

['calibrationSearchGageId', 'calibrationSearchResult'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => renderCalibrationTable(allCalibrationData));
});

// --- Filtering for Calendar View ---
function getCalendarFilters() {
    return {
        gageId: document.getElementById('calendarSearchGageId').value.trim().toLowerCase(),
        result: document.getElementById('calendarSearchResult').value.trim().toLowerCase()
    };
}

function filterCalendarEvents(events) {
    const filters = getCalendarFilters();
    return events.filter(event => {
        let match = true;
        if (filters.gageId && !(event.extendedProps.gageId || '').toString().toLowerCase().includes(filters.gageId)) match = false;
        if (filters.result && !(event.extendedProps.calibration_result || '').toLowerCase().includes(filters.result)) match = false;
        return match;
    });
}

// Delete a calibration schedule
async function deleteCalibration(id) {
    if (!confirm(`Are you sure you want to delete calibration schedule ${id}?`)) return;
    
    try {
        const response = await fetch(`http://127.0.0.1:5005/api/schedules/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Calibration schedule deleted successfully');
            loadCalibrationData(); // Refresh the data
        } else {
            throw new Error('Failed to delete calibration schedule');
        }
    } catch (error) {
        console.error('Error deleting calibration schedule:', error);
        showNotification('Error deleting calibration schedule', true);
    }
}

// Fetch calibration events from the backend for the calendar
async function fetchCalibrationEvents(info, successCallback, failureCallback) {
    try {
        // Use the stored calibrationData if already loaded
        if (calibrationData.length > 0) {
            const events = calibrationData.map(schedule => ({
                id: schedule.id,
                title: `Calibration: ${schedule.inventory_item}`,
                start: schedule.next_calibration,
                className: getStatusClass(schedule),
                extendedProps: {
                    gageId: schedule.inventory_item,
                    type: schedule.calibration_type,
                    frequency: schedule.frequency_days,
                    remarks: schedule.remarks || '',
                    status: getStatus(schedule)
                }
            }));
            
            successCallback(events);
            return;
        }
        
        // Otherwise fetch from API
        const start = info.startStr;
        const end = info.endStr;
        const response = await fetch(`http://127.0.0.1:5005/api/schedules?start_date=${start}&end_date=${end}`);
        
        if (!response.ok) throw new Error('Failed to fetch calibrations');
        
        const schedules = await response.json();
        calibrationData = schedules; // Store for later use
        
        const events = schedules.map(schedule => ({
            id: schedule.id,
            title: `Calibration: ${schedule.inventory_item}`,
            start: schedule.next_calibration,
            className: getStatusClass(schedule),
            extendedProps: {
                gageId: schedule.inventory_item,
                type: schedule.calibration_type,
                frequency: schedule.frequency_days,
                remarks: schedule.remarks || '',
                status: getStatus(schedule)
            }
        }));
        
        successCallback(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        failureCallback(error);
    }
}

// Create and show event details modal
function showEventDetails(details) {
    // Create modal container if it doesn't exist
    let modalContainer = document.getElementById('eventDetailsModal');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'eventDetailsModal';
        modalContainer.className = 'modal fade';
        modalContainer.setAttribute('tabindex', '-1');
        modalContainer.setAttribute('role', 'dialog');
        modalContainer.setAttribute('aria-hidden', 'true');
        
        modalContainer.innerHTML = `
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Calibration Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="details-content"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalContainer);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .modal-content {
                border-radius: 12px;
                border: none;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            }
            .modal-header {
                border-bottom: 2px solid #e2be2d;
                padding: 1rem 1.5rem;
            }
            .modal-title {
                color: #2c3e50;
                font-size: 1.3rem;
                font-weight: 600;
            }
            .modal-body {
                padding: 1.5rem;
            }
            .details-content {
                display: flex;
                flex-direction: column;
                gap: 0.8rem;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 0.5rem 0;
                border-bottom: 1px solid #f0f0f0;
            }
            .detail-label {
                font-weight: 600;
                color: #555;
                min-width: 140px;
            }
            .detail-value {
                color: #222;
                text-align: right;
                flex: 1;
                margin-left: 1rem;
            }
            .modal-footer {
                border-top: 1px solid #eee;
                padding: 1rem 1.5rem;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Update modal content
    const detailsContent = modalContainer.querySelector('.details-content');
    detailsContent.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Gage Name:</span>
            <span class="detail-value">${gageMap[details.gage_id || details.inventory_item] || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Gage ID:</span>
            <span class="detail-value">${details.gage_id || details.inventory_item || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Calibration Date:</span>
            <span class="detail-value">${details.calibration_date || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Calibrated By:</span>
            <span class="detail-value">${details.calibrated_by || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Calibration Method:</span>
            <span class="detail-value">${details.calibration_method || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Calibration Result:</span>
            <span class="detail-value">${details.calibration_result || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Deviation Recorded:</span>
            <span class="detail-value">${details.deviation_recorded || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Certificate Number:</span>
            <span class="detail-value">${details.certificate_number || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Next Due Date:</span>
            <span class="detail-value">${details.next_due_date || details.next_calibration || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Remarks:</span>
            <span class="detail-value">${details.remarks || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Frequency (Days):</span>
            <span class="detail-value">${details.frequency_days || ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${getStatus(details)}</span>
        </div>
    `;
    
    // Show modal using Bootstrap's modal API
    const modal = new bootstrap.Modal(modalContainer);
    modal.show();
}

// Add search filter functionality
function setupSearchFilters() {
    const searchInput = document.getElementById('searchInput');

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const searchTerm = this.value.toLowerCase();
            
            // Find the event matching the search term
            const events = calendar.getEvents();
            const matchedEvent = events.find(event => 
                event.extendedProps.gageId.toString().toLowerCase().includes(searchTerm)
            );

            if (matchedEvent) {
                // Go to the month of the matched event
                calendar.gotoDate(matchedEvent.start);
                
                // Highlight the event
                events.forEach(event => {
                    event.setProp('backgroundColor', event.originalColor || event._def.ui.backgroundColor);
                });
                matchedEvent.setProp('backgroundColor', '#ffeb3b');
                
                // Show details panel for the matched event
                handleEventClick({ event: matchedEvent });
            }
        }
    });
}

// Update notification button handler
document.getElementById('sendNotification')?.addEventListener('click', function() {
    const dialog = document.createElement('div');
    dialog.className = 'notification-dialog';
    dialog.innerHTML = `
        <div class="alert alert-success" role="alert">
            Email notification has been sent successfully!
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    setTimeout(() => {
        dialog.remove();
    }, 3000);
});

// Helper function for date calculations
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Load gage options for the dropdown
async function loadGageOptions() {
    try {
        const response = await fetch('http://127.0.0.1:5005/api/items');
        if (!response.ok) throw new Error('Failed to fetch gages');
        
        const gages = await response.json();
        const select = document.getElementById('newGageId');
        
        select.innerHTML = gages.map(gage => 
            `<option value="${gage.id}">${gage.item_code} - ${gage.description}</option>`
        ).join('');
    } catch (error) {
        console.error('Error loading gages:', error);
        showNotification('Failed to load gages', true);
    }
}

// Handle creating a new calibration
async function handleNewCalibration() {
    try {
        const formData = {
            inventory_item: parseInt(document.getElementById('newGageId').value),
            calibration_type: document.getElementById('newCalibrationType').value,
            frequency_days: parseInt(document.getElementById('newFrequency').value),
            next_calibration: new Date(document.getElementById('newScheduledDate').value).toISOString(),
            remarks: document.getElementById('newRemarks').value
        };
        
        const response = await fetch('http://127.0.0.1:5005/api/schedules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to create calibration');
        
        // Close modal and refresh calendar
        bootstrap.Modal.getInstance(document.getElementById('addCalibrationModal')).hide();
        document.getElementById('newCalibrationForm').reset();
        calendar.refetchEvents();
        showNotification('Calibration scheduled successfully');
    } catch (error) {
        console.error('Error creating calibration:', error);
        showNotification('Failed to create calibration', true);
    }
}

// Helper function to determine event status class
function getStatusClass(schedule) {
    const status = getStatus(schedule);
    switch (status) {
        case 'completed':
            return 'status-completed'; // green
        case 'overdue':
            return 'status-overdue'; // red
        case 'scheduled':
        default:
            return 'status-scheduled'; // light yellow
    }
}

// Helper function to determine event status
function getStatus(schedule) {
    const now = new Date();
    const nextCalibration = new Date(schedule.next_due_date || schedule.next_calibration);
    if (schedule.last_calibration) {
        const lastCalibration = new Date(schedule.last_calibration);
        if (lastCalibration > nextCalibration) return 'completed';
    }
    if (nextCalibration < now.setHours(0,0,0,0)) return 'overdue';
    return 'scheduled';
}

// Show notification
function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `alert ${isError ? 'alert-danger' : 'alert-success'} position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '1050';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Make initializeCalendar available globally
window.initializeCalendar = initializeCalendar;

async function fetchWithTimeout(url, options = {}) {
    const timeout = options.timeout || 5000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

function updatePanelStatus(status, date) {
    const detailsPanel = document.getElementById('detailsPanel');
    detailsPanel.classList.remove('status-warning', 'status-danger');

    const daysUntilDue = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));

    if (status === 'overdue' || daysUntilDue < 0) {
        detailsPanel.classList.add('status-danger');
    } else if (daysUntilDue <= 7) {
        detailsPanel.classList.add('status-warning');
    }
}

// Add event listener for notification button
document.getElementById('sendNotification')?.addEventListener('click', async function() {
    const gageId = document.getElementById('gageId').value;
    const scheduledDate = document.getElementById('scheduledDate').value;
    const status = document.getElementById('status').value;

    try {
        const response = await fetch('http://127.0.0.1:5005/api/notifications/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gageId,
                scheduledDate,
                status
            })
        });

        if (response.ok) {
            const statusEl = this.nextElementSibling;
            statusEl.textContent = 'Notification sent successfully!';
            statusEl.style.color = '#27ae60';
            
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);
        } else {
            throw new Error('Failed to send notification');
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        const statusEl = this.nextElementSibling;
        statusEl.textContent = 'Failed to send notification';
        statusEl.style.color = '#e74c3c';
    }
});

// Update close button handler
document.querySelector('.details-panel .close-btn')?.addEventListener('click', () => {
    const detailsPanel = document.getElementById('detailsPanel');
    if (detailsPanel) {
        detailsPanel.classList.remove('active');
    }
});

async function loadGageMap() {
    try {
        const response = await fetch('http://127.0.0.1:5005/api/gages');
        if (!response.ok) throw new Error('Failed to fetch gages');
        const gages = await response.json();
        gageMap = {};
        gages.forEach(g => {
            gageMap[g.gage_id || g.id || g.inventory_item] = g.name || g.description || '';
        });
    } catch (error) {
        console.error('Error loading gage map:', error);
        gageMap = {};
    }
}

// Add modal HTML if not present
if (!document.getElementById('calendarEventModal')) {
    const modal = document.createElement('div');
    modal.id = 'calendarEventModal';
    modal.className = 'calendar-modal';
    modal.innerHTML = `
        <div class="calendar-modal-content">
            <span class="calendar-modal-close" id="calendarModalClose">&times;</span>
            <h3 id="calendarModalTitle">Schedule Details</h3>
            <div id="calendarModalBody"></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add modal styles
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
        .calendar-modal {
            display: none;
            position: fixed;
            z-index: 3000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        .calendar-modal-content {
            background: #fff;
            border-radius: 14px;
            max-width: 480px;
            width: 96vw;
            margin: 60px auto;
            padding: 2rem 2.5rem 1.5rem 2.5rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            position: relative;
            transform: translateY(0);
            transition: transform 0.3s ease;
        }
        .calendar-modal-close {
            position: absolute;
            top: 1.2rem;
            right: 1.5rem;
            font-size: 2rem;
            color: #888;
            cursor: pointer;
            transition: color 0.2s;
            font-weight: bold;
            line-height: 1;
        }
        .calendar-modal-close:hover {
            color: #222;
        }
        #calendarModalTitle {
            margin-bottom: 1.2rem;
            color: #2c3e50;
            font-size: 1.3rem;
            border-bottom: 2px solid #e2be2d;
            padding-bottom: 0.5rem;
        }
        .calendar-modal-details {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            font-size: 1.05rem;
            color: #222;
        }
        .calendar-modal-details b {
            color: #444;
            min-width: 120px;
            display: inline-block;
        }
    `;
    document.head.appendChild(modalStyle);
    
    // Setup modal close handlers
    const closeBtn = document.getElementById('calendarModalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('calendarEventModal');
            if (modal) {
                modal.style.opacity = '0';
                modal.style.visibility = 'hidden';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
        });
    }
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('calendarEventModal');
            if (modal && modal.style.display === 'flex') {
                modal.style.opacity = '0';
                modal.style.visibility = 'hidden';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
        }
    });
}

function showCalendarEventModal(details) {
    const modal = document.getElementById('calendarEventModal');
    const body = document.getElementById('calendarModalBody');
    if (!modal || !body) return;
    
    // Build details HTML
    body.innerHTML = `
        <div class="calendar-modal-details">
            <div><b>Gage Name:</b> ${gageMap[details.gage_id || details.inventory_item] || ''}</div>
            <div><b>Gage ID:</b> ${details.gage_id || details.inventory_item || ''}</div>
            <div><b>Calibration Date:</b> ${details.calibration_date || ''}</div>
            <div><b>Calibrated By:</b> ${details.calibrated_by || ''}</div>
            <div><b>Calibration Method:</b> ${details.calibration_method || ''}</div>
            <div><b>Calibration Result:</b> ${details.calibration_result || ''}</div>
            <div><b>Deviation Recorded:</b> ${details.deviation_recorded || ''}</div>
            <div><b>Certificate Number:</b> ${details.certificate_number || ''}</div>
            <div><b>Next Due Date:</b> ${details.next_due_date || details.next_calibration || ''}</div>
            <div><b>Remarks:</b> ${details.remarks || ''}</div>
            <div><b>Frequency (Days):</b> ${details.frequency_days || ''}</div>
            <div><b>Status:</b> ${getStatus(details)}</div>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
}

// Helper function to format dates
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Placeholder function for sending email - replace with actual implementation
function sendEmailNotification(details) {
    console.log('Sending email notification for:', details);
    // TODO: Implement actual email sending logic here
    showNotification('Email notification sent (placeholder)', false);
}