from celery import Celery
from celery.schedules import crontab

celery = Celery(
    "mad2",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=["tasks"]
)

celery.conf.timezone = "Asia/Kolkata"

celery.conf.beat_schedule = {
    "daily-reminders": {
        "task": "tasks.send_daily_reminders",
        "schedule": crontab(hour=8, minute=0)   # every day 8 AM
    },
    "monthly-report": {
        "task": "tasks.generate_monthly_report",
        "schedule": crontab(hour=9, minute=0, day_of_month='1')
    }
}