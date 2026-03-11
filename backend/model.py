from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Users(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    usertype=db.Column(db.String(20),nullable=False,default='patient')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    doctor = db.relationship('Doctor', backref='user', uselist=False, cascade='all, delete-orphan')
    patient = db.relationship('Patient', backref='user', uselist=False, cascade='all, delete-orphan')

class Doctor(db.Model):
    __tablename__ = 'doctors'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name=db.Column(db.String(100),nullable=False)
    contact=db.Column(db.String(20),nullable=False)
    department_id=db.Column(db.Integer,db.ForeignKey('departments.id'),nullable=False)
    experience = db.Column(db.Integer, nullable=False)
    qualification = db.Column(db.String(200), nullable=False)

    #Relationships
    department = db.relationship('Department', backref='doctors')
    schedules = db.relationship('DoctorSchedule', backref='doctor', cascade='all, delete-orphan')

class Department(db.Model):
    __tablename__ = 'departments'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)


class Patient(db.Model):
    __tablename__ = 'patients'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name=db.Column(db.String(100),nullable=False)
    email=db.Column(db.String(120), unique=True, nullable=False)
    contact=db.Column(db.String(20),nullable=False)
    age=db.Column(db.Integer,nullable=False)
    dob=db.Column(db.Date,nullable=False)
    gender=db.Column(db.String(10),nullable=False)
    address=db.Column(db.String(200),nullable=False)
    medical_history=db.Column(db.Text,nullable=True)

    #Relationships
    appointments = db.relationship('Appointment', backref='patient', cascade='all, delete-orphan')


class Appointment(db.Model):
    __tablename__ = 'appointments'
    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    appointment_date = db.Column(db.DateTime, nullable=False)
    appointment_time = db.Column(db.Time, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='scheduled') #'booked', 'completed', 'cancelled'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    #Relationships
    doctor = db.relationship('Doctor', backref='appointments')

    # Composite unique constraint to prevent double booking
    __table_args__ = (
        db.UniqueConstraint('doctor_id', 'appointment_date', 'appointment_time', 
                          name='unique_doctor_appointment'),
    )

class Treatment(db.Model):
    __tablename__ = 'treatments'
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'), nullable=False)
    diagnosis = db.Column(db.Text, nullable=False)
    prescription = db.Column(db.Text, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    next_visit_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    #Relationships   
    appointment = db.relationship('Appointment', backref='treatment')

class DoctorSchedule(db.Model):
    __tablename__ = 'doctor_schedules'
    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=False)
    available_date = db.Column(db.Date, nullable=True)
    day_of_week = db.Column(db.String(20), nullable=False) # e.g., 'Monday', 'Tuesday'
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_available = db.Column(db.Boolean, default=True)


def create_admin(): #creating admin
    try:
        admin=Users.query.filter_by(email='admin@gmail.com').first()
        if not admin:
            admin=Users(name='Admin',
                        email='admin@gmail.com',
                        password='admin123',
                        usertype='admin',
                        is_active=True)
            db.session.add(admin)
            db.session.commit()
            print("Default admin user created successfully.")
    except Exception as e:
        print(f"Error creating default admin user: {e}")
