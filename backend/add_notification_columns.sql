-- Add notification columns to calibration_records table
ALTER TABLE calibration_records 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_sent_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS notification_read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_read_date TIMESTAMP; 