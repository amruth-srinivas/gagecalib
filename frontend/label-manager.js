document.addEventListener('DOMContentLoaded', () => {
    console.log('Label Manager script loaded.');

    const selectGageElement = document.getElementById('selectGage');
    const templateItems = document.querySelectorAll('.template-item');
    const labelSizeSelect = document.getElementById('labelSize');
    const showStatusColorCheckbox = document.getElementById('showStatusColor');
    const labelPreviewDiv = document.getElementById('labelPreview');
    const templateSelectionMessage = document.getElementById('templateSelectionMessage');
    const initialSelectionMessage = document.getElementById('initialSelectionMessage');

    const labelTemplateSidebar = document.querySelector('.label-template-sidebar');
    const labelSettingsPanel = document.querySelector('.label-settings-panel');
    const labelActionBar = document.querySelector('.label-action-bar');

    let selectedGageId = null;
    let selectedTemplate = null;
    let selectedLabelSize = '1x1'; // Default size
    let latestCalibration = null;

    // Initial state: only the gage select dropdown is fully visible/interactive.
    // Other sections are hidden or partially visible.
    function setInitialState() {
         console.log('Setting initial state for Label Manager.');
         if (labelTemplateSidebar) labelTemplateSidebar.classList.add('hidden');
         // Settings panel: only gage select visible initially
         if (labelSettingsPanel) {
              labelSettingsPanel.classList.remove('hidden'); // Ensure panel is not fully hidden
              labelSettingsPanel.classList.add('partially-visible-settings'); // Use a new class for partial visibility
         }
         if (labelActionBar) labelActionBar.classList.add('hidden');
         if (labelPreviewDiv) {
             labelPreviewDiv.classList.add('hidden');
             labelPreviewDiv.style.border = 'none'; // No border when hidden
         }
         if (initialSelectionMessage) initialSelectionMessage.style.display = 'block';
         if (templateSelectionMessage) templateSelectionMessage.style.display = 'none'; // Keep this hidden initially
    }

    // Fetch gages and populate the dropdown
    async function fetchAndPopulateGages() {
        try {
            console.log('Fetching gages...');
            const response = await fetch('http://127.0.0.1:5005/api/gages');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const gages = await response.json();
            console.log('Gages fetched:', gages);

            if (selectGageElement) {
                // Clear existing options except the default one
                selectGageElement.innerHTML = '<option value="">-- Select a Gage --</option>';
                gages.forEach(gage => {
                    const option = document.createElement('option');
                    option.value = gage.gage_id;
                    option.textContent = `${gage.gage_id} - ${gage.name}`;
                    selectGageElement.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error fetching gages:', error);
            // Display an error message in the dropdown or page
             if (selectGageElement) {
                 selectGageElement.innerHTML = '<option value="">-- Error loading gages --</option>';
                 selectGageElement.disabled = true;
             }
             showError('Could not load gages for label manager.');
        }
    }

    // Fetch latest calibration for a gage
    async function fetchLatestCalibration(gageId) {
        try {
            console.log(`Fetching latest calibration for Gage ID: ${gageId}`);
            // Assuming an endpoint exists to get calibrations by gage_id, ordered by date descending
            // If not, we might need to fetch all calibrations and find the latest one
            const response = await fetch(`http://127.0.0.1:5005/api/calibrations?gage_id=${gageId}&limit=1&order_by=calibration_date desc`);
            if (!response.ok) {
                 if (response.status === 404) {
                     console.log(`No calibration records found for Gage ID ${gageId}`);
                     return null;
                 } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                 }
            }
            const calibrations = await response.json();
            console.log('Calibration records fetched:', calibrations);
            return calibrations.length > 0 ? calibrations[0] : null;

        } catch (error) {
            console.error(`Error fetching calibration for gage ${gageId}:`, error);
            return null;
        }
    }

    // Render the label preview
    function renderLabelPreview() {
        console.log('Rendering label preview...', { selectedGageId, selectedTemplate, latestCalibration });
        if (!labelPreviewDiv) return;

        // Only render if a gage, template, and calibration data are selected/available
        if (selectedGageId && selectedTemplate && latestCalibration) {
            labelPreviewDiv.innerHTML = ''; // Clear previous content
            labelPreviewDiv.style.border = '1px dashed #ccc'; // Add border when content is shown
            if (initialSelectionMessage) initialSelectionMessage.style.display = 'none';
            labelPreviewDiv.classList.remove('hidden'); // Show the preview div

            // Display gage and calibration details
            const gageIdEl = document.createElement('p');
            // Find the gage name from the dropdown options
            const selectedGageOption = selectGageElement ? selectGageElement.options[selectGageElement.selectedIndex] : null;
            const gageName = selectedGageOption && selectedGageOption.textContent ? selectedGageOption.textContent.split(' - ')[1] : '';

            gageIdEl.textContent = `Equipment ID: ${selectedGageId}${gageName ? ' (' + gageName + ')' : ''}`;

            const calDateEl = document.createElement('p');
            calDateEl.textContent = `Cal: ${latestCalibration.calibration_date}`;

            const dueDateEl = document.createElement('p');
            dueDateEl.textContent = `Due: ${latestCalibration.next_due_date}`;

            labelPreviewDiv.appendChild(gageIdEl);
            labelPreviewDiv.appendChild(calDateEl);
            labelPreviewDiv.appendChild(dueDateEl);

            // Placeholder for logo (Gray rectangle 180x40 with Gage ID text)
            const logoPlaceholder = document.createElement('div');
            logoPlaceholder.style.cssText = `
                width: 180px;
                height: 40px;
                background-color: #ccc;
                color: #333;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-top: 10px;
                font-size: 0.9rem;
                font-weight: bold;
            `;
            logoPlaceholder.textContent = selectedGageId; // Display Gage ID on placeholder
            labelPreviewDiv.appendChild(logoPlaceholder);

            // Display status color/result if checkbox is checked
            if (showStatusColorCheckbox && showStatusColorCheckbox.checked && latestCalibration.calibration_result) {
                const statusEl = document.createElement('p');
                statusEl.textContent = `Status: ${latestCalibration.calibration_result}`;
                // Add some basic styling based on result (e.g., Pass/Fail)
                if (latestCalibration.calibration_result.toLowerCase() === 'pass') {
                    statusEl.style.color = 'green';
                } else if (latestCalibration.calibration_result.toLowerCase() === 'fail') {
                    statusEl.style.color = 'red';
                }
                labelPreviewDiv.appendChild(statusEl);
            }

        } else if (selectedGageId && selectedTemplate && !latestCalibration) {
            // Show message if gage and template selected but no calibration data
            const noCalMessage = document.createElement('p');
            noCalMessage.textContent = 'No calibration data found for this gage.';
            noCalMessage.style.color = 'orange';
            labelPreviewDiv.innerHTML = ''; // Clear any previous content
            labelPreviewDiv.appendChild(noCalMessage);
            labelPreviewDiv.style.border = '1px dashed #ccc'; // Show border even without full content
            labelPreviewDiv.classList.remove('hidden'); // Show the preview div
            if (initialSelectionMessage) initialSelectionMessage.style.display = 'none';

        } else {
            // If gage or template not selected, hide preview and show initial message
            labelPreviewDiv.classList.add('hidden');
            labelPreviewDiv.style.border = 'none';
            if (initialSelectionMessage) initialSelectionMessage.style.display = 'block';
        }
    }

    // Update preview size based on selection
    function updatePreviewSize() {
         console.log('Updating preview size to:', selectedLabelSize);
        if (labelPreviewDiv) {
            // Map size values to actual dimensions (example dimensions)
            const sizes = {
                '2x2': { width: '200px', height: '200px' },
                '3x2': { width: '300px', height: '200px' },
                '1x1': { width: '100px', height: '100px' },
            };
            const size = sizes[selectedLabelSize] || sizes['1x1']; // Default to 1x1 if size not found
            labelPreviewDiv.style.width = size.width;
            labelPreviewDiv.style.height = size.height;
            labelPreviewDiv.style.border = selectedGageId ? '1px dashed #ccc' : 'none'; // Maintain border visibility
        }
         // Re-render preview to adjust content layout if needed
         renderLabelPreview();
    }

    // Event Listeners

    // Gage selection listener
    if (selectGageElement) {
        selectGageElement.addEventListener('change', async (event) => {
            selectedGageId = event.target.value;
            console.log('Gage selected:', selectedGageId);
            latestCalibration = null; // Clear previous calibration data
            if (selectedGageId) {
                latestCalibration = await fetchLatestCalibration(selectedGageId);
                console.log('Latest calibration for selected gage:', latestCalibration);
            }
             // After fetching calibration, update section visibility and render preview
             updateSectionVisibility();
             renderLabelPreview(); // Always attempt to render/update message
        });
    }

    // Template selection listener
    templateItems.forEach(item => {
        item.addEventListener('click', (event) => {
            // Remove active class from all template items
            templateItems.forEach(i => i.classList.remove('active'));

            // Add active class to the clicked item
            event.target.classList.add('active');

            selectedTemplate = event.target.getAttribute('data-template');
            console.log('Template selected:', selectedTemplate);
            // Update section visibility and render preview
             updateSectionVisibility();
             renderLabelPreview();
        });
    });

    // Label size selection listener
    if (labelSizeSelect) {
        labelSizeSelect.addEventListener('change', (event) => {
            selectedLabelSize = event.target.value;
            updatePreviewSize(); // Update the size of the preview area
        });
    }

    // Show Status Color checkbox listener
    if (showStatusColorCheckbox) {
        showStatusColorCheckbox.addEventListener('change', () => {
            console.log('Show Status Color checkbox changed. Checked:', showStatusColorCheckbox.checked);
            // Only re-render if a gage and template are already selected
            if (selectedGageId && selectedTemplate) {
                renderLabelPreview(); // Re-render to show/hide status
            }
        });
    }

    // Initial load
    fetchAndPopulateGages();
    setInitialState(); // Set the initial visibility state

    // Function to update the visibility of sections
    function updateSectionVisibility() {
        // Sections are shown if BOTH a gage and a template are selected
        const showSections = selectedGageId && selectedTemplate;
        console.log('Updating section visibility. Show sections:', showSections);

        if (labelTemplateSidebar) {
            // Sidebar is always visible once a gage is selected
            labelTemplateSidebar.classList.toggle('hidden', !selectedGageId);
        }
        if (labelSettingsPanel) {
            const settingFormGroups = labelSettingsPanel.querySelectorAll('.form-group');
            settingFormGroups.forEach(group => {
                // Hide/show settings (except gage select) based on both gage and template being selected
                if (!group.querySelector('#selectGage')) {
                    group.classList.toggle('hidden', !showSections);
                }
            });
             // Show settings panel partially if gage is selected but no template yet, or fully if both are selected
             labelSettingsPanel.classList.toggle('hidden', !selectedGageId && !showSections); // Fully hide if neither selected
             labelSettingsPanel.classList.toggle('partially-visible-settings', selectedGageId && !showSections); // Partially visible if gage selected but no template
        }
        if (labelActionBar) {
            labelActionBar.classList.toggle('hidden', !showSections);
        }
        if (labelPreviewDiv) {
             // Preview div visibility is handled by renderLabelPreview now
             // labelPreviewDiv.classList.toggle('hidden', !showSections);
             // labelPreviewDiv.style.border = showSections ? '1px dashed #ccc' : 'none';
        }
        if (initialSelectionMessage) {
            // Initial message is shown if BOTH gage and template are NOT selected
             initialSelectionMessage.style.display = (selectedGageId || selectedTemplate) ? 'none' : 'block';
        }
    }

}); 