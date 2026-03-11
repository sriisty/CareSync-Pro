from celery_init import celery
import csv
import io
from datetime import datetime, timedelta
from model import Appointment, Treatment, Patient, Doctor, db
import smtplib
import os,sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from celery_config import *

sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))
                )
def get_app():
    from app import app
    return app

def send_email(to_email, subject, html_body, attachment_data=None, attachment_filename=None):
    """
    Helper to send an HTML email via Gmail SMTP.
    Optionally attaches a file (e.g. CSV bytes).
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_EMAIL
        msg["To"] = to_email

        # Attach HTML body
        msg.attach(MIMEText(html_body, "html"))

        # Attach file if provided
        if attachment_data and attachment_filename:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment_data)
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename={attachment_filename}",
            )
            msg.attach(part)

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        print(f"[Email] Sent '{subject}' → {to_email}")
        return True

    except Exception as e:
        print(f"[Email Error] Failed to send to {to_email}: {e}")
        return False


#  Task 1: Daily Appointment Reminders 
@celery.task
def send_daily_reminders():
    """
    Runs every day at 8 AM (IST).
    Emails every patient who has a 'scheduled' appointment today.
    """
    from app import app
    with app.app_context():
        today = datetime.now().date()
        appointments = Appointment.query.filter_by(status="scheduled").all()
        todays_appointments = [
            apt for apt in appointments
            if apt.appointment_date.date() == today
        ]

        sent_count = 0
        for apt in todays_appointments:
            patient = apt.patient
            doctor = apt.doctor
            if not patient or not doctor:
                continue

            # Get patient's email from the linked User account
            patient_email = patient.user.email if patient.user else patient.email

            subject = " Appointment Reminder – Today"
            html_body = f"""
            <html><body style="font-family: Arial, sans-serif; color: #333;">
              <div style="max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
                <div style="background:#1a73e8;padding:20px;text-align:center;">
                  <h2 style="color:white;margin:0;">Hospital Management System</h2>
                </div>
                <div style="padding:30px;">
                  <h3>Hello, {patient.name}!</h3>
                  <p>This is a reminder that you have an appointment <strong>today</strong>.</p>
                  <table style="width:100%;border-collapse:collapse;margin-top:15px;">
                    <tr style="background:#f5f5f5;">
                      <td style="padding:10px;font-weight:bold;">Doctor</td>
                      <td style="padding:10px;">Dr. {doctor.name}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px;font-weight:bold;">Department</td>
                      <td style="padding:10px;">{doctor.department.name if doctor.department else 'N/A'}</td>
                    </tr>
                    <tr style="background:#f5f5f5;">
                      <td style="padding:10px;font-weight:bold;">Date</td>
                      <td style="padding:10px;">{apt.appointment_date.strftime('%B %d, %Y')}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px;font-weight:bold;">Time</td>
                      <td style="padding:10px;">{apt.appointment_time.strftime('%I:%M %p')}</td>
                    </tr>
                  </table>
                  <p style="margin-top:20px;color:#666;font-size:14px;">
                    Please arrive 10 minutes early. If you need to cancel, log in to your account.
                  </p>
                </div>
                <div style="background:#f9f9f9;padding:15px;text-align:center;font-size:12px;color:#999;">
                  Hospital Management System &nbsp;|&nbsp; Do not reply to this email.
                </div>
              </div>
            </body></html>
            """
            if send_email(patient_email, subject, html_body):
                sent_count += 1

        return f"Daily reminders sent: {sent_count}/{len(todays_appointments)}"


#  Task 2: Monthly Doctor Activity Report 
@celery.task
def generate_monthly_report():
    """
    Runs on the 1st of every month at 9 AM (IST).
    Sends each doctor an HTML email summarising their previous month's activity.
    """
    from app import app
    with app.app_context():
        now = datetime.now()
        first_day_current = now.replace(day=1)
        last_day_prev = first_day_current - timedelta(days=1)
        last_month = last_day_prev.month
        last_month_year = last_day_prev.year
        month_name = last_day_prev.strftime("%B %Y")

        doctors = Doctor.query.all()

        for doctor in doctors:
            doctor_email = doctor.user.email if doctor.user else None
            if not doctor_email:
                continue

            all_apts = Appointment.query.filter_by(doctor_id=doctor.id).all()
            month_apts = [
                a for a in all_apts
                if a.appointment_date.month == last_month
                and a.appointment_date.year == last_month_year
            ]

            total = len(month_apts)
            completed = sum(1 for a in month_apts if a.status == "completed")
            cancelled = sum(1 for a in month_apts if a.status == "cancelled")
            scheduled = sum(1 for a in month_apts if a.status == "scheduled")

            # Build appointment rows
            rows_html = ""
            for a in month_apts:
                treatment = Treatment.query.filter_by(appointment_id=a.id).first()
                diagnosis = treatment.diagnosis if treatment else "—"
                patient_name = a.patient.name if a.patient else "Unknown"
                status_color = {
                    "completed": "#34a853",
                    "cancelled": "#ea4335",
                    "scheduled": "#fbbc04"
                }.get(a.status, "#666")

                rows_html += f"""
                <tr>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{a.appointment_date.strftime('%d %b')}</td>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{patient_name}</td>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{diagnosis}</td>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
                    <span style="color:{status_color};font-weight:bold;text-transform:capitalize;">{a.status}</span>
                  </td>
                </tr>
                """

            if not rows_html:
                rows_html = '<tr><td colspan="4" style="padding:20px;text-align:center;color:#999;">No appointments this month.</td></tr>'

            import urllib.parse
            import json
            chart_config = {
                "type": "doughnut",
                "data": {
                    "labels": ["Completed", "Cancelled", "Scheduled"],
                    "datasets": [{
                        "data": [completed, cancelled, scheduled],
                        "backgroundColor": ["#34a853", "#ea4335", "#fbbc04"]
                    }]
                },
                "options": {
                    "title": { "display": True, "text": "Appointment Status" }
                }
            }
            chart_url = f"https://quickchart.io/chart?c={urllib.parse.quote(json.dumps(chart_config))}&w=400&h=200"

            subject = f" Monthly Activity Report – {month_name}"
            html_body = f"""
            <html><body style="font-family: Arial, sans-serif; color: #333;">
              <div style="max-width:700px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
                <div style="background:#1a73e8;padding:20px;text-align:center;">
                  <h2 style="color:white;margin:0;">Monthly Activity Report</h2>
                  <p style="color:#c8dcff;margin:5px 0 0;">{month_name}</p>
                </div>
                <div style="padding:30px;">
                  <h3>Hello, Dr. {doctor.name}</h3>
                  <p>Here is your activity summary for <strong>{month_name}</strong>.</p>

                  <!-- Stats Cards -->
                  <div style="display:flex;gap:12px;margin:20px 0;">
                    <div style="flex:1;background:#e8f5e9;border-radius:8px;padding:15px;text-align:center;">
                      <div style="font-size:28px;font-weight:bold;color:#34a853;">{total}</div>
                      <div style="font-size:12px;color:#666;">Total</div>
                    </div>
                    <div style="flex:1;background:#e3f2fd;border-radius:8px;padding:15px;text-align:center;">
                      <div style="font-size:28px;font-weight:bold;color:#1a73e8;">{completed}</div>
                      <div style="font-size:12px;color:#666;">Completed</div>
                    </div>
                    <div style="flex:1;background:#fce4ec;border-radius:8px;padding:15px;text-align:center;">
                      <div style="font-size:28px;font-weight:bold;color:#ea4335;">{cancelled}</div>
                      <div style="font-size:12px;color:#666;">Cancelled</div>
                    </div>
                    <div style="flex:1;background:#fffde7;border-radius:8px;padding:15px;text-align:center;">
                      <div style="font-size:28px;font-weight:bold;color:#fbbc04;">{scheduled}</div>
                      <div style="font-size:12px;color:#666;">Scheduled</div>
                    </div>
                  </div>

                  <!-- Chart Visualization -->
                  <div style="text-align:center;margin-bottom:30px;">
                    <img src="{chart_url}" alt="Activity Chart" style="display:block;margin:0 auto;max-width:100%;height:auto;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);" />
                  </div>

                  <!-- Appointment Table -->
                  <h4 style="border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Appointment Details</h4>
                  <table style="width:100%;border-collapse:collapse;">
                    <thead>
                      <tr style="background:#f5f5f5;">
                        <th style="padding:10px;text-align:left;">Date</th>
                        <th style="padding:10px;text-align:left;">Patient</th>
                        <th style="padding:10px;text-align:left;">Diagnosis</th>
                        <th style="padding:10px;text-align:left;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows_html}
                    </tbody>
                  </table>
                </div>
                <div style="background:#f9f9f9;padding:15px;text-align:center;font-size:12px;color:#999;">
                  Hospital Management System &nbsp;|&nbsp; Auto-generated report. Do not reply.
                </div>
              </div>
            </body></html>
            """
            send_email(doctor_email, subject, html_body)

        return f"Monthly reports sent to {len(doctors)} doctors"


#  Task 3: Async CSV Export of Patient Treatment History 
@celery.task
def export_patient_treatments_csv(patient_id):
    """
    Triggered on-demand when patient requests export.
    Generates CSV and emails it as an attachment to the patient.
    Also stores a flag in Redis so the frontend can show an in-app alert.
    """
    from app import app
    with app.app_context():
        patient = Patient.query.get(patient_id)
        if not patient:
            return "Patient not found"

        appointments = Appointment.query.filter_by(patient_id=patient_id).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Patient ID", "Patient Name", "Consulting Doctor",
            "Appointment Date", "Appointment Time", "Status",
            "Diagnosis", "Prescription", "Notes", "Next Visit Date"
        ])

        for apt in appointments:
            treatments = Treatment.query.filter_by(appointment_id=apt.id).all()
            if treatments:
                for t in treatments:
                    writer.writerow([
                        patient.user_id,
                        patient.name,
                        apt.doctor.name if apt.doctor else "N/A",
                        apt.appointment_date.date(),
                        apt.appointment_time,
                        apt.status,
                        t.diagnosis,
                        t.prescription,
                        t.notes or "",
                        t.next_visit_date.date() if t.next_visit_date else "N/A"
                    ])
            else:
                # Include appointments with no treatment yet
                writer.writerow([
                    patient.user_id,
                    patient.name,
                    apt.doctor.name if apt.doctor else "N/A",
                    apt.appointment_date.date(),
                    apt.appointment_time,
                    apt.status,
                    "—", "—", "—", "—"
                ])

        csv_bytes = output.getvalue().encode("utf-8")
        output.close()

        filename = f"treatment_history_{patient.name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.csv"
        patient_email = patient.user.email if patient.user else patient.email

        subject = "📄 Your Treatment History Export is Ready"
        html_body = f"""
        <html><body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
            <div style="background:#1a73e8;padding:20px;text-align:center;">
              <h2 style="color:white;margin:0;">Hospital Management System</h2>
            </div>
            <div style="padding:30px;">
              <h3>Hello, {patient.name}!</h3>
              <p>Your treatment history export is ready. Please find the CSV file attached to this email.</p>
              <p style="color:#666;">The file <strong>{filename}</strong> contains all your appointments and treatment records.</p>
              <p style="margin-top:20px;padding:15px;background:#e8f5e9;border-radius:8px;color:#2e7d32;">
                ✅ Export completed successfully on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
              </p>
            </div>
            <div style="background:#f9f9f9;padding:15px;text-align:center;font-size:12px;color:#999;">
              Hospital Management System &nbsp;|&nbsp; Do not reply to this email.
            </div>
          </div>
        </body></html>
        """

        send_email(patient_email, subject, html_body,
                   attachment_data=csv_bytes,
                   attachment_filename=filename)

        # ── In-app notification: store alert in Redis ───────────────────────
        # The frontend polls GET /api/patient/notifications to show a banner
        try:
            import redis
            import json
            r = redis.Redis(host="localhost", port=6379, db=1, decode_responses=True)
            notification = {
                "type": "csv_ready",
                "message": f"Your treatment history CSV ({filename}) has been emailed to you.",
                "timestamp": datetime.now().isoformat()
            }
            # Keep last 10 notifications per patient (list, newest first)
            key = f"notifications:patient:{patient_id}"
            r.lpush(key, json.dumps(notification))
            r.ltrim(key, 0, 9)
            r.expire(key, 86400)  # expire after 24 hours
        except Exception as e:
            print(f"[Redis Notification] Could not store in-app alert: {e}")

        return f"CSV export emailed to {patient_email}"