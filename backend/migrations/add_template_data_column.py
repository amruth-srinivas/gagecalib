"""add template_data column

Revision ID: add_template_data_column
Revises: 
Create Date: 2025-06-16 04:10:05.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_template_data_column'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add the template_data column as JSON type
    op.add_column('label_templates', 
                 sa.Column('template_data', 
                          postgresql.JSON(astext_type=sa.Text()),
                          nullable=False,
                          server_default='{}'))

def downgrade():
    # Remove the template_data column if rolling back
    op.drop_column('label_templates', 'template_data')
