import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import get_settings
from sqlalchemy.orm import Session
from models import User, CalibrationRecord, Gage
import logging
from datetime import datetime

settings = get_settings()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_user_email(db: Session, user_id: int) -> str:
    """Get user's email from the database"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User with ID {user_id} not found")
            return None
        return user.email
    except Exception as e:
        logger.error(f"Error getting user email: {str(e)}")
        return None

def send_calibration_notification(db: Session, calibration_id: int) -> bool:
    """Send email notification for a calibration record"""
    try:
        # Get calibration record with gage details
        calibration = db.query(CalibrationRecord).filter(CalibrationRecord.calibration_id == calibration_id).first()
        if not calibration:
            logger.error(f"Calibration record with ID {calibration_id} not found")
            return False

        # Get gage details
        gage = db.query(Gage).filter(Gage.gage_id == calibration.gage_id).first()
        if not gage:
            logger.error(f"Gage with ID {calibration.gage_id} not found")
            return False

        # Get calibrator's email
        calibrator_email = get_user_email(db, calibration.calibrated_by)
        if not calibrator_email:
            logger.error(f"No email found for calibrator with ID {calibration.calibrated_by}")
            return False

        # Validate email settings
        if not all([settings.SMTP_SERVER, settings.SMTP_PORT, settings.SMTP_USERNAME, 
                   settings.SMTP_PASSWORD, settings.EMAIL_FROM]):
            logger.error("Missing email configuration settings")
            return False

        # Create email message
        msg = MIMEMultipart()
        msg['From'] = settings.EMAIL_FROM
        msg['To'] = calibrator_email
        msg['Subject'] = f"Calibration Notification - Gage {gage.name}"

        # Email body
        body = f"""
        Hello,

        This is a notification regarding the calibration of gage {gage.name} (ID: {gage.gage_id}).

        Calibration Details:
        - Gage Name: {gage.name}
        - Serial Number: {gage.serial_number}
        - Calibration Date: {calibration.calibration_date}
        - Next Due Date: {calibration.next_due_date}
        - Calibration Result: {calibration.calibration_result}

        Please ensure all calibration procedures were followed correctly.

        Best regards,
        Gage Calibration System
        """

        msg.attach(MIMEText(body, 'plain'))

        # Send email
        logger.info(f"Attempting to send email to {calibrator_email}")
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
            logger.info("Email sent successfully")

        # Update notification status
        calibration.notification_sent = True
        calibration.notification_sent_date = datetime.utcnow()
        calibration.notification_read = False
        calibration.notification_read_date = None
        db.commit()

        return True

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication Error: {str(e)}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP Error: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        return False 