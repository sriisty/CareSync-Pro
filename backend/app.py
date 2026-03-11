from datetime import timedelta

from flask import Flask, app, make_response,jsonify
import os
from model import* 
from security import*
from login_api import LoginAPI , LogoutAPI,RegisterAPI
from  crud_apis import DoctorAPI, DepartmentAPI, AdminDoctorSearchAPI, AdminPatientAPI, AdminAppointmentAPI, AdminDashboardAPI
from patient_apis import PatientProfileAPI, PatientDoctorSearchAPI, PatientAppointmentAPI, PatientDoctorScheduleAPI, PatientExportCSVAPI
from doctor_apis import DoctorAssignedAppointmentAPI, DoctorPatientHistoryAPI, DoctorPatientsListAPI, DoctorScheduleAPI
from flask_restful import Api
from cache import cache
from flask_cors import CORS
from sqlalchemy import text

current_dir=os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(current_dir, 'hospital.db')
CORS(app)  # Allow Vue.js frontend on a different port

#secret keys
app.config["SECRET_KEY"] = "super-secret-key"         # Flask's own session key
app.config["JWT_SECRET_KEY"] = "super-secret-jwt-key"  # Key for JWT
# access tokens default to 15 minutes; for dev work we can extend or disable expiration
# configure a longer lifetime or set to False to never expire
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)   # 2‑hour tokens


app.config['CACHE_TYPE'] = os.environ.get('CACHE_TYPE', 'SimpleCache')
if app.config['CACHE_TYPE'] == 'RedisCache':
    app.config['CACHE_REDIS_URL'] = os.environ.get('CACHE_REDIS_URL', 'redis://localhost:6379/0')

db.init_app(app)
jwt.init_app(app)
cache.init_app(app)


@app.route('/')
def index():
    return "Welcome to the Hospital Management System"


#  In-app Notification Endpoint 
# Patients poll this to get alerts (e.g. "CSV export ready")
# Stored in Redis db=1 by tasks.py
@app.route('/api/patient/notifications', methods=['GET'])
@patient_required
@jwt_required()
def get_patient_notifications():
    """
    Returns recent in-app notifications for the logged-in patient.
    Notifications are stored in Redis (db=1) by async tasks.
    The frontend should poll this every 10–30 seconds.
    """
    from flask_jwt_extended import current_user
    import redis, json

    patient = Patient.query.filter_by(user_id=current_user.id).first()
    if not patient:
        return make_response(jsonify({"message": "Profile not found"}), 404)

    try:
        r = redis.Redis(host="localhost", port=6379, db=1, decode_responses=True)
        key = f"notifications:patient:{patient.id}"
        raw = r.lrange(key, 0, -1)
        notifications = [json.loads(n) for n in raw]
        # Clear after reading (mark as delivered)
        r.delete(key)
    except Exception as e:
        notifications = []

    return make_response(jsonify({
        "message": "Notifications retrieved",
        "notifications": notifications
    }), 200)


api=Api(app,prefix='/api')
api.add_resource(LoginAPI, '/login')
api.add_resource(LogoutAPI, '/logout')
api.add_resource(RegisterAPI, '/register')

#admin crud functions
api.add_resource(DoctorAPI,'/doctors','/doctors/<int:id>')
api.add_resource(DepartmentAPI,'/departments','/departments/<int:id>')
api.add_resource(AdminDoctorSearchAPI, '/admin/doctors/search')
api.add_resource(AdminPatientAPI, '/admin/patients', '/admin/patients/<int:id>')
api.add_resource(AdminAppointmentAPI, '/admin/appointments', '/admin/appointments/<int:id>')
api.add_resource(AdminDashboardAPI, '/admin/dashboard')
# Patient APIs
api.add_resource(PatientProfileAPI, '/patient/profile')
api.add_resource(PatientDoctorSearchAPI, '/patient/doctors/search')
api.add_resource(PatientAppointmentAPI, '/patient/appointments', '/patient/appointments/<int:id>')
api.add_resource(PatientDoctorScheduleAPI, '/patient/doctors/<int:doctor_id>/schedule')
api.add_resource(PatientExportCSVAPI, '/patient/export/csv')

# Doctor APIs
api.add_resource(DoctorAssignedAppointmentAPI, '/doctor/appointments', '/doctor/appointments/<int:id>')
api.add_resource(DoctorPatientHistoryAPI, '/doctor/patients/<int:patient_id>/history')
api.add_resource(DoctorPatientsListAPI, '/doctor/patients')
api.add_resource(DoctorScheduleAPI, '/doctor/schedule')


def ensure_schema_updates():
    doctor_schedule_columns = {
        row[1] for row in db.session.execute(text("PRAGMA table_info(doctor_schedules)")).fetchall()
    }
    if 'available_date' not in doctor_schedule_columns:
        db.session.execute(text("ALTER TABLE doctor_schedules ADD COLUMN available_date DATE"))
        db.session.commit()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        ensure_schema_updates()
        #db.drop_all() # Drop all tables to start fresh
        create_admin() # Create default admin user
    app.run(debug=True)
