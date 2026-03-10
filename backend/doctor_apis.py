from flask_restful import Resource, request
from flask import jsonify, make_response
from model import *
from security import *
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timedelta
from cache import cache


class DoctorAssignedAppointmentAPI(Resource):
    @doctor_required
    @jwt_required()
    def get(self):
        doctor = Doctor.query.filter_by(user_id=current_user.id).first()
        if not doctor:
            return make_response(jsonify({"message": "Doctor profile not found"}), 404)

        filter_type = request.args.get('filter')
        query = Appointment.query.filter_by(doctor_id=doctor.id)

        today_start = datetime.combine(datetime.today(), datetime.min.time())
        if filter_type == 'today':
            today_end = datetime.combine(datetime.today(), datetime.max.time())
            query = query.filter(
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date <= today_end
            )
        elif filter_type == 'week':
            week_end = today_start + timedelta(days=7)
            query = query.filter(
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date <= week_end
            )

        appointments = query.order_by(
            Appointment.appointment_date.asc(),
            Appointment.appointment_time.asc()
        ).all()

        result = [
            {
                "id": apt.id,
                "patient_name": apt.patient.name if apt.patient else None,
                "patient_id": apt.patient_id,
                "date": str(apt.appointment_date.date()),
                "time": str(apt.appointment_time),
                "status": apt.status
            }
            for apt in appointments
        ]

        return make_response(jsonify({"message": "Assigned appointments", "appointments": result}), 200)

    @doctor_required
    @jwt_required()
    def put(self, id):
        doctor = Doctor.query.filter_by(user_id=current_user.id).first()
        if not doctor:
            return make_response(jsonify({"message": "Doctor profile not found"}), 404)

        apt = Appointment.query.filter_by(id=id, doctor_id=doctor.id).first()
        if not apt:
            return make_response(jsonify({"message": "Appointment not found or unauthorized"}), 404)

        data = request.get_json()
        if not data:
            return make_response(jsonify({"message": "No input provided"}), 400)

        status = data.get('status')
        if status == 'cancelled':
            apt.status = 'cancelled'
            db.session.commit()
            # Invalidate patient appointment cache
            cache.delete(f"patient_appointments_{apt.patient_id}")
            return make_response(jsonify({"message": "Appointment cancelled"}), 200)

        apt.status = 'completed'
        diagnosis = data.get('diagnosis')
        prescription = data.get('prescription')
        notes = data.get('notes', '')

        if not diagnosis or not prescription:
            return make_response(jsonify({"message": "Diagnosis and prescription are mandatory to complete visit"}), 400)

        next_visit = data.get('next_visit_date')
        next_visit_date = None
        if next_visit:
            try:
                next_visit_date = datetime.strptime(next_visit, '%Y-%m-%d')
            except ValueError:
                return make_response(jsonify({"message": "Invalid next visit date format (YYYY-MM-DD)"}), 400)

        treatment = Treatment(
            appointment_id=apt.id,
            diagnosis=diagnosis,
            prescription=prescription,
            notes=notes,
            next_visit_date=next_visit_date
        )
        db.session.add(treatment)
        db.session.flush()

        payment = Payment(
            patient_id=apt.patient_id,
            treatment_id=treatment.id,
            amount=500.0,
            payment_status='Pending'
        )
        db.session.add(payment)
        db.session.commit()

        # Invalidate patient appointment cache and doctor's patient list
        cache.delete(f"patient_appointments_{apt.patient_id}")
        cache.delete(f"doctor_patients_{doctor.id}")
        cache.delete(f"patient_history_{apt.patient_id}")

        return make_response(jsonify({"message": "Visit completed, treatment recorded, and invoice generated"}), 200)


class DoctorPatientHistoryAPI(Resource):
    @doctor_required
    @jwt_required()
    def get(self, patient_id):
        doctor = Doctor.query.filter_by(user_id=current_user.id).first()
        if not doctor:
            return make_response(jsonify({"message": "Doctor profile not found"}), 404)

        # ── Cached patient history ───────────────────────────────────────────
        cache_key = f"patient_history_{patient_id}"
        cached = cache.get(cache_key)
        if cached:
            return make_response(jsonify(cached), 200)

        patient = Patient.query.get(patient_id)
        if not patient:
            return make_response(jsonify({"message": "Patient not found"}), 404)

        treatments = Treatment.query.join(Appointment).filter(
            Appointment.patient_id == patient_id
        ).all()

        result = [
            {
                "treatment_id": t.id,
                "appointment_id": t.appointment_id,
                "doctor_name": t.appointment.doctor.name if t.appointment.doctor else None,
                "date": str(t.appointment.appointment_date.date()),
                "diagnosis": t.diagnosis,
                "prescription": t.prescription,
                "notes": t.notes
            }
            for t in treatments
        ]

        response = {
            "message": "Patient Medical History",
            "patient_name": patient.name,
            "patient_id": patient.id,
            "history": result
        }
        cache.set(cache_key, response, timeout=300)
        return make_response(jsonify(response), 200)

    @doctor_required
    @jwt_required()
    def put(self, patient_id):
        doctor = Doctor.query.filter_by(user_id=current_user.id).first()
        if not doctor:
            return make_response(jsonify({"message": "Doctor profile not found"}), 404)

        patient = Patient.query.get(patient_id)
        if not patient:
            return make_response(jsonify({"message": "Patient not found"}), 404)

        data = request.get_json()
        new_history = data.get('medical_history')
        if new_history is not None:
            patient.medical_history = new_history
            db.session.commit()
            cache.delete(f"patient_history_{patient_id}")
            return make_response(jsonify({"message": "Patient general medical history updated"}), 200)

        return make_response(jsonify({"message": "No new history provided"}), 400)


class DoctorPatientsListAPI(Resource):
    @doctor_required
    @jwt_required()
    def get(self):
        doctor = Doctor.query.filter_by(user_id=current_user.id).first()
        if not doctor:
            return make_response(jsonify({"message": "Doctor profile not found"}), 404)

        # ── Cached patients list per doctor ──────────────────────────────────
        cache_key = f"doctor_patients_{doctor.id}"
        cached = cache.get(cache_key)
        if cached:
            return make_response(jsonify(cached), 200)

        patients = Patient.query.join(Appointment).filter(
            Appointment.doctor_id == doctor.id
        ).distinct().all()

        result = [
            {
                "patient_id": p.id,
                "name": p.name,
                "gender": p.gender,
                "age": p.age,
                "contact": p.contact,
                "medical_history": p.medical_history
            }
            for p in patients
        ]

        response = {"message": "Assigned patients list", "patients": result}
        cache.set(cache_key, response, timeout=180)
        return make_response(jsonify(response), 200)


class DoctorScheduleAPI(Resource):
    @doctor_required
    @jwt_required()
    def get(self):
        doctor = Doctor.query.filter_by(user_id=current_user.id).first()
        if not doctor:
            return make_response(jsonify({"message": "Doctor profile not found"}), 404)

        # ── Cached schedule ──────────────────────────────────────────────────
        cache_key = f"doctor_schedule_{doctor.id}"
        cached = cache.get(cache_key)
        if cached:
            return make_response(jsonify(cached), 200)

        schedules = DoctorSchedule.query.filter_by(doctor_id=doctor.id).all()
        result = [
            {
                "id": s.id,
                "day_of_week": s.day_of_week,
                "start_time": str(s.start_time),
                "end_time": str(s.end_time),
                "is_available": s.is_available
            }
            for s in schedules
        ]

        response = {"message": "Doctor Schedule", "schedule": result}
        cache.set(cache_key, response, timeout=300)
        return make_response(jsonify(response), 200)

    @doctor_required
    @jwt_required()
    def post(self):
        doctor = Doctor.query.filter_by(user_id=current_user.id).first()
        if not doctor:
            return make_response(jsonify({"message": "Doctor profile not found"}), 404)

        data = request.get_json()
        if not data or not isinstance(data, list):
            return make_response(jsonify({"message": "Provide a list of schedule items"}), 400)

        DoctorSchedule.query.filter_by(doctor_id=doctor.id).delete()

        for item in data:
            day = item.get('day_of_week')
            try:
                start_time = datetime.strptime(item.get('start_time'), '%H:%M').time()
                end_time = datetime.strptime(item.get('end_time'), '%H:%M').time()
            except (ValueError, TypeError):
                db.session.rollback()
                return make_response(jsonify({"message": f"Invalid time format for {day}, use HH:MM"}), 400)

            is_available = item.get('is_available', True)
            schedule = DoctorSchedule(
                doctor_id=doctor.id,
                day_of_week=day,
                start_time=start_time,
                end_time=end_time,
                is_available=is_available
            )
            db.session.add(schedule)

        db.session.commit()

        # Invalidate schedule cache
        cache.delete(f"doctor_schedule_{doctor.id}")

        return make_response(jsonify({"message": "Schedule updated successfully"}), 201)