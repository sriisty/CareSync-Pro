from flask_jwt_extended import JWTManager,jwt_required,current_user
from model import *
from functools import wraps

jwt=JWTManager()

@jwt.user_identity_loader
def load(user):
    return user.email

@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity=jwt_data["sub"]
    return Users.query.filter_by(email=identity).one_or_none()

blocklist = set()

@jwt.token_in_blocklist_loader 
def check_if_token_revoked(jwt_header, jwt_payload):#
    return jwt_payload["jti"] in blocklist

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if current_user.usertype != "admin":
            return {"message": "Admin access required"}, 403
        return fn(*args, **kwargs)
    return wrapper

def doctor_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if current_user.usertype != "doctor":
            return {"message": "Doctor access required"}, 403
        return fn(*args, **kwargs)
    return wrapper

def patient_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if current_user.usertype != "patient":
            return {"message": "Patient access required"}, 403
        return fn(*args, **kwargs)
    return wrapper
