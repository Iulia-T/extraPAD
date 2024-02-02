from flask import Flask, jsonify, request
import requests
from database import db, init_db, Team, Player

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mydatabase.db'
db.init_app(app)

init_db(app)

API_KEY = "5ab78f5d65mshf723fa760a7b79ap1e3493jsn9efb24d7773a"
API_HOST = "api-nba-v1.p.rapidapi.com"
HEADERS = {
    'X-RapidAPI-Key': API_KEY,
    'X-RapidAPI-Host': API_HOST
}


def api_nba_request(endpoint):
    url = f"https://{API_HOST}/{endpoint}"
    response = requests.get(url, headers=HEADERS)
    return response.json()


@app.route('/getAllPlayers', methods=['GET'])
def get_all_players():
    url = f"https://{API_HOST}/players"
    querystring = {"team": "1", "season": "2021"}

    response = requests.get(url, headers=HEADERS, params=querystring)
    if response.status_code == 200:
        players_data = response.json()
        if 'response' in players_data:
            for player_info in players_data['response']:
                existing_player = db.session.get(Player, player_info['id'])
                if existing_player is None:
                    player = Player(
                        id=player_info['id'],
                        name=f"{player_info['firstname']} {player_info['lastname']}",
                        height=player_info.get('height', {}).get('meters'),
                        weight=player_info.get('weight', {}).get('kilograms')
                    )
                    db.session.add(player)
            db.session.commit()
            all_players = Player.query.all()
            return jsonify([{
                'id': player.id,
                'name': player.name,
                'height': player.height,
                'weight': player.weight
            } for player in all_players])
        else:
            return jsonify({'error': 'Invalid API response format'})
    else:
        return jsonify({'error': f'API request failed with status {response.status_code}'})


@app.route('/getTeamsInfo', methods=['GET'])
def get_teams_info():
    url = f"https://{API_HOST}/teams"
    response = requests.get(url, headers=HEADERS)
    if response.status_code == 200:
        teams_data = response.json()
        if 'response' in teams_data:
            for team_info in teams_data['response']:
                existing_team = db.session.get(Team, team_info['id'])
                if existing_team is None:
                    new_team = Team(
                        id=team_info['id'],
                        name=team_info['name'],
                        city=team_info.get('city', 'N/A'),
                        nickname=team_info.get('nickname', 'N/A')
                    )
                    db.session.add(new_team)
            db.session.commit()
            all_teams = Team.query.all()
            return jsonify([{
                'id': team.id,
                'name': team.name,
                'city': team.city,
                'nickname': team.nickname
            } for team in all_teams])
        else:
            return jsonify({'error': 'Invalid API response format'})
    else:
        return jsonify({'error': f'API request failed with status {response.status_code}'})


@app.route('/getTeamInfo/<path:identifier>', methods=['GET'])
def get_specific_team_info(identifier):
    try:
        team_id = int(identifier)
        team = Team.query.get(team_id)
    except ValueError:
        team = Team.query.filter_by(name=identifier).first()

    if team:
        return jsonify({
            'id': team.id,
            'name': team.name,
            'city': team.city,
            'nickname': team.nickname
        })
    else:
        return jsonify({'error': 'Team not found'}), 404
    

@app.route('/getPlayerInfo/<path:identifier>', methods=['GET'])
def get_specific_player_info(identifier):
    try:
        # Attempt to interpret the identifier as an ID
        player_id = int(identifier)
        player = Player.query.get(player_id)
    except ValueError:
        # If not an ID, attempt to find the player by name
        player = Player.query.filter_by(name=identifier).first()

    if player:
        return jsonify({
            'id': player.id,
            'name': player.name,
            'height': player.height,
            'weight': player.weight
        })
    else:
        return jsonify({'error': 'Player not found'}), 404    


@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "Service is up and running"})


if __name__ == '__main__':
    app.run(debug=True)
