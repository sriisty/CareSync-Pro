from flask_restful import Resource, reqparse
from flask import jsonify, make_response, request
from model import *
from security import *
from flask_security import utils 
from flask_jwt_extended import create_access_token, get_jwt, jwt_required


class LoginAPI(Resource):
    def post(self):
        login_credentials=request.get_json() #The data sent by the user from frontend to backend during login,stored as a dictionary.
        print("Received login credentials:", login_credentials)  # Debugging statement
        
        if not login_credentials:
            result={"message":"No input data provided"}
            return make_response(jsonify(result), 400)
        
        email=login_credentials.get('email')
        password=login_credentials.get('password')

        if not email or not password:
            result={"message":"Email and password are required"}
            return make_response(jsonify(result), 400)
        
        user=Users.query.filter_by(email=email).first()
        if not user:
            result={'message':'User not found'}
            return make_response(jsonify(result), 404)
        #if not utils.verify_password(password, user.password):
        if password != user.password:
            result={'message':'Invalid password'}
            return make_response(jsonify(result), 401)

        access_token=create_access_token(identity=user) #Whenever I pass a User object into create_access_token(identity=user), store user.email inside the token.
        print("Generated access token:", access_token)  # Debugging statement
        response={"message":"Login successful",
                  "login details":{
                      "email":user.email,
                      "usertype":user.usertype,
                      "auth_token":access_token}}
        return make_response(jsonify(response), 200)

class LogoutAPI(Resource):
    @jwt_required()#route can only be accessed if a valid JWT token is sent
    def post(self):
        jti = get_jwt()["jti"] #gets user jwt id 
        blocklist.add(jti)
        response={"message":"Logout successful"}
        return make_response(jsonify(response), 200)

class RegisterAPI(Resource):
    def post(self):
        registration_data=request.get_json()
        print("Received registration data:", registration_data)  # Debugging statement
        
        if not registration_data:
            result={"message":"No input data provided"}
            return make_response(jsonify(result), 400)
        name=registration_data.get('name')
        email=registration_data.get('email')
        password=registration_data.get('password')
        usertype=registration_data.get('usertype')
        contact=registration_data.get('contact')
        dob=registration_data.get('dob')
        gender=registration_data.get('gender')
        address=registration_data.get('address')
        medical_history=registration_data.get('medical_history')

        if not email or not password :
            result={"message":"Email, password and usertype are required"}
            return make_response(jsonify(result), 400)
        
        if Users.query.filter_by(email=email).first():
            result={"message":"User with this email already exists"}
            return make_response(jsonify(result), 409)
        
        new_user=Users(name=name, email=email, password=password, usertype=usertype)
        db.session.add(new_user)
        db.session.flush()
        if usertype=='patient':
            try:
                if dob:
                    parsed_dob = datetime.strptime(dob, '%Y-%m-%d').date()
                else:
                    parsed_dob = datetime.utcnow().date() # Fallback if not provided
            except ValueError:
                return make_response(jsonify({"message": "Invalid DOB format (YYYY-MM-DD)"}), 400)
                
            new_patient=Patient(
                user_id=new_user.id, 
                name=name , 
                email=email, 
                contact=contact or 'Not Provided',
                age=registration_data.get('age') or 0,
                dob=parsed_dob, 
                gender=gender or 'Unknown', 
                address=address or 'Not Provided', 
                medical_history=medical_history or ''
            )
            db.session.add(new_patient)
            
        db.session.commit()

        response={"message":"Registration successful",
                  "user details":{
                      "username":new_user.name,
                      "email":new_user.email,
                      "usertype":new_user.usertype}}
        return make_response(jsonify(response), 201)
    #def get(self):
    #def put(self):
