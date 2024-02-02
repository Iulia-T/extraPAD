from flask import Flask, jsonify, request
from database import db, Recipe

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///recipes.db'
db.init_app(app)

# Initialize the database outside of a Flask request context
with app.app_context():
    db.create_all()

@app.route('/addRecipes', methods=['POST'])
def add_recipes():
    recipes_data = request.json  # Expecting a list of recipes
    for data in recipes_data:
        recipe = Recipe(
            name=data['name'],
            ingredients=data['ingredients'],
            instructions=data['instructions']
        )
        db.session.add(recipe)
    db.session.commit()
    return jsonify({"message": "Recipes added successfully"}), 201

@app.route('/getRecipes', methods=['GET'])
def get_recipes():
    recipes = Recipe.query.all()
    return jsonify([{
        'id': recipe.id,
        'name': recipe.name,
        'ingredients': recipe.ingredients,
        'instructions': recipe.instructions
    } for recipe in recipes])

@app.route('/getRecipe/<int:recipe_id>', methods=['GET'])
def get_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    return jsonify({
        'id': recipe.id,
        'name': recipe.name,
        'ingredients': recipe.ingredients,
        'instructions': recipe.instructions
    })

@app.route('/removeRecipe/<int:recipe_id>', methods=['DELETE'])
def remove_recipe(recipe_id):
    recipe = Recipe.query.get_or_404(recipe_id)
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({"message": "Recipe removed"}), 200

@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "Recipes service is up and running"})

if __name__ == '__main__':
    app.run(port=5001, debug=True)
