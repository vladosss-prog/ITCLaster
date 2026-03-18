"""back5_schedule_comments_feedback

Revision ID: 6c0c9b3c4f2d
Revises: 89e346abb699
Create Date: 2026-03-17

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6c0c9b3c4f2d"
down_revision: Union[str, Sequence[str], None] = "89e346abb699"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_report_schedules",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("report_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ux_user_report_schedules_user_report",
        "user_report_schedules",
        ["user_id", "report_id"],
        unique=True,
    )

    op.create_table(
        "report_comments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("report_id", sa.String(), nullable=False),
        sa.Column("author_id", sa.String(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("answer_by_id", sa.String(), nullable=True),
        sa.Column("answer_created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["answer_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_comments_report_id", "report_comments", ["report_id"], unique=False)

    op.create_table(
        "report_feedbacks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("report_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ux_report_feedbacks_report_user",
        "report_feedbacks",
        ["report_id", "user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_report_feedbacks_report_user", table_name="report_feedbacks")
    op.drop_table("report_feedbacks")

    op.drop_index("ix_report_comments_report_id", table_name="report_comments")
    op.drop_table("report_comments")

    op.drop_index("ux_user_report_schedules_user_report", table_name="user_report_schedules")
    op.drop_table("user_report_schedules")



