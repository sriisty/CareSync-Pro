from flask_restful import Resource
from flask import jsonify, make_response, request
from model import *
from security import *
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime
import uuid
from cache import cache
from tasks import export_patient_treatments_csv


class PatientProfileAPI(Resource):
    @patient_required
    @jwt_required()
    def get(self):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Patient profile not found. Please create one."}), 404)

        response = {
            "message": "Patient profile found",
            "profile": {
                "id": patient.id,
                "name": patient.name,
                "contact": patient.contact,
                "age": patient.age,
                "dob": str(patient.dob),
                "gender": patient.gender,
                "address": patient.address,
                "medical_history": patient.medical_history
            }
        }
        return make_response(jsonify(response), 200)

    @patient_required
    @jwt_required()
    def put(self):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found"}), 404)

        data = request.get_json()
        if not data:
            return make_response(jsonify({"message": "No input provided"}), 400)

        if 'dob' in data:
            try:
                patient.dob = datetime.strptime(data['dob'], '%Y-%m-%d').date()
            except ValueError:
                return make_response(jsonify({"message": "Invalid DOB format (YYYY-MM-DD)"}), 400)

        patient.name = data.get('name', patient.name)
        patient.contact = data.get('contact', patient.contact)
        patient.age = data.get('age', patient.age)
        patient.gender = data.get('gender', patient.gender)
        patient.address = data.get('address', patient.address)
        patient.medical_history = data.get('medical_history', patient.medical_history)
        db.session.commit()

        cache.delete(f"patient_{patient.id}")
        return make_response(jsonify({"message": "Patient profile updated successfully"}), 200)


class PatientDoctorSearchAPI(Resource):
    @patient_required
    @jwt_required()
    @cache.cached(timeout=120, query_string=True)
    def get(self):
        name = request.args.get('name')
        specialization = request.args.get('specialization')
        query = Doctor.query
        if name:
            query = query.filter(Doctor.name.ilike(f'%{name}%'))
        if specialization:
            query = query.join(Department).filter(Department.name.ilike(f'%{specialization}%'))
        doctors = query.all()
        response = {
            "message": "doctor search results",
            "doctors": [
                {
                    "id": doctor.id,
                    "name": doctor.name,
                    "contact": doctor.contact,
                    "department_id": doctor.department_id,
                    "department_name": doctor.department.name if doctor.department else None,
                    "experience": doctor.experience,
                    "qualification": doctor.qualification
                }
                for doctor in doctors
            ]
        }
        return make_response(jsonify(response), 200)


class PatientAppointmentAPI(Resource):
    @patient_required
    @jwt_required()
    def get(self):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found. Please create one."}), 404)

        filter_type = request.args.get('filter')

        # ── Cached appointments ──────────────────────────────────────────────
        cache_key = f"patient_appointments_{patient.id}_{filter_type or 'all'}"
        cached = cache.get(cache_key)
        if cached:
            return make_response(jsonify(cached), 200)

        query = Appointment.query.filter_by(patient_id=patient.id)
        if filter_type == 'upcoming':
            query = query.filter_by(status='scheduled')
        elif filter_type == 'past':
            query = query.filter(Appointment.status.in_(['completed', 'cancelled']))

        appointments = query.order_by(Appointment.appointment_date.desc()).all()

        result = []
        for apt in appointments:
            treatments = Treatment.query.filter_by(appointment_id=apt.id).all()
            result.append({
                "id": apt.id,
                "doctor_name": apt.doctor.name if apt.doctor else None,
                "doctor_id": apt.doctor_id,
                "date": str(apt.appointment_date.date()),
                "time": str(apt.appointment_time),
                "status": apt.status,
                "treatments": [
                    {
                        "diagnosis": t.diagnosis,
                        "prescription": t.prescription,
                        "notes": t.notes
                    }
                    for t in treatments
                ]
            })

        response = {"message": "appointment history", "appointments": result}
        cache.set(cache_key, response, timeout=120)
        return make_response(jsonify(response), 200)

    @patient_required
    @jwt_required()
    def post(self):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found. Please create one."}), 404)

        data = request.get_json()
        doctor_id = data.get('doctor_id')
        date_str = data.get('appointment_date')
        time_str = data.get('appointment_time')

        if not (doctor_id and date_str and time_str):
            return make_response(jsonify({"message": "Doctor ID, date, and time are required"}), 400)

        try:
            apt_date = datetime.strptime(date_str, '%Y-%m-%d')
            apt_time = datetime.strptime(time_str, '%H:%M:%S').time()
        except ValueError:
            return make_response(jsonify({"message": "Invalid date/time format. Use YYYY-MM-DD and HH:MM:SS"}), 400)

        existing_apt = Appointment.query.filter_by(
            doctor_id=doctor_id,
            appointment_date=apt_date,
            appointment_time=apt_time,
            status='scheduled'
        ).first()
        if existing_apt:
            return make_response(jsonify({"message": "Doctor is already booked at this time"}), 409)

        new_apt = Appointment(
            doctor_id=doctor_id,
            patient_id=patient.id,
            appointment_date=apt_date,
            appointment_time=apt_time,
            status='scheduled'
        )
        db.session.add(new_apt)
        db.session.commit()

        # Invalidate caches
        cache.delete(f"patient_appointments_{patient.id}_all")
        cache.delete(f"patient_appointments_{patient.id}_upcoming")
        cache.delete(f"patient_appointments_{patient.id}_None")

        return make_response(jsonify({"message": "Appointment booked successfully"}), 201)

    @patient_required
    @jwt_required()
    def put(self, id):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found"}), 404)

        apt = Appointment.query.filter_by(id=id, patient_id=patient.id).first()
        if not apt:
            return make_response(jsonify({"message": "Appointment not found or unauthorized"}), 404)

        data = request.get_json()
        if data.get('appointment_date'):
            try:
                apt.appointment_date = datetime.strptime(data['appointment_date'], '%Y-%m-%d')
            except ValueError:
                return make_response(jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400)

        if data.get('appointment_time'):
            try:
                apt.appointment_time = datetime.strptime(data['appointment_time'], '%H:%M:%S').time()
            except ValueError:
                return make_response(jsonify({"message": "Invalid time format. Use HH:MM:SS"}), 400)

        db.session.commit()

        # Invalidate caches
        cache.delete(f"patient_appointments_{patient.id}_all")
        cache.delete(f"patient_appointments_{patient.id}_upcoming")
        cache.delete(f"patient_appointments_{patient.id}_None")

        return make_response(jsonify({"message": "Appointment rescheduled successfully"}), 200)

    @patient_required
    @jwt_required()
    def delete(self, id):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found"}), 404)

        apt = Appointment.query.filter_by(id=id, patient_id=patient.id).first()
        if not apt:
            return make_response(jsonify({"message": "Appointment not found or unauthorized"}), 404)

        apt.status = 'cancelled'
        db.session.commit()

        # Invalidate caches
        cache.delete(f"patient_appointments_{patient.id}_all")
        cache.delete(f"patient_appointments_{patient.id}_upcoming")
        cache.delete(f"patient_appointments_{patient.id}_past")
        cache.delete(f"patient_appointments_{patient.id}_None")

        return make_response(jsonify({"message": "Appointment cancelled successfully"}), 200)


class PatientDoctorScheduleAPI(Resource):
    @patient_required
    @jwt_required()
    def get(self, doctor_id):
        doctor = Doctor.query.get(doctor_id)
        if not doctor:
            return make_response(jsonify({"message": "Doctor not found"}), 404)

        # ── Cached schedule (patients need this to book) ─────────────────────
        cache_key = f"doctor_schedule_{doctor_id}"
        cached = cache.get(cache_key)
        if cached:
            return make_response(jsonify(cached), 200)

        schedules = DoctorSchedule.query.filter_by(doctor_id=doctor_id).all()
        result = [
            {
                "day_of_week": s.day_of_week,
                "start_time": str(s.start_time),
                "end_time": str(s.end_time),
                "is_available": s.is_available
            }
            for s in schedules
        ]

        response = {
            "message": f"Schedule for Dr. {doctor.name}",
            "schedule": result
        }
        cache.set(cache_key, response, timeout=300)
        return make_response(jsonify(response), 200)


class PatientExportCSVAPI(Resource):
    @patient_required
    @jwt_required()
    def post(self):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found"}), 404)

        # Trigger async Celery task
        export_patient_treatments_csv.delay(patient.id)

        return make_response(jsonify({
            "message": "CSV export has been triggered. You will receive an email with the file attached, and an in-app notification when it's ready."
        }), 202)


class PatientPaymentAPI(Resource):
    @patient_required
    @jwt_required()
    def get(self, id=None):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found"}), 404)

        if id:
            payment = Payment.query.filter_by(id=id, patient_id=patient.id).first()
            if not payment:
                return make_response(jsonify({"message": "Payment record not found"}), 404)
            return make_response(jsonify({
                "id": payment.id,
                "treatment_id": payment.treatment_id,
                "amount": payment.amount,
                "payment_status": payment.payment_status,
                "payment_method": payment.payment_method,
                "paid_at": str(payment.paid_at) if payment.paid_at else None
            }), 200)

        payments = Payment.query.filter_by(patient_id=patient.id).all()
        result = [
            {"id": p.id, "treatment_id": p.treatment_id, "amount": p.amount, "status": p.payment_status}
            for p in payments
        ]
        return make_response(jsonify({"message": "Payment history retrieved", "payments": result}), 200)

    @patient_required
    @jwt_required()
    def post(self, id):
        patient = Patient.query.filter_by(user_id=current_user.id).first()
        if not patient:
            return make_response(jsonify({"message": "Profile not found"}), 404)

        payment = Payment.query.filter_by(id=id, patient_id=patient.id).first()
        if not payment:
            return make_response(jsonify({"message": "Payment record not found"}), 404)

        if payment.payment_status == 'Completed':
            return make_response(jsonify({"message": "Payment is already completed"}), 400)

        data = request.get_json() or {}
        payment.payment_status = 'Completed'
        payment.payment_method = data.get('payment_method', 'Card')
        payment.paid_at = datetime.utcnow()
        payment.transaction_id = str(uuid.uuid4())
        db.session.commit()

        return make_response(jsonify({
            "message": "Payment processed successfully",
            "transaction_id": payment.transaction_id
        }), 200)