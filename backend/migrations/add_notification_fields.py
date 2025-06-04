"""Add notification fields to calibration records

Revision ID: add_notification_fields
Revises: 
Create Date: 2024-03-19

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_notification_fields'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add notification fields
    op.add_column('calibration_records', sa.Column('notification_sent', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('calibration_records', sa.Column('notification_sent_date', sa.DateTime(), nullable=True))
    op.add_column('calibration_records', sa.Column('notification_read', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('calibration_records', sa.Column('notification_read_date', sa.DateTime(), nullable=True))

def downgrade():
    # Remove notification fields
    op.drop_column('calibration_records', 'notification_read_date')
    op.drop_column('calibration_records', 'notification_read')
    op.drop_column('calibration_records', 'notification_sent_date')
    op.drop_column('calibration_records', 'notification_sent') 