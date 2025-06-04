-- First, let's check if the table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS calibration_records (
    calibration_id SERIAL PRIMARY KEY,
    gage_id INTEGER,
    calibration_date DATE,
    calibrated_by INTEGER,
    calibration_method TEXT,
    calibration_result VARCHAR(100),
    deviation_recorded TEXT,
    adjustments_made INTEGER,
    certificate_number VARCHAR(100),
    next_due_date DATE,
    comments TEXT,
    calibration_document_path TEXT
);

-- Now add the notification columns if they don't exist
DO $$ 
BEGIN
    -- Add notification_sent column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'calibration_records' AND column_name = 'notification_sent') THEN
        ALTER TABLE calibration_records ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add notification_sent_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'calibration_records' AND column_name = 'notification_sent_date') THEN
        ALTER TABLE calibration_records ADD COLUMN notification_sent_date TIMESTAMP;
    END IF;

    -- Add notification_read column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'calibration_records' AND column_name = 'notification_read') THEN
        ALTER TABLE calibration_records ADD COLUMN notification_read BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add notification_read_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'calibration_records' AND column_name = 'notification_read_date') THEN
        ALTER TABLE calibration_records ADD COLUMN notification_read_date TIMESTAMP;
    END IF;
END $$; 