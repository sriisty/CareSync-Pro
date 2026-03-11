from model import *
from security import *
from flask import Flask, jsonify, make_response, request
import os
from login_api import LoginAPI, LogoutAPI, RegisterAPI
from flask_restful import Api, Resource
from cache import cache

#  Cache key constants
CACHE_KEY_ADMIN_DASHBOARD = "admin_dashboard"
CACHE_KEY_DOCTOR_LIST     = "doctor_list_all"
CACHE_KEY_DEPT_LIST       = "department_list_all"


class DoctorAPI(Resource):
    def get(self, id=None):
        if id:
            doctor_info = Doctor.query.get(id)
            if not doctor_info:
                return make_response(jsonify({'message': 'no doctor found'}), 404)
            response = {
                "message": "doctor found",
                "doctor details": {
                    "id": doctor_info.id,
                    "name": doctor_info.name,
                    "contact": doctor_info.contact,
                    "department_id": doctor_info.department_id,
                    "department_name": doctor_info.department.name if doctor_info.department else None,
                    "experience": doctor_info.experience,
                    "qualification": doctor_info.qualification
                }
            }
            return make_response(jsonify(response), 200)

        # Cached doctor list
        cached = cache.get(CACHE_KEY_DOCTOR_LIST)
        if cached:
            return make_response(jsonify(cached), 200)

        doctor_list = Doctor.query.all()
        response = {
            "message": "doctor list",
            "doctor details": [
                {
                    "id": doctor.id,
                    "name": doctor.name,
                    "contact": doctor.contact,
                    "department_id": doctor.department_id,
                    "department_name": doctor.department.name if doctor.department else None,
                    "experience": doctor.experience,
                    "qualification": doctor.qualification
                }
                for doctor in doctor_list
            ]
        }
        cache.set(CACHE_KEY_DOCTOR_LIST, response, timeout=300)
        return make_response(jsonify(response), 200)

    @admin_required
    def post(self):
        data = request.get_json()
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        contact = data.get("contact")
        department_id = data.get("department_id")
        experience = data.get("experience")
        qualification = data.get("qualification")

        if not name or not email or not password:
            return {"message": "name, email and password required"}, 400
        if not contact or not department_id:
            return {"message": "doctor info incomplete"}, 400

        existing_user = Users.query.filter_by(email=email).first()
        if existing_user:
            return {"message": "email already exists"}, 409

        dept = Department.query.get(department_id)
        if not dept:
            return {"message": "department not found"}, 404

        new_user = Users(name=name, email=email, password=password, usertype="doctor")
        db.session.add(new_user)
        db.session.flush()

        new_doctor = Doctor(
            user_id=new_user.id, name=name, contact=contact,
            department_id=department_id, experience=experience,
            qualification=qualification
        )
        db.session.add(new_doctor)
        db.session.commit()

        # Invalidate caches
        cache.delete(CACHE_KEY_DOCTOR_LIST)
        cache.delete(CACHE_KEY_ADMIN_DASHBOARD)

        return {"message": "Doctor created successfully"}, 201

    @admin_required
    def put(self, id):
        data = request.get_json()
        doc_info = Doctor.query.get(id)
        if not doc_info:
            return make_response(jsonify({'message': 'doc not found'}), 404)
        if not data:
            return make_response(jsonify({"message": "no input provided"}), 400)

        doc_info.name = data.get('name', doc_info.name)
        doc_info.contact = data.get('contact', doc_info.contact)
        doc_info.department_id = data.get('department_id', doc_info.department_id)
        doc_info.experience = data.get('experience', doc_info.experience)
        doc_info.qualification = data.get('qualification', doc_info.qualification)
        db.session.commit()

        # Invalidate caches
        cache.delete(CACHE_KEY_DOCTOR_LIST)
        cache.delete(f"doctor_{id}")
        cache.delete(CACHE_KEY_ADMIN_DASHBOARD)

        return {"message": "Doctor updated"}

    @admin_required
    @jwt_required()
    def delete(self, id):
        doc_info = Doctor.query.get(id)
        if not doc_info:
            return make_response(jsonify({'message': 'doc not found'}), 404)
        user = Users.query.get(doc_info.user_id)
        db.session.delete(doc_info)
        if user:
            db.session.delete(user)
        db.session.commit()

        # Invalidate caches
        cache.delete(CACHE_KEY_DOCTOR_LIST)
        cache.delete(CACHE_KEY_ADMIN_DASHBOARD)

        return {"message": "Doctor deleted"}


class DepartmentAPI(Resource):
    def get(self, id=None):
        if id:
            department_info = Department.query.get(id)
            if not department_info:
                return make_response(jsonify({'message': 'department not found'}), 404)
            response = {
                "message": "department found",
                "department details": {
                    "id": department_info.id,
                    "name": department_info.name,
                    "description": department_info.description
                }
            }
            return make_response(jsonify(response), 200)

        # Cached department list
        cached = cache.get(CACHE_KEY_DEPT_LIST)
        if cached:
            return make_response(jsonify(cached), 200)

        department_list = Department.query.all()
        response = {
            "message": "department list",
            "department details": [
                {"id": d.id, "name": d.name, "description": d.description}
                for d in department_list
            ]
        }
        cache.set(CACHE_KEY_DEPT_LIST, response, timeout=600)
        return make_response(jsonify(response), 200)

    @admin_required
    @jwt_required()
    def post(self):
        department_data = request.get_json()
        if not department_data:
            return make_response(jsonify({"message": "no input data provided"}), 400)
        name = department_data.get('name')
        description = department_data.get('description')
        if not name or not description:
            return make_response(jsonify({"message": "all fields are required"}), 400)

        new_department = Department(name=name, description=description)
        db.session.add(new_department)
        db.session.commit()

        cache.delete(CACHE_KEY_DEPT_LIST)

        return make_response(jsonify({
            "message": "department added successfully",
            "department details": {
                "id": new_department.id,
                "name": new_department.name,
                "description": new_department.description
            }
        }), 201)

    @admin_required
    @jwt_required()
    def put(self, id):
        data = request.get_json()
        dept_info = Department.query.get(id)
        if not dept_info:
            return make_response(jsonify({'message': 'department not found'}), 404)
        if not data:
            return make_response(jsonify({"message": "no input provided"}), 400)

        dept_info.name = data.get('name', dept_info.name)
        dept_info.description = data.get('description', dept_info.description)
        db.session.commit()

        cache.delete(CACHE_KEY_DEPT_LIST)
        cache.delete(CACHE_KEY_DOCTOR_LIST)  # doctor list includes dept names

        return {"message": "Department updated"}

    @admin_required
    @jwt_required()
    def delete(self, id):
        dept_info = Department.query.get(id)
        if not dept_info:
            return make_response(jsonify({'message': 'department not found'}), 404)
        db.session.delete(dept_info)
        db.session.commit()

        cache.delete(CACHE_KEY_DEPT_LIST)
        cache.delete(CACHE_KEY_DOCTOR_LIST)

        return {"message": "Department deleted"}


class AdminDoctorSearchAPI(Resource):
    @admin_required
    @cache.cached(timeout=120, query_string=True)
    def get(self):
        name = request.args.get('name')
        department = request.args.get('department')
        query = Doctor.query
        if name:
            query = query.filter(Doctor.name.ilike(f'%{name}%'))
        if department:
            query = query.join(Department).filter(Department.name.ilike(f'%{department}%'))
        doctors = query.all()
        response = {
            "message": "doctor search results",
            "doctor details": [
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


class AdminPatientAPI(Resource):
    @admin_required
    def get(self, id=None):
        name = request.args.get('name')
        search_id = request.args.get('id')
        contact = request.args.get('contact')

        if id:
            # Per-patient cache
            cache_key = f"patient_{id}"
            cached = cache.get(cache_key)
            if cached:
                return make_response(jsonify(cached), 200)

            patient_info = Patient.query.get(id)
            if not patient_info:
                return make_response(jsonify({'message': 'patient not found'}), 404)
            response = {
                "message": "patient found",
                "patient details": {
                    "id": patient_info.id,
                    "name": patient_info.name,
                    "contact": patient_info.contact,
                    "age": patient_info.age,
                    "dob": str(patient_info.dob),
                    "gender": patient_info.gender,
                    "address": patient_info.address
                }
            }
            cache.set(cache_key, response, timeout=300)
            return make_response(jsonify(response), 200)

        # No list caching — always query fresh so search filters work correctly
        query = Patient.query
        if name:
            query = query.filter(Patient.name.ilike(f'%{name}%'))
        if search_id:
            query = query.filter(Patient.id == search_id)
        if contact:
            query = query.filter(Patient.contact.ilike(f'%{contact}%'))
        patients = query.all()
        response = {
            "message": "patient list",
            "patient details": [
                {"id": p.id, "name": p.name, "contact": p.contact, "age": p.age, "gender": p.gender}
                for p in patients
            ]
        }
        return make_response(jsonify(response), 200)

    @admin_required
    @jwt_required()
    def post(self):
        registration_data = request.get_json()
        if not registration_data:
            return make_response(jsonify({'message': 'no input provided'}), 400)
        name = registration_data.get('name')
        email = registration_data.get('email')
        password = registration_data.get('password')
        contact = registration_data.get('contact')
        dob = registration_data.get('dob')
        gender = registration_data.get('gender')
        address = registration_data.get('address')
        medical_history = registration_data.get('medical_history')
        if not email or not password:
            return make_response(jsonify({"message": "Email and password are required"}), 400)
        if Users.query.filter_by(email=email).first():
            return make_response(jsonify({"message": "User with this email already exists"}), 409)
        new_user = Users(name=name, email=email, password=password, usertype='patient')
        db.session.add(new_user)
        db.session.flush()
        try:
            parsed_dob = datetime.strptime(dob, '%Y-%m-%d').date() if dob else datetime.utcnow().date()
        except ValueError:
            return make_response(jsonify({"message": "Invalid DOB format (YYYY-MM-DD)"}), 400)
        new_patient = Patient(
            user_id=new_user.id, name=name, email=email,
            contact=contact or 'Not Provided',
            age=registration_data.get('age') or 0,
            dob=parsed_dob, gender=gender or 'Unknown',
            address=address or 'Not Provided',
            medical_history=medical_history or ''
        )
        db.session.add(new_patient)
        db.session.commit()

        cache.delete(CACHE_KEY_ADMIN_DASHBOARD)
        return make_response(jsonify({'message': 'patient created successfully'}), 201)

    @admin_required
    @jwt_required()
    def put(self, id):
        data = request.get_json()
        patient = Patient.query.get(id)
        if not patient:
            return make_response(jsonify({'message': 'patient not found'}), 404)
        if not data:
            return make_response(jsonify({'message': 'no input provided'}), 400)
        patient.name = data.get('name', patient.name)
        patient.contact = data.get('contact', patient.contact)
        patient.age = data.get('age', patient.age)
        patient.gender = data.get('gender', patient.gender)
        patient.address = data.get('address', patient.address)
        db.session.commit()

        cache.delete(f"patient_{id}")
        return make_response(jsonify({'message': 'patient updated successfully'}), 200)

    @admin_required
    @jwt_required()
    def delete(self, id):
        patient = Patient.query.get(id)
        if not patient:
            return make_response(jsonify({'message': 'patient not found'}), 404)
        user = Users.query.get(patient.user_id)
        db.session.delete(patient)
        if user:
            db.session.delete(user)
        db.session.commit()

        cache.delete(f"patient_{id}")
        cache.delete(CACHE_KEY_ADMIN_DASHBOARD)
        return make_response(jsonify({'message': 'patient and associated user account deleted'}), 200)


class AdminAppointmentAPI(Resource):
    @admin_required
    def get(self, id=None):
        if id:
            appointment = Appointment.query.get(id)
            if not appointment:
                return make_response(jsonify({'message': 'appointment not found'}), 404)
            response = {
                "message": "appointment details",
                "appointment": {
                    "id": appointment.id,
                    "doctor_name": appointment.doctor.name if appointment.doctor else None,
                    "patient_name": appointment.patient.name if appointment.patient else None,
                    "date": str(appointment.appointment_date.date()),
                    "time": str(appointment.appointment_time),
                    "status": appointment.status
                }
            }
            return make_response(jsonify(response), 200)

        appointments = Appointment.query.all()
        response = {
            "message": "all appointments",
            "appointments": [
                {
                    "id": apt.id,
                    "doctor_name": apt.doctor.name if apt.doctor else None,
                    "patient_name": apt.patient.name if apt.patient else None,
                    "date": str(apt.appointment_date.date()),
                    "time": str(apt.appointment_time),
                    "status": apt.status
                } for apt in appointments
            ]
        }
        return make_response(jsonify(response), 200)

    @admin_required
    @jwt_required()
    def put(self, id):
        data = request.get_json()
        appointment = Appointment.query.get(id)
        if not appointment:
            return make_response(jsonify({'message': 'appointment not found'}), 404)
        new_status = data.get('status')
        if new_status:
            appointment.status = new_status
            db.session.commit()
            cache.delete(CACHE_KEY_ADMIN_DASHBOARD)
            return make_response(jsonify({'message': 'appointment status updated', 'status': new_status}), 200)
        return make_response(jsonify({'message': 'no valid updates provided'}), 400)


class AdminDashboardAPI(Resource):
    @admin_required
    def get(self):
        # Cached dashboard stats
        cached = cache.get(CACHE_KEY_ADMIN_DASHBOARD)
        if cached:
            return make_response(jsonify(cached), 200)

        total_doctors = Doctor.query.count()
        total_patients = Patient.query.count()
        total_appointments = Appointment.query.count()
        completed_appointments = Appointment.query.filter_by(status='completed').count()
        scheduled_appointments = Appointment.query.filter_by(status='scheduled').count()
        cancelled_appointments = Appointment.query.filter_by(status='cancelled').count()
        total_departments = Department.query.count()

        response = {
            "message": "Admin Dashboard Statistics",
            "statistics": {
                "total_doctors": total_doctors,
                "total_patients": total_patients,
                "total_appointments": total_appointments,
                "completed_appointments": completed_appointments,
                "scheduled_appointments": scheduled_appointments,
                "cancelled_appointments": cancelled_appointments,
                "total_departments": total_departments
            }
        }
        cache.set(CACHE_KEY_ADMIN_DASHBOARD, response, timeout=60)
        return make_response(jsonify(response), 200)
