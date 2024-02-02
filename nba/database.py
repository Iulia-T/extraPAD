from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db(app):
    with app.app_context():
        db.create_all()

class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    height = db.Column(db.String(20))
    weight = db.Column(db.String(20))

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    city = db.Column(db.String(80))
    nickname = db.Column(db.String(80))  

