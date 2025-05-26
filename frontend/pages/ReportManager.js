// Initialize Report Manager
function initializeReportManager() {
    console.log('Initializing Report Manager...');
    
    // Check if already initialized
    if (window.reportManagerInitialized) {
        console.log('Report Manager already initialized');
        return;
    }
    
    // DOM Elements
    const calibrationReportGageIdInput = document.getElementById('calibrationReportGageIdInput');
    const generateCalibrationReportBtn = document.getElementById('generateCalibrationReportBtn');
    const usageLogGageIdInput = document.getElementById('usageLogGageIdInput');
    const generateUsageLogReportBtn = document.getElementById('generateUsageLogReportBtn');
    
    // Report Display Elements
    const reportDisplaySection = document.getElementById('reportDisplaySection');
    const reportGenerationSection = document.querySelector('.report-generation-section');
    const currentReportTitle = document.getElementById('currentReportTitle');
    const reportDate = document.getElementById('reportDate');
    const reportGageId = document.getElementById('reportGageId');
    const reportContent = document.getElementById('reportContent');
    const printReportBtn = document.getElementById('printReportBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const backToGenerationBtn = document.getElementById('backToGenerationBtn');
    const reportSettingsBtn = document.getElementById('reportSettingsBtn');
    
    // Settings Modal Elements
    const reportSettingsModal = document.getElementById('reportSettingsModal');
    const logoUpload = document.getElementById('logoUpload');
    const logoPreview = document.getElementById('logoPreview');
    const removeLogoBtn = document.getElementById('removeLogoBtn');
    const signaturePad = document.getElementById('signaturePad');
    const clearSignatureBtn = document.getElementById('clearSignatureBtn');
    const saveSignatureBtn = document.getElementById('saveSignatureBtn');
    const reportSettingsForm = document.getElementById('reportSettingsForm');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const closeSettingsModalBtn = reportSettingsModal ? reportSettingsModal.querySelector('.close-modal') : null;

    // Verify all required elements exist
    const requiredElements = {
        calibrationReportGageIdInput,
        generateCalibrationReportBtn,
        usageLogGageIdInput,
        generateUsageLogReportBtn,
        reportDisplaySection,
        reportGenerationSection,
        currentReportTitle,
        reportDate,
        reportGageId,
        reportContent,
        printReportBtn,
        downloadReportBtn,
        backToGenerationBtn,
        reportSettingsBtn
    };

    for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
            console.error(`Required element not found: ${name}`);
            // Depending on severity, you might want to disable parts of the UI
            // or show a user-friendly error message. For now, we just log.
        }
    }
    
    // Initialize Signature Pad
    let signaturePadInstance = null;
    if (signaturePad) {
        signaturePadInstance = new SignaturePad(signaturePad, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
    }
    
    // State variables
    let currentReportType = null;
    let currentReportData = null;
    let companyLogo = null;
    let digitalSignature = null;
    let reportHeader = '';
    let reportFooter = '';

    // Function to show report display section
    const showReportDisplay = (reportType, reportData) => {
        try {
            console.log('Attempting to show report display');
            if (!reportDisplaySection || !reportGenerationSection) {
                console.error('Report display or generation section not found');
                return;
            }

            currentReportType = reportType;
            currentReportData = reportData;

            // Update report title and meta
            if (currentReportTitle) currentReportTitle.textContent = `${reportType} Report`;
            if (reportDate) reportDate.textContent = `Generated: ${new Date().toLocaleDateString()}`;
            if (reportGageId) reportGageId.textContent = `Gage ID: ${reportData.gage_id}`;

            // Generate report content HTML
            let reportHtml = '';
            if (currentReportType === 'Calibration') {
                reportHtml = generateCalibrationReportHtml(currentReportData);
            } else if (currentReportType === 'Usage Log') {
                reportHtml = generateUsageLogReportHtml(currentReportData);
            } else {
                 reportHtml = '<p>Could not generate report HTML.</p>';
            }

            // Display combined content
            if (reportContent) {
                 reportContent.innerHTML = reportHtml; // Only display the core report HTML
            }

            // Show report display section
            reportGenerationSection.style.display = 'none';
            reportDisplaySection.style.display = 'block';

            // Scroll to the report display section
            reportDisplaySection.scrollIntoView({ behavior: 'smooth' });
            console.log('Report display shown successfully');
        } catch (error) {
            console.error('Error showing report display:', error);
            alert('Error displaying report. Please try again.');
        }
    };

    // Rename displayCalibrationReport to generateCalibrationReportHtml
    const generateCalibrationReportHtml = (reportData) => {
        console.log('Generating calibration report HTML in table format');
        let html = `<div class="report-container">
            <h3 class="report-title">Calibration Report for Gage ID: ${reportData.gage_id} - ${reportData.name}</h3>`;

        if (reportData.calibration_records.length === 0) {
            html += '<p>No calibration records found for this gage.</p>';
        } else {
            reportData.calibration_records.forEach(record => {
                html += `
                    <div class="report-card">
                        <h4 class="report-card-title">Calibration ID: ${record.calibration_id} (Date: ${record.calibration_date})</h4>
                        <div class="report-details-grid">
                            <div class="detail-item"><span class="detail-label">Calibrated By:</span> ${record.calibrated_by}</div>
                            <div class="detail-item"><span class="detail-label">Method:</span> ${record.calibration_method}</div>
                            <div class="detail-item"><span class="detail-label">Result:</span> ${record.calibration_result}</div>
                            <div class="detail-item"><span class="detail-label">Certificate Number:</span> ${record.certificate_number}</div>
                            <div class="detail-item"><span class="detail-label">Next Due:</span> ${record.next_due_date}</div>
                            <div class="detail-item full-width"><span class="detail-label">Comments:</span> ${record.comments || 'N/A'}</div>
                        </div>
                        <h5 class="measurements-title">Measurements:</h5>`;

                if (record.measurements.length === 0) {
                    html += '<p>No measurements recorded for this calibration.</p>';
                } else {
                    html += `
                        <table class="report-measurements-table">
                            <thead>
                                <tr>
                                    <th>Function Point</th>
                                    <th>Nominal Value</th>
                                    <th>+Tolerance</th>
                                    <th>-Tolerance</th>
                                    <th>Before</th>
                                    <th>After</th>
                                    <th>Master Gage ID</th>
                                    <th>Temperature</th>
                                    <th>Humidity</th>
                                </tr>
                            </thead>
                            <tbody>`;

                    record.measurements.forEach(measurement => {
                        html += `
                            <tr>
                                <td>${measurement.function_point}</td>
                                <td>${measurement.nominal_value}</td>
                                <td>${measurement.tolerance_plus}</td>
                                <td>${measurement.tolerance_minus}</td>
                                <td>${measurement.before_measurement}</td>
                                <td>${measurement.after_measurement}</td>
                                <td>${measurement.master_gage_id || 'N/A'}</td>
                                <td>${measurement.temperature}</td>
                                <td>${measurement.humidity}</td>
                            </tr>`;
                    });

                    html += `
                            </tbody>
                        </table>`;
                }

                html += `
                        <div class="report-details-grid mt-3">
                            <div class="detail-item"><span class="detail-label">Deviation Recorded:</span> ${record.deviation_recorded || 'N/A'}</div>
                            <div class="detail-item"><span class="detail-label">Adjustments Made:</span> ${record.adjustments_made ? 'Yes' : 'No'}</div>
                            <div class="detail-item full-width"><span class="detail-label">Document Path:</span> ${record.calibration_document_path || 'N/A'}</div>
                        </div>
                    </div>`;
            });
        }

        html += '</div>';
        return html; // Return the generated HTML
    };

    // Rename displayUsageLogReport to generateUsageLogReportHtml
    const generateUsageLogReportHtml = (reportData) => {
        console.log('Generating usage log report HTML');
        let html = `<div class="report-container">
            <h3 class="report-title">Usage Log Report for Gage ID: ${reportData.gage_id} - ${reportData.name}</h3>`;

        if (reportData.issue_logs.length === 0) {
            html += '<p>No issue logs found for this gage.</p>';
        } else {
            html += `
                <table class="report-usage-log-table">
                    <thead>
                        <tr>
                            <th>Issue ID</th>
                            <th>Issue Date</th>
                            <th>Issued From</th>
                            <th>Issued To</th>
                            <th>Handled By</th>
                            <th>Return Date</th>
                            <th>Returned By</th>
                            <th>Condition on Return</th>
                        </tr>
                    </thead>
                    <tbody>`;

            reportData.issue_logs.forEach(log => {
                html += `
                            <tr>
                                <td>${log.issue_id}</td>
                                <td>${new Date(log.issue_date).toLocaleString()}</td>
                                <td>${log.issued_from}</td>
                                <td>${log.issued_to}</td>
                                <td>${log.handled_by}</td>
                                <td>${log.return_date ? new Date(log.return_date).toLocaleString() : 'N/A'}</td>
                                <td>${log.returned_by || 'N/A'}</td>
                                <td>${log.condition_on_return || 'N/A'}</td>
                            </tr>`;
            });

            html += `
                    </tbody>
                </table>`;
        }

        html += '</div>';
        return html; // Return the generated HTML
    };

    // Function to show report generation section
    const showReportGeneration = () => {
        try {
            console.log('Attempting to show report generation section');
            if (!reportDisplaySection || !reportGenerationSection) {
                 console.error('Report display or generation section not found for generation view');
                 return;
            }
            reportDisplaySection.style.display = 'none';
            reportGenerationSection.style.display = 'grid';
            console.log('Report generation section shown successfully');
        } catch (error) {
            console.error('Error showing report generation section:', error);
            alert('Error returning to report generation. Please refresh the page.');
        }
    };

    // Function to handle logo upload
    const handleLogoUpload = (event) => {
        console.log('Logo upload triggered');
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                companyLogo = e.target.result;
                if (logoPreview) {
                    logoPreview.src = companyLogo;
                    logoPreview.style.display = 'block';
                    console.log('Logo preview updated');
                }
                if (removeLogoBtn) {
                    removeLogoBtn.style.display = 'block';
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // Function to handle signature pad
    const handleSignaturePad = () => {
        console.log('Saving signature');
        if (signaturePadInstance && !signaturePadInstance.isEmpty()) {
            digitalSignature = signaturePadInstance.toDataURL();
            console.log('Signature saved');
        } else {
            digitalSignature = null;
            console.log('Signature pad empty, no signature saved');
        }
    };

    // Function to clear signature pad
    const clearSignaturePad = () => {
        console.log('Clearing signature pad');
        if (signaturePadInstance) {
            signaturePadInstance.clear();
            digitalSignature = null;
            console.log('Signature pad cleared');
        }
    };

    // Function to save report settings
    const saveReportSettings = (event) => {
        event.preventDefault();
        console.log('Saving report settings');
        const reportHeaderInput = document.getElementById('reportHeader');
        const reportFooterInput = document.getElementById('reportFooter');

        if (reportHeaderInput) reportHeader = reportHeaderInput.value;
        if (reportFooterInput) reportFooter = reportFooterInput.value;

        if (reportSettingsModal) {
             reportSettingsModal.style.display = 'none';
             console.log('Report settings modal hidden');
        }
        
        // Update report display with new settings
        if (currentReportData) {
            console.log('Re-displaying report with new settings');
            showReportDisplay(currentReportType, currentReportData);
        }
    };

    // Function to print report
    const printReport = () => {
        console.log('Initiating print');

        // Get the raw report HTML based on the current report type and data
        let rawReportHtml = '';
        if (currentReportType === 'Calibration' && currentReportData) {
            rawReportHtml = generateCalibrationReportHtml(currentReportData);
        } else if (currentReportType === 'Usage Log' && currentReportData) {
            rawReportHtml = generateUsageLogReportHtml(currentReportData);
        } else {
            console.error('No report data available for printing.');
            alert('No report data to print.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            // Construct the full HTML document for printing
            let fullPrintHtml = '<!DOCTYPE html>\n<html>\n<head>\n    <title>Report</title>\n    <meta charset="UTF-8">\n';

            // Include a minimal set of essential styles directly
             fullPrintHtml += '<style>\n    body { padding: 20px; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; }\n    .report-logo-print, .report-header-print, .report-footer-print, .report-signature-print { text-align: center; margin-bottom: 20px; }\n    .report-footer-print { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10px; }\n    .report-signature-print { margin-top: 20px; }\n    /* Include other essential report-specific styles here */\n     .report-measurements-table, .report-usage-log-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }\n    .report-measurements-table th, .report-usage-log-table th { background-color: #e9ecef; text-align: left; padding: 10px; font-weight: 600; font-size: 0.9rem; border: 1px solid #dee2e6; }\n    .report-measurements-table td, .report-usage-log-table td { padding: 10px; border: 1px solid #dee2e6; font-size: 0.85rem; }\n    .report-measurements-table tbody tr:nth-child(even), .report-usage-log-table tbody tr:nth-child(even) { background-color: #f8f9fa; }\n    .report-measurements-table tbody tr:hover, .report-usage-log-table tbody tr:hover { background-color: #e9ecef; }\n    .report-container h3.report-title { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }\n    .report-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #f9f9f9; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03); }\n     .report-card-title { color: #3498db; margin-top: 0; margin-bottom: 15px; font-size: 1.2rem; border-bottom: 1px dashed #ccc; padding-bottom: 8px; }\n    .report-details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin-bottom: 15px; }\n    .detail-item { font-size: 0.95rem; color: #555; }\n    .detail-label { font-weight: 600; color: #333; margin-right: 5px; }\n    .detail-item.full-width { grid-column: 1 / -1; }\n    .measurements-title { color: #34495e; margin-top: 20px; margin-bottom: 10px; font-size: 1.1rem; }\n</style>\n';

            fullPrintHtml += '</head>\n<body>\n';

            // Add logo if exists
            if (companyLogo) {
                fullPrintHtml += `<div class="report-logo-print"><img src="${companyLogo}" alt="Company Logo" style="max-width: 200px;"></div>`;
            }

            // Add header if exists
            if (reportHeader) {
                fullPrintHtml += `<div class="report-header-print">${reportHeader}</div>`;
            }

            fullPrintHtml += rawReportHtml; // Add the main report content

            // Add footer if exists
            if (reportFooter) {
                fullPrintHtml += `<div class="report-footer-print">${reportFooter}</div>`;
            }

             // Add signature if exists
            if (digitalSignature) {
                fullPrintHtml += `<div class="report-signature-print"><img src="${digitalSignature}" alt="Digital Signature" style="max-width: 150px;"></div>`;
            }

            fullPrintHtml += '\n</body>\n</html>';

            // Write the constructed HTML to the new window
            printWindow.document.open();
            printWindow.document.write(fullPrintHtml);
            printWindow.document.close();

            // Add a small delay to ensure content is rendered before printing
            setTimeout(() => {
                printWindow.print();
                // printWindow.close(); // Consider closing after print
            }, 250);
            console.log('Print window opened and content written');
        } else {
             alert('Could not open print window. Please check your browser settings.');
             console.error('Failed to open print window');
        }
    };

    // Function to download report as PDF
    const downloadReportPdf = async () => {
        console.log('Initiating PDF download');
        try {
            const reportContentElement = document.getElementById('reportContent');
            if (!reportContentElement) {
                throw new Error('Report content element not found');
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            let yOffset = 10; // Initial y position

            // Add logo if exists
            if (companyLogo) {
                console.log('Adding logo to PDF');
                const logoHeight = 20; // px, adjust as needed
                const logoWidth = 40; // px, adjust as needed
                doc.addImage(companyLogo, 'PNG', 10, yOffset, logoWidth, logoHeight);
                yOffset += logoHeight + 10; // Move down after logo
            }

            // Add header if exists
            if (reportHeader) {
                console.log('Adding header to PDF');
                doc.setFontSize(16);
                doc.text(reportHeader, 105, yOffset + 5, { align: 'center' });
                 yOffset += 20; // Move down after header
            }

            // Use html2canvas to capture the report content
            console.log('Capturing report content with html2canvas');
            const canvas = await html2canvas(reportContentElement, { scale: 2 }); // Increased scale for better resolution
            const imgData = canvas.toDataURL('image/png');

            // Add the image to the PDF
            const imgWidth = 190; // PDF width minus margins
            const pageHeight = doc.internal.pageSize.height;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = yOffset;

            doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight - position;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            let footerY = pageHeight - 20; // Position for footer

            // Add footer if exists
            if (reportFooter) {
                 console.log('Adding footer to PDF');
                doc.setFontSize(10);
                doc.text(reportFooter, 105, footerY, { align: 'center' });
            }

            // Add signature if exists
            if (digitalSignature) {
                 console.log('Adding signature to PDF');
                 const signatureHeight = 20;
                 const signatureWidth = 40;
                 // Position signature above footer, adjust as needed
                 doc.addImage(digitalSignature, 'PNG', 150, footerY - signatureHeight - 5, signatureWidth, signatureHeight);
            }

            doc.save(`${currentReportType.toLowerCase()}_report.pdf`);
            console.log('PDF saved');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please check the console for details.');
        }
    };

    // Event Listeners
    if (generateCalibrationReportBtn) {
        generateCalibrationReportBtn.addEventListener('click', async () => {
            const gageId = calibrationReportGageIdInput ? calibrationReportGageIdInput.value : '';
            if (!gageId) {
                alert('Please enter a Gage ID');
                return;
            }

            try {
                // Disable button and show loading state
                if (generateCalibrationReportBtn) {
                    generateCalibrationReportBtn.disabled = true;
                    generateCalibrationReportBtn.textContent = 'Generating...';
                }

                console.log('Fetching calibration report for Gage ID:', gageId);
                const response = await fetch(`http://127.0.0.1:5005/api/reports/calibration/${gageId}`);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `Error fetching calibration report: ${response.statusText}`);
                }

                const reportData = await response.json();
                console.log('Received calibration report data:', reportData);
                
                if (!reportData || !reportData.gage_id) {
                    throw new Error('Invalid report data received from server');
                }

                showReportDisplay('Calibration', reportData);
            } catch (error) {
                console.error('Error generating calibration report:', error);
                alert(`Error generating report: ${error.message}`);
            } finally {
                // Reset button state
                if (generateCalibrationReportBtn) {
                    generateCalibrationReportBtn.disabled = false;
                    generateCalibrationReportBtn.textContent = 'Generate Report';
                }
            }
        });
    }

    if (generateUsageLogReportBtn) {
        generateUsageLogReportBtn.addEventListener('click', async () => {
            const gageId = usageLogGageIdInput ? usageLogGageIdInput.value : '';
            if (!gageId) {
                alert('Please enter a Gage ID');
                return;
            }

            try {
                // Disable button and show loading state
                if (generateUsageLogReportBtn) {
                    generateUsageLogReportBtn.disabled = true;
                    generateUsageLogReportBtn.textContent = 'Generating...';
                }

                console.log('Fetching usage log report for Gage ID:', gageId);
                const response = await fetch(`http://127.0.0.1:5005/api/reports/issue-log/${gageId}`);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `Error fetching usage log report: ${response.statusText}`);
                }

                const reportData = await response.json();
                console.log('Received usage log report data:', reportData);
                
                if (!reportData || !reportData.gage_id) {
                    throw new Error('Invalid report data received from server');
                }

                showReportDisplay('Usage Log', reportData);
            } catch (error) {
                console.error('Error generating usage log report:', error);
                alert(`Error generating report: ${error.message}`);
            } finally {
                // Reset button state
                if (generateUsageLogReportBtn) {
                    generateUsageLogReportBtn.disabled = false;
                    generateUsageLogReportBtn.textContent = 'Generate Report';
                }
            }
        });
    }

    if (backToGenerationBtn) {
        backToGenerationBtn.addEventListener('click', showReportGeneration);
    }
    if (printReportBtn) {
        printReportBtn.addEventListener('click', printReport);
    }
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', downloadReportPdf);
    }

    // Event listener for the new Report Settings button
    if (reportSettingsBtn) {
        reportSettingsBtn.addEventListener('click', () => {
            console.log('Report Settings button clicked');
            if (reportSettingsModal) {
                reportSettingsModal.style.display = 'flex'; // Use flex to center the modal
                console.log('Report settings modal display set to flex');
            }
        });
    }

    if (logoUpload) {
        logoUpload.addEventListener('change', handleLogoUpload);
    }
    if (removeLogoBtn) {
        removeLogoBtn.addEventListener('click', () => {
            console.log('Remove logo button clicked');
            companyLogo = null;
            if (logoPreview) {
                 logoPreview.src = '';
                 logoPreview.style.display = 'none';
            }
            if (removeLogoBtn) {
                 removeLogoBtn.style.display = 'none';
            }
            if (logoUpload) {
                 logoUpload.value = '';
            }
            console.log('Logo removed');
        });
    }

    if (clearSignatureBtn && signaturePadInstance) {
        clearSignatureBtn.addEventListener('click', clearSignaturePad);
    }
    if (saveSignatureBtn) {
         saveSignatureBtn.addEventListener('click', handleSignaturePad);
    }

    if (reportSettingsForm) {
        reportSettingsForm.addEventListener('submit', saveReportSettings);
    }
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', () => {
            console.log('Cancel settings button clicked');
            if (reportSettingsModal) {
                reportSettingsModal.style.display = 'none';
                console.log('Report settings modal hidden');
            }
        });
    }
    // Add event listener for the close button (X) on the modal
    if (closeSettingsModalBtn) {
        closeSettingsModalBtn.addEventListener('click', () => {
            console.log('Close settings modal button clicked');
            if (reportSettingsModal) {
                reportSettingsModal.style.display = 'none';
                console.log('Report settings modal hidden');
            }
        });
    }

    // Mark as initialized
    window.reportManagerInitialized = true;
    console.log('Report Manager initialized successfully');
}

// Make the initialization function available globally
window.initializeReportManager = initializeReportManager;

// This DOMContentLoaded listener is mainly for testing or initial page load
// In a multi-page app using showPage, the showPage function should trigger initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, attempting to initialize Report Manager');
    // The setupReportsPageLoader in renderer.js will call initializeReportManager when the reports page is shown
    // initializeReportManager(); // Removed direct call here to avoid double initialization issues with showPage
});
