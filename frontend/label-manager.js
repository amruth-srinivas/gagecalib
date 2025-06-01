document.addEventListener('DOMContentLoaded', async () => {
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
    let selectedTemplate = 'standard'; // Default template
    let selectedLabelSize = '1x1'; // Default size
    let latestCalibration = null;
    let uploadedLogo = null; // Store uploaded logo as DataURL
    let currentUserRole = 'user'; // Default to user role

    // Get Upload Logo and Print Preview buttons
    const uploadLogoBtn = document.getElementById('uploadLogoBtn');
    const printPreviewBtn = document.querySelector('.action-btn[data-action="print-preview"]');
    const exportJpegBtn = document.querySelector('.action-btn[data-action="export-jpeg"]');

    // Create a hidden file input for logo upload
    let logoFileInput = document.createElement('input');
    logoFileInput.type = 'file';
    logoFileInput.accept = 'image/*';
    logoFileInput.style.display = 'none';
    document.body.appendChild(logoFileInput);

    // Initial state: only the gage select dropdown is fully visible/interactive.
    // Other sections are hidden or partially visible.
    function setInitialState() {
        // Reset form elements with null checks
        const labelSize = document.getElementById('labelSize');
        const includeBarcode = document.getElementById('includeBarcode');
        const showStatusColor = document.getElementById('showStatusColor');
        const smallFontBtn = document.querySelector('.font-size-btn[data-size="small"]');
        const otherFontBtns = document.querySelectorAll('.font-size-btn:not([data-size="small"])');
        const labelPreview = document.getElementById('labelPreview');
        const initialMessage = document.getElementById('initialSelectionMessage');
        const labelControls = document.querySelector('.label-controls');
        const templateList = document.querySelector('.template-list');
        const standardTemplate = document.querySelector('.template-item[data-template="standard"]');

        // Set default template
        if (standardTemplate) {
            standardTemplate.classList.add('active');
            selectedTemplate = 'standard';
        }

        // Reset form values if elements exist
        if (labelSize) labelSize.value = '2x2';
        if (includeBarcode) includeBarcode.checked = false;
        if (showStatusColor) showStatusColor.checked = false;

        // Reset font size buttons if they exist
        if (smallFontBtn) smallFontBtn.classList.add('active');
        if (otherFontBtns) {
            otherFontBtns.forEach(btn => btn.classList.remove('active'));
        }
        
        // Clear preview if it exists
        if (labelPreview) {
            labelPreview.innerHTML = '';
            labelPreview.style.display = 'none';
        }
        
        // Show initial message if it exists
        if (initialMessage) {
            initialMessage.style.display = 'block';
            initialMessage.textContent = 'Please select a gage to begin';
        }
        
        // Disable label controls if they exist
        if (labelControls) {
        labelControls.style.opacity = '0.5';
        labelControls.style.pointerEvents = 'none';
        }
        
        // Show template list but keep it disabled initially
        if (templateList) {
            templateList.style.display = 'block';
            templateList.style.opacity = '0.7';
            templateList.style.pointerEvents = 'none';
        }
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

            labelPreviewDiv.innerHTML = ''; // Clear previous content
            labelPreviewDiv.style.border = '1px dashed #ccc'; // Add border when content is shown
            if (initialSelectionMessage) initialSelectionMessage.style.display = 'none';
            labelPreviewDiv.classList.remove('hidden'); // Show the preview div
        labelPreviewDiv.style.display = 'flex'; // Ensure it's a flex container for centering

        // Show initial message if no gage or template selected
        if (!selectedGageId || !selectedTemplate) {
            labelPreviewDiv.classList.add('hidden');
            labelPreviewDiv.style.border = 'none';
            if (initialSelectionMessage) initialSelectionMessage.style.display = 'block';
            initialSelectionMessage.textContent = selectedGageId ? 'Please select a template to continue' : 'Please select a gage to begin';
            return;
        }

        // Check if latestCalibration is available
        if (!latestCalibration) {
            const noCalMessage = document.createElement('p');
            noCalMessage.textContent = 'No calibration data found for this gage.';
            noCalMessage.style.color = 'orange';
            noCalMessage.style.fontSize = '1.2rem'; // Adjust size as needed
            noCalMessage.style.textAlign = 'center';
            labelPreviewDiv.appendChild(noCalMessage);
            labelPreviewDiv.style.border = '1px dashed #ccc';
            labelPreviewDiv.classList.remove('hidden');
            return;
        }

        // Get container dimensions for dynamic sizing
            const containerWidth = labelPreviewDiv.clientWidth;
            const containerHeight = labelPreviewDiv.clientHeight;

        // Use a flex column layout for stacking elements
        labelPreviewDiv.style.flexDirection = 'column';
        labelPreviewDiv.style.justifyContent = 'center';
        labelPreviewDiv.style.alignItems = 'center';
        labelPreviewDiv.style.padding = '10px'; // Add some padding

        // Function to create text elements with basic styling
        const createTextElement = (text, className = '') => {
            const p = document.createElement('p');
            p.textContent = text;
            p.style.margin = '3px 0'; // Adjust spacing
            p.style.padding = '0';
            p.style.textAlign = 'center';
            p.style.width = '100%'; // Occupy full width
            if (className) p.classList.add(className);
            return p;
        };

        // Render content based on selected template
        if (selectedTemplate === 'standard') {
            // Find the gage name from the dropdown options
            const selectedGageOption = document.getElementById('selectGage').options[document.getElementById('selectGage').selectedIndex];
            const gageName = selectedGageOption && selectedGageOption.textContent ? selectedGageOption.textContent.split(' - ')[1] : '';

            // Add text details
            labelPreviewDiv.appendChild(createTextElement(`Equipment ID: ${selectedGageId}${gageName ? ' (' + gageName + ')' : ''}`));
            labelPreviewDiv.appendChild(createTextElement(`Cal: ${latestCalibration.calibration_date}`));
            labelPreviewDiv.appendChild(createTextElement(`Due: ${latestCalibration.next_due_date}`));

            // Add Logo/Placeholder
            if (uploadedLogo) {
                const logoImg = document.createElement('img');
                logoImg.src = uploadedLogo;
                logoImg.alt = 'Logo';
                 // Basic styling, adjust size dynamically if needed
                logoImg.style.cssText = `
                    max-width: 80%;
                    max-height: 30%;
                    object-fit: contain;
                    margin: 10px auto; // Center the image and add vertical margin
                `;
                labelPreviewDiv.appendChild(logoImg);
            } else {
                 // Placeholder if no logo uploaded
                const logoPlaceholder = document.createElement('div');
                logoPlaceholder.textContent = 'Logo Area';
                logoPlaceholder.style.cssText = `
                    width: 80%;
                    height: 30%;
                    background-color: #e0e0e0;
                    color: #555;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 10px auto;
                    font-size: 1rem;
                    border-radius: 5px;
                `;
                labelPreviewDiv.appendChild(logoPlaceholder);
            }

            // Add Status with color
            if (document.getElementById('showStatusColor').checked && latestCalibration.calibration_result) {
                const statusText = `Status: ${latestCalibration.calibration_result.toUpperCase()}`;
                const statusEl = createTextElement(statusText);
                statusEl.style.fontWeight = 'bold'; // Make status text bold

                // Set status color
                if (latestCalibration.calibration_result.toLowerCase() === 'pass') {
                    statusEl.style.color = 'green';
                } else if (latestCalibration.calibration_result.toLowerCase() === 'fail') {
                    statusEl.style.color = 'red';
                } else {
                    statusEl.style.color = '#333'; // Default color for other statuses
                }
                labelPreviewDiv.appendChild(statusEl);
            }

            // TODO: Add barcode rendering logic if includeBarcode is checked
            if (document.getElementById('includeBarcode').checked) {
                 // Placeholder for barcode
                 const barcodePlaceholder = document.createElement('div');
                 barcodePlaceholder.textContent = 'Barcode Area';
                  barcodePlaceholder.style.cssText = `
                    width: 80%;
                    height: 15%;
                    background-color: #e0e0e0;
                    color: #555;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 10px auto;
                    font-size: 1rem;
                    border-radius: 5px;
                `;
                 labelPreviewDiv.appendChild(barcodePlaceholder);
            }

        } else {
            // Handle other templates or a generic preview if needed
            labelPreviewDiv.appendChild(createTextElement(`Preview for ${selectedTemplate} template for Gage ID: ${selectedGageId}`));
            // You might add more specific rendering logic here for other templates
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
            labelPreviewDiv.style.border = selectedGageId ? '1px dashed #ccc' : 'none';

            // Adjust font sizes based on label size
            const fontSizeMap = {
                '2x2': { small: '12px', medium: '14px', large: '16px' },
                '3x2': { small: '14px', medium: '16px', large: '18px' },
                '1x1': { small: '8px', medium: '10px', large: '12px' },
                '4x2': { small: '16px', medium: '18px', large: '20px' },
                '4x6': { small: '18px', medium: '20px', large: '24px' },
                '2x0.5': { small: '8px', medium: '10px', large: '12px' },
                '3x1': { small: '10px', medium: '12px', large: '14px' },
                '2x4': { small: '12px', medium: '14px', large: '16px' },
                'custom': { small: '12px', medium: '14px', large: '16px' },
            };

            const fontSizes = fontSizeMap[selectedLabelSize] || fontSizeMap['custom'];
            const activeSize = document.querySelector('.font-size-btn.active').dataset.size;
            const fontSize = fontSizes[activeSize];

            // Update all text elements in the preview
            const textElements = labelPreviewDiv.querySelectorAll('p');
            textElements.forEach(element => {
                element.style.fontSize = fontSize;
                element.style.lineHeight = '1.2';
                element.style.margin = '2px 0';
            });

            // Adjust logo size
            const logoImg = labelPreviewDiv.querySelector('img');
            if (logoImg) {
                const logoSize = Math.min(parseInt(size.width) * 0.3, parseInt(size.height) * 0.3);
                logoImg.style.maxWidth = `${logoSize}px`;
                logoImg.style.maxHeight = `${logoSize}px`;
            }
        }
        // Re-render preview to adjust content layout
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
        const gageSelect = document.getElementById('selectGage');
        const templateList = document.querySelector('.template-list');
        const initialMessage = document.getElementById('initialSelectionMessage');
        const previewArea = document.getElementById('labelPreview');
        const labelControls = document.getElementById('labelControls');
        const templateManagement = document.getElementById('templateManagement');
        
        if (!labelControls) {
            console.warn('Label controls element not found');
            return;
        }
        
        if (gageSelect.value) {
            // Show template list when gage is selected
            templateList.style.display = 'block';
            templateList.style.opacity = '1';
            templateList.style.pointerEvents = 'auto';
            initialMessage.textContent = 'Please select a template to continue';
            initialMessage.style.display = 'block';
            previewArea.style.display = 'none';
            templateManagement.style.display = 'block';
            
            // Enable controls when gage is selected
            labelControls.style.opacity = '1';
            labelControls.style.pointerEvents = 'auto';
        } else {
            // Reset to initial state
            templateList.style.display = 'block';
            templateList.style.opacity = '0.7';
            templateList.style.pointerEvents = 'none';
            initialMessage.textContent = 'Please select a gage to begin';
            initialMessage.style.display = 'block';
            previewArea.style.display = 'none';
            templateManagement.style.display = 'none';
            labelControls.style.opacity = '0.5';
            labelControls.style.pointerEvents = 'none';
        }
    }

    // Update the template list display
    function updateTemplateList(templates) {
        const savedTemplatesList = document.getElementById('savedTemplatesList');
        if (!savedTemplatesList) return;

        savedTemplatesList.innerHTML = '';

        if (!templates || templates.length === 0) {
            const noTemplates = document.createElement('p');
            noTemplates.textContent = 'No saved templates found.';
            noTemplates.style.color = '#666';
            savedTemplatesList.appendChild(noTemplates);
            return;
        }

        // Create table for templates
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        `;

        // Add header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = ['Gage ID', 'Calibration Date', 'Actions'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.style.cssText = `
                padding: 8px;
                text-align: left;
                border-bottom: 2px solid #ddd;
                background-color: #f8f9fa;
            `;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Add template rows
        const tbody = document.createElement('tbody');
        templates.forEach(template => {
            const row = document.createElement('tr');
            row.style.cssText = `
                border-bottom: 1px solid #ddd;
                transition: background-color 0.2s;
            `;
            row.onmouseover = () => row.style.backgroundColor = '#f8f9fa';
            row.onmouseout = () => row.style.backgroundColor = 'white';

            // Gage ID cell
            const gageCell = document.createElement('td');
            gageCell.textContent = template.gage_id;
            gageCell.style.padding = '8px';
            row.appendChild(gageCell);

            // Calibration Date cell
            const calDateCell = document.createElement('td');
            calDateCell.textContent = template.calibration_date;
            calDateCell.style.padding = '8px';
            row.appendChild(calDateCell);

            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.style.padding = '8px';

            // Print button
            const printBtn = document.createElement('button');
            printBtn.textContent = 'Print Label';
            printBtn.className = 'action-btn';
            printBtn.style.cssText = `
                padding: 4px 8px;
                border-radius: 4px;
                border: 1px solid #007bff;
                background-color: white;
                color: #007bff;
                cursor: pointer;
                transition: all 0.2s;
            `;
            printBtn.onmouseover = () => {
                printBtn.style.backgroundColor = '#007bff';
                printBtn.style.color = 'white';
            };
            printBtn.onmouseout = () => {
                printBtn.style.backgroundColor = 'white';
                printBtn.style.color = '#007bff';
            };
            printBtn.onclick = () => printLabel(template);

            actionsCell.appendChild(printBtn);

            // Add delete button for admin users
            if (currentUserRole === 'admin') {
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '&times;';
                deleteBtn.className = 'delete-template-btn';
                deleteBtn.style.cssText = `
                    margin-left: 8px;
                    background: none;
                    border: none;
                    color: #dc3545;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0 5px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                `;
                deleteBtn.onmouseover = () => deleteBtn.style.opacity = '1';
                deleteBtn.onmouseout = () => deleteBtn.style.opacity = '0.7';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteTemplate(template.id);
                };
                actionsCell.appendChild(deleteBtn);
            }

            row.appendChild(actionsCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        savedTemplatesList.appendChild(table);
    }

    // Update UI based on user role
    function updateUIForUserRole() {
        const adminControls = document.getElementById('adminControls');
        const templateList = document.querySelector('.template-list');
        const labelControls = document.getElementById('labelControls');
        const templateManagement = document.getElementById('templateManagement');
        
        if (currentUserRole === 'admin') {
            if (adminControls) adminControls.style.display = 'block';
            if (templateList) {
                templateList.style.pointerEvents = 'auto';
                templateList.style.opacity = '1';
            }
            if (labelControls) {
                labelControls.style.opacity = '1';
                labelControls.style.pointerEvents = 'auto';
            }
            if (templateManagement) {
                templateManagement.style.display = 'block';
            }
        } else {
            // For non-admin users, only show saved templates
            if (adminControls) adminControls.style.display = 'none';
            if (templateList) templateList.style.display = 'none';
            if (labelControls) labelControls.style.display = 'none';
            if (templateManagement) {
                templateManagement.style.display = 'block';
                templateManagement.style.marginTop = '0';
                templateManagement.style.borderTop = 'none';
                templateManagement.style.paddingTop = '0';
            }
        }
    }

    // Add these functions for template management
    async function saveTemplate() {
        if (currentUserRole !== 'admin') {
            showNotification('Only administrators can save templates.', 'error');
            return;
        }

        const selectedGage = document.getElementById('selectGage').value;
        if (!selectedGage) {
            showNotification('Please select a gage first.', 'error');
            return;
        }

        // Create and show the save template modal
        const modal = document.createElement('div');
        modal.className = 'template-save-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Save Template';
        title.style.marginBottom = '20px';
        title.style.color = '#333';

        const form = document.createElement('form');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Enter template name';
        nameInput.required = true;
        nameInput.style.cssText = `
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ccc;
            font-size: 14px;
            width: 100%;
            box-sizing: border-box;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
        `;

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.className = 'action-btn btn-primary';
        saveButton.type = 'submit';
        saveButton.style.cssText = `
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
            background-color: #007bff;
            color: white;
            cursor: pointer;
        `;

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'action-btn';
        cancelButton.type = 'button';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            border-radius: 4px;
            border: 1px solid #ccc;
            background-color: white;
            cursor: pointer;
        `;
        cancelButton.onclick = () => document.body.removeChild(modal);

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);

        form.appendChild(nameInput);
        form.appendChild(buttonContainer);
        modalContent.appendChild(title);
        modalContent.appendChild(form);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();
            const templateName = nameInput.value.trim();
            if (!templateName) return;

            const templateData = {
                labelSize: document.getElementById('labelSize').value,
                fontSize: document.querySelector('.font-size-btn.active').dataset.size,
                includeBarcode: document.getElementById('includeBarcode').checked,
                showStatusColor: document.getElementById('showStatusColor').checked
            };

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('http://127.0.0.1:5005/api/label-templates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        gage_id: selectedGage,
                        template_name: templateName,
                        template_data: templateData
                    })
                });

                if (response.ok) {
                    showNotification('Template saved successfully!', 'success');
                    document.body.removeChild(modal);
                    await loadSavedTemplates();
                } else {
                    throw new Error('Failed to save template');
                }
            } catch (error) {
                console.error('Error saving template:', error);
                showNotification('Failed to save template. Please try again.', 'error');
            }
        };

        // Focus the input
        nameInput.focus();
    }

    // Show notification function
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#28a745';
                break;
            case 'error':
                notification.style.backgroundColor = '#dc3545';
                break;
            default:
                notification.style.backgroundColor = '#17a2b8';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    async function loadTemplates() {
        try {
            const selectedGage = document.getElementById('selectGage').value;
            if (!selectedGage) return;

            const response = await fetch(`http://127.0.0.1:5005/api/label-templates?gage_id=${selectedGage}`);
            if (response.ok) {
                const templates = await response.json();
                updateTemplateList(templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    async function loadTemplate(template) {
        // Update form fields with template data
        document.getElementById('labelSize').value = template.template_data.size;
        document.getElementById('includeBarcode').checked = template.template_data.includeBarcode;
        document.getElementById('showStatusColor').checked = template.template_data.showStatusColor;
        
        // Set font size
        const fontSizeBtn = document.querySelector(`.font-size-btn[data-size="${template.template_data.fontSize}"]`);
        if (fontSizeBtn) {
            document.querySelectorAll('.font-size-btn').forEach(btn => btn.classList.remove('active'));
            fontSizeBtn.classList.add('active');
        }

        // Update preview
        updateLabelPreview();
    }

    // Initialize when the page loads
    async function initializeLabelManager() {
        try {
            // Get token from localStorage
            const token = localStorage.getItem('authToken');
            console.log('Token found:', !!token);

            if (!token) {
                showNotification('Please log in to access the label manager', 'error');
                return;
            }

            // Check user role with token
            const response = await fetch('http://127.0.0.1:5005/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Auth response status:', response.status);

            if (response.ok) {
                const user = await response.json();
                console.log('User data:', user);
                currentUserRole = user.role;
                
                // Get all required elements
                const labelTemplateSidebar = document.querySelector('.label-template-sidebar');
                const labelSettingsPanel = document.querySelector('.label-settings-panel');
                const labelActionBar = document.querySelector('.label-action-bar');
                const adminControls = document.getElementById('adminControls');
                const templateManagement = document.getElementById('templateManagement');

                // Update UI based on role
                if (currentUserRole === 'admin') {
                    // Show admin interface
                    if (labelTemplateSidebar) labelTemplateSidebar.style.display = 'block';
                    if (labelSettingsPanel) labelSettingsPanel.style.display = 'block';
                    if (labelActionBar) labelActionBar.style.display = 'flex';
                    if (adminControls) adminControls.style.display = 'block';
                    if (templateManagement) templateManagement.style.display = 'block';
                } else {
                    // Show user interface - only saved templates
                    if (labelTemplateSidebar) labelTemplateSidebar.style.display = 'none';
                    if (labelSettingsPanel) labelSettingsPanel.style.display = 'none';
                    if (labelActionBar) labelActionBar.style.display = 'none';
                    if (adminControls) adminControls.style.display = 'none';
                    
                    // Ensure template management is visible and centered for non-admins
                    if (templateManagement) {
                        templateManagement.style.display = 'block'; // Explicitly show
                        templateManagement.style.width = '100%';
                        templateManagement.style.maxWidth = '800px';
                        templateManagement.style.margin = '20px auto';
                    }
                }
                
                // Wait for savedTemplatesList to be available before loading templates
                const savedTemplatesList = await waitForElement('savedTemplatesList');
                if (savedTemplatesList) {
                   await loadSavedTemplates();
                } else {
                    console.error('savedTemplatesList element not available after waiting.');
                    showNotification('Error loading templates: Required element not found.', 'error');
                }

            } else if (response.status === 401) {
                localStorage.removeItem('authToken');
                showNotification('Session expired. Please log in again.', 'error');
                window.location.href = 'pages/login.html';
            } else {
                showNotification('Authentication failed. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error initializing label manager:', error);
            showNotification('Error initializing label manager', 'error');
        }
    }

    // Helper function to wait for an element to exist
    function waitForElement(id, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.getElementById(id);
            if (element) {
                return resolve(element);
            }

            const observer = new MutationObserver(() => {
                const element = document.getElementById(id);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null); // Resolve with null if element not found within timeout
            }, timeout);
        });
    }

    // Load saved templates from backend
    async function loadSavedTemplates() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                showNotification('Please log in to view templates', 'error');
                return;
            }

            const response = await fetch('http://127.0.0.1:5005/api/label-templates', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const templates = await response.json();
                displaySavedTemplates(templates);
            } else if (response.status === 401) {
                localStorage.removeItem('authToken');
                showNotification('Session expired. Please log in again.', 'error');
                window.location.href = 'pages/login.html';
            } else {
                showNotification('Failed to load templates', 'error');
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            showNotification('Error loading saved templates', 'error');
        }
    }

    // Display saved templates in a table format
    function displaySavedTemplates(templates) {
        // Get savedTemplatesList inside this function to ensure it's available
        const savedTemplatesList = document.getElementById('savedTemplatesList');
        if (!savedTemplatesList) {
            console.error('savedTemplatesList element not found in displaySavedTemplates');
            return;
        }

        savedTemplatesList.innerHTML = '';

        if (!templates || templates.length === 0) {
            const noTemplates = document.createElement('p');
            noTemplates.textContent = 'No saved templates found.';
            noTemplates.style.color = '#666';
            savedTemplatesList.appendChild(noTemplates);
            return;
        }

        // Create table
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            background-color: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

        // Add header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = ['Gage ID', 'Template Name', 'Last Updated', 'Actions'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.style.cssText = `
                padding: 12px 15px;
                text-align: left;
                border-bottom: 2px solid #ddd;
                background-color: #f8f9fa;
                font-weight: 600;
                color: #333;
            `;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Add template rows
        const tbody = document.createElement('tbody');
        templates.forEach(template => {
            const row = document.createElement('tr');
            row.style.cssText = `
                border-bottom: 1px solid #eee;
                transition: background-color 0.2s;
            `;
            row.onmouseover = () => row.style.backgroundColor = '#f8f9fa';
            row.onmouseout = () => row.style.backgroundColor = 'white';

            // Gage ID cell
            const gageCell = document.createElement('td');
            gageCell.textContent = template.gage_id;
            gageCell.style.padding = '12px 15px';
            row.appendChild(gageCell);

            // Template Name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = template.template_name;
            nameCell.style.padding = '12px 15px';
            row.appendChild(nameCell);

            // Last Updated cell
            const dateCell = document.createElement('td');
            dateCell.textContent = new Date(template.updated_at).toLocaleDateString();
            dateCell.style.padding = '12px 15px';
            row.appendChild(dateCell);

            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.style.padding = '12px 15px';

            // Print button
            const printBtn = document.createElement('button');
            printBtn.textContent = 'Print Label';
            printBtn.className = 'action-btn';
            printBtn.style.cssText = `
                padding: 6px 12px;
                border-radius: 4px;
                border: 1px solid #007bff;
                background-color: white;
                color: #007bff;
                cursor: pointer;
                transition: all 0.2s;
            `;
            printBtn.onmouseover = () => {
                printBtn.style.backgroundColor = '#007bff';
                printBtn.style.color = 'white';
            };
            printBtn.onmouseout = () => {
                printBtn.style.backgroundColor = 'white';
                printBtn.style.color = '#007bff';
            };
            printBtn.onclick = () => printLabel(template);
            actionsCell.appendChild(printBtn);

            // Add delete button for admin users
            if (currentUserRole === 'admin') {
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '&times;';
                deleteBtn.className = 'delete-template-btn';
                deleteBtn.style.cssText = `
                    margin-left: 8px;
                    background: none;
                    border: none;
                    color: #dc3545;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0 5px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                `;
                deleteBtn.onmouseover = () => deleteBtn.style.opacity = '1';
                deleteBtn.onmouseout = () => deleteBtn.style.opacity = '0.7';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteTemplate(template.id);
                };
                actionsCell.appendChild(deleteBtn);
            }

            row.appendChild(actionsCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        savedTemplatesList.appendChild(table);
    }

    // Print label function
    async function printLabel(template) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                showNotification('Please log in to print labels', 'error');
                return;
            }

            const response = await fetch(`http://127.0.0.1:5005/api/calibrations?gage_id=${template.gage_id}&limit=1&order_by=calibration_date desc`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const calibrations = await response.json();
                if (calibrations && calibrations.length > 0) {
                    const latestCalibration = calibrations[0];
                    
                    // Create a print window
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                        <html>
                            <head>
                                <title>Print Label</title>
                                <style>
                                    body {
                                        margin: 0;
                                        padding: 20px;
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        min-height: 100vh;
                                    }
                                    .label-preview {
                                        border: 1px solid #ccc;
                                        padding: 10px;
                                        text-align: center;
                                        background-color: white;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="label-preview">
                                    <p>Equipment ID: ${template.gage_id}</p>
                                    <p>Calibration Date: ${latestCalibration.calibration_date}</p>
                                    <p>Next Due: ${latestCalibration.next_due_date}</p>
                                    <p>Status: ${latestCalibration.calibration_result}</p>
                                </div>
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                    
                    // Wait for content to load then print
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                } else {
                    showNotification('No calibration data found for this gage', 'error');
                }
            }
        } catch (error) {
            console.error('Error printing label:', error);
            showNotification('Failed to print label', 'error');
        }
    }

    // Delete template function (admin only)
    async function deleteTemplate(templateId) {
        if (currentUserRole !== 'admin') {
            showNotification('Only administrators can delete templates', 'error');
            return;
        }

        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                showNotification('Please log in to delete templates', 'error');
                return;
            }

            const response = await fetch(`http://127.0.0.1:5005/api/label-templates/${templateId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                showNotification('Template deleted successfully', 'success');
                await loadSavedTemplates();
            } else {
                throw new Error('Failed to delete template');
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            showNotification('Failed to delete template', 'error');
        }
    }

    // Initialize the label manager
    initializeLabelManager();
}); 