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

    // ENSURE THESE ARE DECLARED AT THE TOP LEVEL OF DOMContentLoaded
    const labelControls = document.querySelector('.label-controls');
    const templateList = document.querySelector('.template-list');
    const savedTemplatesList = document.getElementById('savedTemplatesList');

    let selectedGageId = null;
    let selectedTemplate = 'standard'; // Default template
    let selectedLabelSize = '2x2'; // Default size, matching HTML
    let latestCalibration = null;
    let uploadedLogo = null; // Store uploaded logo as DataURL
    let currentUserRole = 'user'; // Default to user role

    // Get Upload Logo and Print Preview buttons
    const uploadLogoBtn = document.getElementById('uploadLogoBtn');
    const printPreviewBtn = document.getElementById('printPreviewBtn');
    
    // Create a hidden file input for logo upload if it doesn't exist in the DOM
    let logoFileInput = document.getElementById('labelLogoInput');
    if (!logoFileInput) {
        logoFileInput = document.createElement('input');
        logoFileInput.type = 'file';
        logoFileInput.id = 'labelLogoInput';
        logoFileInput.accept = 'image/*';
        logoFileInput.style.display = 'none';
        document.body.appendChild(logoFileInput);
    }

    // Add JsBarcode library (moved to label-manager.html for proper loading)
    // const script = document.createElement('script');

    // document.head.appendChild(script);

    // Initial state: only the gage select dropdown is fully visible/interactive.
    // Other sections are hidden or partially visible.
    function setInitialState() {
        // Reset form elements with null checks
        const labelSize = document.getElementById('labelSize');
        
        // Initialize modal close button
        const closeModal = document.querySelector('.close-modal');
        if (closeModal) {
            closeModal.onclick = function() {
                document.getElementById('printPreviewModal').style.display = 'none';
            };
        }

        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('printPreviewModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        const smallFontBtn = document.querySelector('.font-size-btn[data-size="small"]');
        const otherFontBtns = document.querySelectorAll('.font-size-btn:not([data-size="small"])');
        const labelPreview = document.getElementById('labelPreview');
        const initialMessage = document.getElementById('initialSelectionMessage');

        // Set default template
        if (templateList && document.querySelector('.template-item[data-template="standard"]')) { 
            document.querySelector('.template-item[data-template="standard"]').classList.add('active');
            selectedTemplate = 'standard';
        }

        // Reset label size dropdown to default
        if (labelSize) labelSize.value = '2x2';

        // Checkbox states should persist unless explicitly reset by user interaction, so we don't reset them here.

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
        // Base font sizes for different label sizes (adjusted for better fitting)
        const baseSizes = {
            '2x2': { min: 4, max: 12 }, 
            '3x2': { min: 6, max: 14 },
            '1x1': { min: 2, max: 5 }, // Very aggressive for 1x1
            '4x2': { min: 8, max: 18 },
            '4x6': { min: 10, max: 22 },
            '2x0.5': { min: 1, max: 4 }, // EXTREMELY aggressive for 2x0.5 - may be unreadable
            '3x1': { min: 3, max: 7 },
            '2x4': { min: 5, max: 12 },
            'custom': { min: 4, max: 12 }
        };

        const sizeRange = baseSizes[selectedLabelSize] || baseSizes['custom'];
        
        const availableWidth = containerWidth * 0.98; // Use almost full width
        const availableHeight = containerHeight * 0.98; // Use almost full height

        // Determine the number of visible content elements to distribute vertical space
        let visibleContentElements = 3; // Equipment ID, Cal, Due are always there
        if (document.getElementById('includeBarcode').checked) {
            visibleContentElements++; // Add 1 for barcode
        }
        visibleContentElements++; // Add 1 for logo area (always present or placeholder)
        if (document.getElementById('showStatusColor').checked && latestCalibration && latestCalibration.calibration_result) {
            visibleContentElements++; // Add 1 for status text
        }

        // Calculate target height for each *main* element to fit, ensuring some minimum space
        const effectiveVerticalItems = Math.max(1, visibleContentElements); // Ensure not dividing by zero
        const targetSpacePerItem = availableHeight / effectiveVerticalItems; 

        // Font size primarily based on target element height for vertical fit
        let fontSize = targetSpacePerItem * 0.55; // Adjusted heuristic for font height - more generous

        // Also consider width for very long text, prioritizing fitting horizontally
        if (textLength > 0) {
            const fontSizeByWidth = availableWidth / (textLength * 0.35); // Even more aggressive character width ratio
            fontSize = Math.min(fontSize, fontSizeByWidth);
        }
        
        // Clamp the font size within the allowed range
        fontSize = Math.max(sizeRange.min, Math.min(sizeRange.max, fontSize));
        
        return Math.floor(fontSize);
    }

    // Update the renderLabelPreview function
    function renderLabelPreview(labelWidth, labelHeight) {
        console.log('Rendering label preview...', { selectedGageId, selectedTemplate, latestCalibration, labelWidth, labelHeight });
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
            noCalMessage.style.fontSize = `${labelHeight * 0.1}px`; // Dynamic font size for message
            noCalMessage.style.textAlign = 'center';
            labelPreviewDiv.appendChild(noCalMessage);
            labelPreviewDiv.style.border = '1px dashed #ccc';
            labelPreviewDiv.classList.remove('hidden');
            return;
        }

        // Use passed dimensions for dynamic sizing
        const containerWidth = labelWidth;
        const containerHeight = labelHeight;

        // Use a flex column layout for stacking elements
        labelPreviewDiv.style.flexDirection = 'column';
        labelPreviewDiv.style.justifyContent = 'space-between'; // Distribute space evenly
        labelPreviewDiv.style.alignItems = 'center';
        labelPreviewDiv.style.padding = '0.5%'; // MINIMAL percentage padding for max content space

        // Calculate base font size for the entire label content
        const baseFontSize = calculateDynamicFontSize(
            containerWidth,
            containerHeight,
            // Use a combination of relevant text lengths for a better estimate
            (selectedGageId ? selectedGageId.length : 0) + 
            (document.getElementById('selectGage').options[document.getElementById('selectGage').selectedIndex].textContent.split(' - ')[1] || '').length + 
            (latestCalibration.calibration_date ? latestCalibration.calibration_date.length : 0) + 
            (latestCalibration.next_due_date ? latestCalibration.next_due_date.length : 0) 
        );

        // Function to create text elements with basic styling
        const createTextElement = (text, className = '') => {
            const p = document.createElement('p');
            p.textContent = text;
            p.style.margin = '0.1% 0'; // Minimal percentage margin
            p.style.padding = '0';
            p.style.textAlign = 'center';
            p.style.width = '100%'; // Occupy full width
            if (className) p.classList.add(className);
            // Apply dynamic font size based on baseFontSize
            p.style.fontSize = `${baseFontSize}px`;
            p.style.lineHeight = '1em'; // Even tighter line height
            p.style.wordWrap = 'break-word'; // Ensure long words break
            p.style.whiteSpace = 'normal'; // Ensure text wraps normally
            p.style.flexShrink = '0'; // Prevent text from shrinking too much
            return p;
        };

        // Render content based on selected template
        if (selectedTemplate === 'standard') {
            // Find the gage name from the dropdown options
            const selectedGageOption = document.getElementById('selectGage').options[document.getElementById('selectGage').selectedIndex];
            const gageName = selectedGageOption && selectedGageOption.textContent ? selectedGageOption.textContent.split(' - ')[1] : '';

            // Add text details
            labelPreviewDiv.appendChild(createTextElement(`Equipment ID: ${selectedGageId}${gageName ? ' (' + gageName + ')' : ''}`));

            // Add Status with color (re-implemented and checked for consistency)
            const showStatusColorCheckbox = document.getElementById('showStatusColor');
            console.log('DEBUG renderLabelPreview: showStatusColorCheckbox.checked =', showStatusColorCheckbox ? showStatusColorCheckbox.checked : 'element not found');

            if (showStatusColorCheckbox && showStatusColorCheckbox.checked && latestCalibration.calibration_result) {
                const statusText = `Status: ${latestCalibration.calibration_result.toUpperCase()}`;
                const statusEl = createTextElement(statusText, 'status-text');
                statusEl.style.fontWeight = 'bold';

                if (latestCalibration.calibration_result.toLowerCase() === 'pass') {
                    statusEl.style.color = 'green';
                } else if (latestCalibration.calibration_result.toLowerCase() === 'fail') {
                    statusEl.style.color = 'red';
                } else {
                    statusEl.style.color = '#333'; // Default color
                }
                labelPreviewDiv.appendChild(statusEl);
            }

            // Add barcode if enabled
            const includeBarcodeCheckbox = document.getElementById('includeBarcode');
            console.log('DEBUG renderLabelPreview: includeBarcodeCheckbox.checked =', includeBarcodeCheckbox ? includeBarcodeCheckbox.checked : 'element not found');

            if (includeBarcodeCheckbox && includeBarcodeCheckbox.checked && selectedGageId) {
                const barcodeContainer = document.createElement('div');
                barcodeContainer.classList.add('barcode-container');
                barcodeContainer.style.width = '100%';
                barcodeContainer.style.margin = '10px 0';
                barcodeContainer.style.textAlign = 'center';
                barcodeContainer.style.overflow = 'hidden';
                barcodeContainer.style.flexShrink = '0';
                barcodeContainer.style.minHeight = '80px';
                barcodeContainer.style.maxHeight = '200px';
                barcodeContainer.style.display = 'flex';
                barcodeContainer.style.justifyContent = 'center';
                barcodeContainer.style.alignItems = 'center';

                const qrCodeContainer = document.createElement('div');
                qrCodeContainer.id = 'qrCodeContainer';
                qrCodeContainer.style.width = '100%';
                qrCodeContainer.style.height = '100%';
                barcodeContainer.appendChild(qrCodeContainer);
                labelPreviewDiv.appendChild(barcodeContainer);

                // Generate QR code with a URL
                try {
                    const calibrationUrl = `http://127.0.0.1:5005/api/calibrations?gage_id=${selectedGageId}`;
                    console.log('Generating QR code for URL:', calibrationUrl);

                    // Get QR code size from template data or use default
                    const qrCodeSize = (selectedTemplate && selectedTemplate.qrCodeSize) || 100;
                    
                    // Create QR code instance with error correction level 'M' (15% error correction)
                    const qr = qrcode(0, 'M');
                    qr.addData(calibrationUrl);
                    qr.make();
                    
                    // Clear previous QR code
                    qrCodeContainer.innerHTML = '';
                    
                    // Set container size based on the QR code size
                    qrCodeContainer.style.width = `${qrCodeSize}px`;
                    qrCodeContainer.style.height = `${qrCodeSize}px`;
                    
                    // Create QR code as SVG for better quality
                    const qrSvg = qr.createSvgTag({
                        cellSize: 0, // Auto-calculate based on size
                        margin: 1,
                        scalable: true
                    });
                    
                    // Set SVG size and viewBox for responsiveness
                    const svgDoc = new DOMParser().parseFromString(qrSvg, 'image/svg+xml');
                    const svgElement = svgDoc.documentElement;
                    svgElement.setAttribute('width', '100%');
                    svgElement.setAttribute('height', '100%');
                    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                    
                    // Add the QR code to the container
                    qrCodeContainer.appendChild(document.importNode(svgElement, true));

                } catch (error) {
                    console.error('Error generating QR code:', error);
                    const errorMessage = document.createElement('p');
                    errorMessage.textContent = 'Failed to generate QR code: ' + error.message;
                    errorMessage.style.color = 'red';
                    errorMessage.style.fontSize = '10px';
                    barcodeContainer.appendChild(errorMessage);
                }
            }

            labelPreviewDiv.appendChild(createTextElement(`Cal: ${latestCalibration.calibration_date}`));
            labelPreviewDiv.appendChild(createTextElement(`Due: ${latestCalibration.next_due_date}`));

            // Add Logo/Placeholder
            const logoContainer = document.createElement('div');
            logoContainer.classList.add('logo-area');
            logoContainer.style.flexShrink = '0'; // Prevent shrinking below content
            logoContainer.style.flexGrow = '0'; // Prevent growing beyond content
            logoContainer.style.minHeight = '10px'; // Minimum height for placeholder (adjusted)
            logoContainer.style.maxHeight = `${labelHeight * 0.10}px`; // Max height for logo container (adjusted for more space)
            logoContainer.style.margin = '0.1% 0'; // Consistent minimal margin
            logoContainer.style.display = 'flex'; // Use flex for internal centering
            logoContainer.style.justifyContent = 'center';
            logoContainer.style.alignItems = 'center';
            if (uploadedLogo) {
                const logoImg = document.createElement('img');
                logoImg.src = uploadedLogo;
                logoImg.style.maxWidth = '100%';
                logoImg.style.maxHeight = `100%`; // Fill logo container height
                logoImg.style.objectFit = 'contain';
                logoImg.style.display = 'block'; // Ensure it behaves as a block element for sizing
                logoContainer.appendChild(logoImg);
            } else {
                const logoPlaceholder = document.createElement('span');
                logoPlaceholder.textContent = 'Logo Area';
                logoPlaceholder.style.fontSize = `${baseFontSize * 0.7}px`; // Scale placeholder text (adjusted)
                logoContainer.appendChild(logoPlaceholder);
            }
            labelPreviewDiv.appendChild(logoContainer);

            // Remove Barcode Area Placeholder (if barcode is included, otherwise add it)
            const existingBarcodePlaceholder = labelPreviewDiv.querySelector('.barcode-area');
            if (existingBarcodePlaceholder) {
                existingBarcodePlaceholder.remove();
            }
            // Re-add barcode placeholder ONLY if barcode is NOT included
            if (includeBarcodeCheckbox && !includeBarcodeCheckbox.checked) {
                 const barcodePlaceholder = document.createElement('div');
                barcodePlaceholder.classList.add('barcode-area');
                 barcodePlaceholder.textContent = 'Barcode Area';
                barcodePlaceholder.style.fontSize = `${baseFontSize * 0.7}px`; // Scale placeholder text (adjusted)
                 labelPreviewDiv.appendChild(barcodePlaceholder);
            }

        } else if (selectedTemplate === 'external') {
            // External Vendor Label content
            labelPreviewDiv.appendChild(createTextElement(`Vendor ID: ${selectedGageId}`));
            labelPreviewDiv.appendChild(createTextElement(`Description: ${latestCalibration.description || 'N/A'}`));
            labelPreviewDiv.appendChild(createTextElement(`Last Calibrated: ${latestCalibration.calibration_date}`));

        } else if (selectedTemplate === 'compact') {
            // Compact Label content
            labelPreviewDiv.appendChild(createTextElement(`${selectedGageId}`));
            labelPreviewDiv.appendChild(createTextElement(`Cal: ${latestCalibration.calibration_date}`));
            labelPreviewDiv.appendChild(createTextElement(`Due: ${latestCalibration.next_due_date}`));
        }
    }

    // Update preview size based on selection
    function updatePreviewSize() {
        if (!labelPreviewDiv) return;

        const sizeMap = {
            '2x2': { width: 200, height: 200 },
            '3x2': { width: 300, height: 200 },
            '1x1': { width: 100, height: 100 },
            '4x2': { width: 400, height: 200 },
            '4x6': { width: 400, height: 600 },
            '2x0.5': { width: 200, height: 50 },
            '3x1': { width: 300, height: 100 },
            '2x4': { width: 200, height: 400 },
            'custom': { width: 250, height: 150 }
        };

        const dimensions = sizeMap[selectedLabelSize] || sizeMap['custom'];

        labelPreviewDiv.style.width = `${dimensions.width}px`;
        labelPreviewDiv.style.height = `${dimensions.height}px`;

        // Pass the new dimensions directly to renderLabelPreview
        renderLabelPreview(dimensions.width, dimensions.height);
    }

    // Event Listeners

    // Save Template button
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', async () => {
            if (!selectedGageId) {
                alert('Please select a gage first');
                return;
            }

            try {
                // Calculate QR code size based on label size
                const qrSizeMap = {
                    '1x1': 80,
                    '1.5x1': 100,
                    '2x1': 120,
                    '2x2': 150
                };
                const qrSize = qrSizeMap[selectedLabelSize] || 100;

                const response = await fetch('http://127.0.0.1:5005/api/label-templates/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        gageId: selectedGageId,
                        template: selectedTemplate,
                        labelSize: selectedLabelSize,
includeBarcode: document.getElementById('includeBarcode')?.checked || false,
                        showStatusColor: document.getElementById('showStatusColor')?.checked || false,
                        logo: uploadedLogo,
                        qrCodeSize: qrSize
                    })
                });

                if (response.ok) {
                    alert('Template saved successfully!');
                } else {
                    throw new Error('Failed to save template');
                }
            } catch (error) {
                console.error('Error saving template:', error);
                alert('Failed to save template. Please try again.');
            }
        });
    }

    // Initialize Print Preview button if it exists
    if (printPreviewBtn) {
        printPreviewBtn.addEventListener('click', () => {
            const modal = document.getElementById('printPreviewModal');
            if (modal) {
                modal.style.display = 'block';
            }
        });
    }

    // Close Preview button
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            const modal = document.getElementById('printPreviewModal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Export as PNG
    const exportPngBtn = document.getElementById('exportPngBtn');
    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', async () => {
            try {
                const imageData = await convertLabelToImage('png');
                downloadLabelImage(imageData, 'png');
            } catch (error) {
                console.error('Error exporting as PNG:', error);
                alert('Failed to export as PNG');
            }
        });
    }

    // Export as JPG
    const exportJpgBtn = document.getElementById('exportJpgBtn');
    if (exportJpgBtn) {
        exportJpgBtn.addEventListener('click', async () => {
            try {
                const imageData = await convertLabelToImage('jpeg');
                downloadLabelImage(imageData, 'jpeg');
            } catch (error) {
                console.error('Error exporting as JPG:', error);
                alert('Failed to export as JPG');
            }
        });
    }

    // Print directly
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Initialize Upload Logo button if it exists
    if (uploadLogoBtn && logoFileInput) {
        uploadLogoBtn.addEventListener('click', () => {
            logoFileInput.click();
        });

        logoFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                uploadedLogo = event.target.result;
                // Update the preview
                const logoPreview = document.createElement('img');
                logoPreview.src = uploadedLogo;
                logoPreview.className = 'logo-preview';
                
                // Remove existing logo preview if any
                const existingPreview = labelPreviewDiv.querySelector('.logo-preview');
                if (existingPreview) {
                    existingPreview.remove();
                }
                
                // Add new logo to preview
                if (labelPreviewDiv.firstChild) {
                    labelPreviewDiv.insertBefore(logoPreview, labelPreviewDiv.firstChild);
                } else {
                    labelPreviewDiv.appendChild(logoPreview);
                }
                
                // Re-render the label to include the logo
                renderLabelPreview();
            };
            reader.readAsDataURL(file);
        });
    }

    // Gage selection listener
    if (selectGageElement) {
        selectGageElement.addEventListener('change', async (event) => {
            selectedGageId = event.target.value;
            // Enable controls and template list only if a gage is selected
            if (selectedGageId) {
                console.log('DEBUG Gage Select: labelControls =', labelControls); // Debug log
                if (labelControls) { 
                    labelControls.style.opacity = '1';
                    labelControls.style.pointerEvents = 'auto';
                }
                console.log('DEBUG Gage Select: templateList =', templateList); // Debug log
                if (templateList) {
                    templateList.style.opacity = '1';
                    templateList.style.pointerEvents = 'auto';
                }
                latestCalibration = await fetchLatestCalibration(selectedGageId);
            } else {
                setInitialState(); // Reset if no gage selected
            }
            updatePreviewSize(); // Always render/update preview based on selection
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
             renderLabelPreview(labelPreviewDiv.clientWidth, labelPreviewDiv.clientHeight);
        });
    });

    // Label size selection listener
    if (labelSizeSelect) {
        labelSizeSelect.addEventListener('change', (event) => {
            selectedLabelSize = event.target.value; // Ensure this is updated
            updatePreviewSize();
        });
    }

    // Show Status Color checkbox listener
    if (showStatusColorCheckbox) {
        showStatusColorCheckbox.addEventListener('change', () => {
            console.log('Show Status Color checkbox changed. Checked:', showStatusColorCheckbox.checked);
            // Only re-render if a gage and template are already selected
            if (selectedGageId && selectedTemplate) {
                renderLabelPreview(labelPreviewDiv.clientWidth, labelPreviewDiv.clientHeight); // Re-render to show/hide status
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
                renderLabelPreview(labelPreviewDiv.clientWidth, labelPreviewDiv.clientHeight);
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
        const savedTemplatesList = document.getElementById('savedTemplatesList');
        const templateManagement = document.getElementById('templateManagement');

        if (currentUserRole === 'admin') {
            if (adminControls) adminControls.style.display = 'block';
            if (savedTemplatesList) savedTemplatesList.style.display = 'none';
        } else {
            if (adminControls) adminControls.style.display = 'none';
            if (savedTemplatesList) savedTemplatesList.style.display = 'block';
            // Show saved templates table for non-admin users
            displaySavedTemplatesTable();
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
                    // Show success dialog
                    const successDialog = document.createElement('div');
                    successDialog.className = 'success-dialog';
                    successDialog.innerHTML = `
                        <div class="dialog-content">
                            <h3>Success!</h3>
                            <p>Template "${templateName}" has been saved successfully.</p>
                            <button class="btn-close-dialog">OK</button>
                        </div>
                    `;
                    document.body.appendChild(successDialog);
                    
                    // Close button handler
                    successDialog.querySelector('.btn-close-dialog').addEventListener('click', () => {
                        document.body.removeChild(successDialog);
                    });
                    
                    // Close after 3 seconds if not closed manually
                    setTimeout(() => {
                        if (document.body.contains(successDialog)) {
                            document.body.removeChild(successDialog);
                        }
                    }, 3000);
                    
                    document.body.removeChild(modal);
                    await loadSavedTemplates();
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to save template');
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

        // Set QR code size if available
        if (template.template_data.qrCodeSize) {
            selectedTemplate = {
                ...selectedTemplate,
                qrCodeSize: template.template_data.qrCodeSize
            };
        }

        // Update preview
        updateLabelPreview();
    }

    // Initialize when the page loads
    async function initializeLabelManager() {
        await checkUserRole();
        await fetchAndPopulateGages();
        setInitialState();
        // ... rest of the existing initialization code ...
    }

    // Add function to check user role
    async function checkUserRole() {
        try {
            const response = await fetch('http://127.0.0.1:5005/api/users/me');
            if (response.ok) {
                const userData = await response.json();
                currentUserRole = userData.role;
                updateUIForUserRole();
            }
        } catch (error) {
            console.error('Error checking user role:', error);
        }
    }

    // Function to display saved templates table for non-admin users
    async function displaySavedTemplatesTable() {
        const savedTemplatesList = document.getElementById('savedTemplatesList');
        if (!savedTemplatesList) return;

        try {
            const response = await fetch('http://127.0.0.1:5005/api/label-templates');
            if (!response.ok) throw new Error('Failed to fetch templates');
            
            const templates = await response.json();
            
            // Create table HTML
            const tableHTML = `
                <table class="templates-table">
                    <thead>
                        <tr>
                            <th>Template Name</th>
                            <th>Created By</th>
                            <th>Last Updated</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${templates.map(template => `
                            <tr>
                                <td>${template.template_name}</td>
                                <td>${template.creator?.username || 'Unknown'}</td>
                                <td>${new Date(template.updated_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="action-btn btn-small" onclick="loadTemplate(${template.id})">Load</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            
            savedTemplatesList.innerHTML = tableHTML;
        } catch (error) {
            console.error('Error loading templates:', error);
            savedTemplatesList.innerHTML = '<p class="error-message">Failed to load templates</p>';
        }
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
        // savedTemplatesList is now globally defined within DOMContentLoaded
        console.log('DEBUG displaySavedTemplates: savedTemplatesList =', savedTemplatesList); // Debug log
        if (savedTemplatesList) {
            savedTemplatesList.innerHTML = '';
            if (templates.length === 0) {
                savedTemplatesList.innerHTML = '<p>No saved templates yet.</p>';
            return;
            }
            // ... rest of the existing function ...
        } else {
            console.error('savedTemplatesList element not found in displaySavedTemplates (Fallback error)');
        }
    }

    // Add event listener for barcode checkbox
    const includeBarcodeCheckbox = document.getElementById('includeBarcode');
    if (includeBarcodeCheckbox) {
        includeBarcodeCheckbox.addEventListener('change', renderLabelPreview);
    }

    // Ensure initial preview is rendered with default size
    updatePreviewSize();
    fetchAndPopulateGages();
    initializeLabelManager();
    checkUserRole();
    loadSavedTemplates();

    // Print Label Functionality
    window.printLabel = async () => {
        if (!selectedGageId || !selectedTemplate) {
            showNotification('Please select a gage and a template first.', 'warning');
            return;
        }

        try {
            // Ensure html2canvas is available
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas library not loaded');
            }

            // Temporarily adjust preview for printing
            labelPreviewDiv.style.border = 'none';

            // Get current dimensions
            const currentComputedStyle = window.getComputedStyle(labelPreviewDiv);
            const currentWidth = parseFloat(currentComputedStyle.width);
            const currentHeight = parseFloat(currentComputedStyle.height);

            // Re-render the label preview
            renderLabelPreview(currentWidth, currentHeight);

            // Wait a moment for the re-render to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(labelPreviewDiv, {
                scale: 3,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const printWindow = window.open('', '_blank');
            
            if (!printWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print Label</title>
                    <style>
                        body { 
                            font-family: sans-serif; 
                            text-align: center; 
                            margin: 20px; 
                            background: #f5f5f5;
                        }
                        img { 
                            max-width: 100%; 
                            height: auto; 
                            display: block; 
                            margin: 20px auto; 
                            border: 1px solid #ddd;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        .print-controls { 
                            margin: 20px 0;
                            display: flex;
                            justify-content: center;
                            gap: 10px;
                            flex-wrap: wrap;
                        }
                        .print-controls button { 
                            padding: 10px 20px; 
                            margin: 5px; 
                cursor: pointer;
                            border: 1px solid #ccc; 
                            border-radius: 5px; 
                            background-color: #fff;
                            transition: all 0.3s ease;
                        }
                        .print-controls button:hover { 
                            background-color: #f0f0f0;
                            transform: translateY(-1px);
                        }
                        .print-controls button:active { 
                            transform: translateY(1px);
                        }
                    </style>
                </head>
                <body>
                    <img id="printableImage" src="${imgData}" />
                    <div class="print-controls">
                        <button id="printBtn">Print</button>
                        <button id="downloadPngBtn">Download PNG</button>
                        <button id="downloadJpegBtn">Download JPEG</button>
                        <button id="closeBtn">Close</button>
                    </div>
                    <script>
                        document.getElementById('printBtn').onclick = () => window.print();
                        document.getElementById('closeBtn').onclick = () => window.close();
                        
                        document.getElementById('downloadPngBtn').onclick = () => {
                            const a = document.createElement('a');
                            a.href = '${imgData}';
                            a.download = 'gage_label_${selectedGageId}.png';
                            a.click();
                        };
                        
                        document.getElementById('downloadJpegBtn').onclick = () => {
                            const canvas = document.createElement('canvas');
                            const img = document.getElementById('printableImage');
                            canvas.width = img.naturalWidth;
                            canvas.height = img.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);
                            const a = document.createElement('a');
                            a.href = canvas.toDataURL('image/jpeg', 0.9);
                            a.download = 'gage_label_${selectedGageId}.jpeg';
                            a.click();
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();

        } catch (error) {
            console.error('Error generating print preview:', error);
            showNotification(error.message || 'Failed to generate print preview.', 'error');
        } finally {
            // Revert changes
            labelPreviewDiv.style.border = '1px dashed #ccc';
            updatePreviewSize();
        }
    };

    // Initial setup when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Populate gages on load
        fetchAndPopulateGages();

        // Set initial state based on default selection or no selection
        setInitialState();

        // Check user role for admin controls visibility
        checkUserRole();

        // Debugging button visibility
        const printPreviewBtn = document.querySelector('.label-action-bar .action-btn');
        const uploadLogoBtn = document.getElementById('uploadLogoBtn');
        const saveTemplateBtn = document.querySelector('.label-action-bar .btn-primary');
        const actionBar = document.querySelector('.label-action-bar');

        console.log('--- Button Visibility Debug ---');
        console.log('Action Bar Display Style:', actionBar ? window.getComputedStyle(actionBar).display : 'N/A');
        console.log('Action Bar Visibility Style:', actionBar ? window.getComputedStyle(actionBar).visibility : 'N/A');
        console.log('Action Bar offsetWidth:', actionBar ? actionBar.offsetWidth : 'N/A');
        console.log('Action Bar offsetHeight:', actionBar ? actionBar.offsetHeight : 'N/A');

        console.log('Print Preview Button offsetWidth:', printPreviewBtn ? printPreviewBtn.offsetWidth : 'N/A');
        console.log('Print Preview Button offsetHeight:', printPreviewBtn ? printPreviewBtn.offsetHeight : 'N/A');
        console.log('Upload Logo Button offsetWidth:', uploadLogoBtn ? uploadLogoBtn.offsetWidth : 'N/A');
        console.log('Upload Logo Button offsetHeight:', uploadLogoBtn ? uploadLogoBtn.offsetHeight : 'N/A');
        console.log('Save Template Button offsetWidth:', saveTemplateBtn ? saveTemplateBtn.offsetWidth : 'N/A');
        console.log('Save Template Button offsetHeight:', saveTemplateBtn ? saveTemplateBtn.offsetHeight : 'N/A');
        console.log('-------------------------------');
    });
}); 
