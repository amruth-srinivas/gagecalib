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
    let uploadedLogo = null; // Store uploaded logo as DataURL

    // Get Upload Logo and Print Preview buttons
    const uploadLogoBtn = document.getElementById('uploadLogoBtn');
    const printPreviewBtn = document.querySelector('.label-action-bar .action-btn'); // First button is Print Preview

    // Create a hidden file input for logo upload
    let logoFileInput = document.createElement('input');
    logoFileInput.type = 'file';
    logoFileInput.accept = 'image/*';
    logoFileInput.style.display = 'none';
    document.body.appendChild(logoFileInput);

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

    // Add this function after the existing functions but before the event listeners
    function calculateDynamicFontSize(containerWidth, containerHeight, textLength) {
        // Base font sizes for different label sizes
        const baseSizes = {
            '2x2': { min: 8, max: 24 },
            '3x2': { min: 10, max: 28 },
            '1x1': { min: 6, max: 16 },
            '4x2': { min: 12, max: 32 },
            '4x6': { min: 14, max: 36 },
            '2x0.5': { min: 6, max: 14 },
            '3x1': { min: 8, max: 20 },
            '2x4': { min: 10, max: 24 },
            'custom': { min: 8, max: 24 }
        };

        // Get the base size range for the current label size
        const sizeRange = baseSizes[selectedLabelSize] || baseSizes['custom'];
        
        // Calculate available space (considering padding and margins)
        const availableWidth = containerWidth * 0.9; // 90% of container width
        const availableHeight = containerHeight * 0.9; // 90% of container height
        
        // Calculate initial font size based on container dimensions
        let fontSize = Math.min(
            availableWidth / (textLength * 0.6), // Width-based calculation
            availableHeight / 2 // Height-based calculation
        );
        
        // Clamp the font size within the allowed range
        fontSize = Math.max(sizeRange.min, Math.min(sizeRange.max, fontSize));
        
        return Math.floor(fontSize);
    }

    // Update the renderLabelPreview function
    function renderLabelPreview() {
        console.log('Rendering label preview...', { selectedGageId, selectedTemplate, latestCalibration });
        if (!labelPreviewDiv) return;

        // Only render if a gage, template, and calibration data are selected/available
        if (selectedGageId && selectedTemplate && latestCalibration) {
            labelPreviewDiv.innerHTML = ''; // Clear previous content
            labelPreviewDiv.style.border = '1px dashed #ccc'; // Add border when content is shown
            if (initialSelectionMessage) initialSelectionMessage.style.display = 'none';
            labelPreviewDiv.classList.remove('hidden'); // Show the preview div

            // Get container dimensions
            const containerWidth = labelPreviewDiv.clientWidth;
            const containerHeight = labelPreviewDiv.clientHeight;

            // Create and style elements with dynamic font sizing
            const createStyledElement = (text, isTitle = false) => {
                const element = document.createElement('p');
                element.textContent = text;
                const fontSize = calculateDynamicFontSize(
                    containerWidth,
                    containerHeight / (isTitle ? 3 : 4),
                    text.length
                );
                element.style.fontSize = `${fontSize}px`;
                element.style.margin = '2px 0';
                element.style.textAlign = 'center';
                element.style.width = '100%';
                element.style.overflow = 'hidden';
                element.style.textOverflow = 'ellipsis';
                element.style.whiteSpace = 'nowrap';
                return element;
            };

            // Find the gage name from the dropdown options
            const selectedGageOption = selectGageElement ? selectGageElement.options[selectGageElement.selectedIndex] : null;
            const gageName = selectedGageOption && selectedGageOption.textContent ? selectedGageOption.textContent.split(' - ')[1] : '';

            // Add elements with dynamic sizing
            const gageIdEl = createStyledElement(`Equipment ID: ${selectedGageId}${gageName ? ' (' + gageName + ')' : ''}`, true);
            const calDateEl = createStyledElement(`Cal: ${latestCalibration.calibration_date}`);
            const dueDateEl = createStyledElement(`Due: ${latestCalibration.next_due_date}`);

            labelPreviewDiv.appendChild(gageIdEl);
            labelPreviewDiv.appendChild(calDateEl);
            labelPreviewDiv.appendChild(dueDateEl);

            // Logo handling with dynamic sizing
            if (uploadedLogo) {
                const logoImg = document.createElement('img');
                logoImg.src = uploadedLogo;
                logoImg.alt = 'Logo';
                const logoHeight = containerHeight * 0.2; // Logo takes 20% of container height
                logoImg.style.cssText = `
                    width: auto;
                    height: ${logoHeight}px;
                    object-fit: contain;
                    margin-top: 10px;
                `;
                labelPreviewDiv.appendChild(logoImg);
            } else {
                const logoPlaceholder = document.createElement('div');
                const fontSize = calculateDynamicFontSize(containerWidth, containerHeight * 0.2, selectedGageId.length);
                logoPlaceholder.style.cssText = `
                    width: 90%;
                    height: ${containerHeight * 0.2}px;
                    background-color: #ccc;
                    color: #333;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-top: 10px;
                    font-size: ${fontSize}px;
                    font-weight: bold;
                `;
                logoPlaceholder.textContent = selectedGageId;
                labelPreviewDiv.appendChild(logoPlaceholder);
            }

            // Status display with dynamic sizing
            if (showStatusColorCheckbox && showStatusColorCheckbox.checked && latestCalibration.calibration_result) {
                const statusEl = createStyledElement(`Status: ${latestCalibration.calibration_result}`);
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
            const fontSize = calculateDynamicFontSize(
                labelPreviewDiv.clientWidth,
                labelPreviewDiv.clientHeight,
                noCalMessage.textContent.length
            );
            noCalMessage.style.fontSize = `${fontSize}px`;
            labelPreviewDiv.innerHTML = '';
            labelPreviewDiv.appendChild(noCalMessage);
            labelPreviewDiv.style.border = '1px dashed #ccc';
            labelPreviewDiv.classList.remove('hidden');
            if (initialSelectionMessage) initialSelectionMessage.style.display = 'none';
        } else {
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
                '4x2': { width: '400px', height: '200px' },
                '4x6': { width: '400px', height: '600px' },
                '2x0.5': { width: '200px', height: '50px' },
                '3x1': { width: '300px', height: '100px' },
                '2x4': { width: '200px', height: '400px' },
                'custom': { width: '250px', height: '150px' },
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

    // Logo upload logic
    if (uploadLogoBtn) {
        uploadLogoBtn.addEventListener('click', () => {
            logoFileInput.click();
        });
    }
    logoFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedLogo = e.target.result;
                renderLabelPreview();
            };
            reader.readAsDataURL(file);
        }
    });

    // Add these functions before the event listeners
    async function convertLabelToImage(format = 'png') {
        if (!labelPreviewDiv || labelPreviewDiv.classList.contains('hidden')) {
            alert('Please select a gage and template to generate the label image.');
            return null;
        }

        try {
            // Create a clone of the preview div to avoid modifying the original
            const clone = labelPreviewDiv.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '-9999px';
            document.body.appendChild(clone);

            // Use html2canvas to convert the div to an image
            const canvas = await html2canvas(clone, {
                scale: 2, // Higher quality
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true // Enable CORS for images
            });

            // Remove the clone
            document.body.removeChild(clone);

            // Convert canvas to image
            const imageData = canvas.toDataURL(`image/${format}`, 1.0);
            return imageData;
        } catch (error) {
            console.error('Error converting label to image:', error);
            alert('Failed to generate label image. Please try again.');
            return null;
        }
    }

    function downloadLabelImage(imageData, format) {
        if (!imageData) return;

        // Create a temporary link element
        const link = document.createElement('a');
        link.download = `label_${selectedGageId}_${new Date().toISOString().slice(0,10)}.${format}`;
        link.href = imageData;
        link.click();
    }

    // Update the print preview button click handler
    if (printPreviewBtn) {
        printPreviewBtn.addEventListener('click', async () => {
            if (!labelPreviewDiv || labelPreviewDiv.classList.contains('hidden')) {
                alert('Please select a gage and template to preview the label.');
                return;
            }

            // Create a modal for preview and export options
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
            modal.style.zIndex = '1000';

            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            modalContent.style.backgroundColor = 'white';
            modalContent.style.padding = '20px';
            modalContent.style.borderRadius = '8px';
            modalContent.style.maxWidth = '90%';
            modalContent.style.maxHeight = '90%';
            modalContent.style.overflow = 'auto';

            // Clone the label preview
            const previewClone = labelPreviewDiv.cloneNode(true);
            previewClone.style.margin = '0 auto';
            previewClone.style.backgroundColor = 'white';
            previewClone.style.padding = '20px';

            // Add export buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.marginTop = '20px';
            buttonContainer.style.textAlign = 'center';
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'center';
            buttonContainer.style.gap = '10px';

            const exportPNG = document.createElement('button');
            exportPNG.textContent = 'Export as PNG';
            exportPNG.className = 'action-btn';
            exportPNG.onclick = async () => {
                const imageData = await convertLabelToImage('png');
                downloadLabelImage(imageData, 'png');
            };

            const exportJPG = document.createElement('button');
            exportJPG.textContent = 'Export as JPG';
            exportJPG.className = 'action-btn';
            exportJPG.onclick = async () => {
                const imageData = await convertLabelToImage('jpeg');
                downloadLabelImage(imageData, 'jpg');
            };

            const printButton = document.createElement('button');
            printButton.textContent = 'Print';
            printButton.className = 'action-btn';
            printButton.onclick = () => {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write('<html><head><title>Label Print Preview</title>');
                    printWindow.document.write('<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;} #labelPreview{border:1px dashed #ccc;}</style>');
                    printWindow.document.write('</head><body>');
                    printWindow.document.body.appendChild(previewClone);
                    printWindow.document.write('</body></html>');
                    printWindow.document.close();
                    setTimeout(() => {
                        printWindow.print();
                    }, 300);
                }
            };

            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.className = 'action-btn';
            closeButton.onclick = () => {
                document.body.removeChild(modal);
            };

            buttonContainer.appendChild(exportPNG);
            buttonContainer.appendChild(exportJPG);
            buttonContainer.appendChild(printButton);
            buttonContainer.appendChild(closeButton);

            modalContent.appendChild(previewClone);
            modalContent.appendChild(buttonContainer);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Close modal when clicking outside
            modal.onclick = (event) => {
                if (event.target === modal) {
                    document.body.removeChild(modal);
                }
            };
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