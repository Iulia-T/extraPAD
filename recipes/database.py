from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    ingredients = db.Column(db.Text, nullable=False)
    instructions = db.Column(db.Text, nullable=False)