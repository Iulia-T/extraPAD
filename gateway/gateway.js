const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const NBA_SERVICE_URL = 'http://localhost:5000';
const RECIPES_SERVICE_URL = 'http://localhost:5001';

// Helper function to handle errors
function handleError(res, error) {
    console.error('Error occurred:', error.response || error.message);
    res.status(error.response ? error.response.status : 500).json({
        message: 'Error forwarding the request',
        error: error.response ? error.response.data : error.message
    });
}

// Route forwarding function
function forwardRequest(serviceBaseUrl) {
    return async (req, res) => {
        const servicePath = req.originalUrl.split('/').slice(2).join('/'); // Remove the first part of the path ('/nba' or '/recipes')
        const url = `${serviceBaseUrl}/${servicePath}`;
        
        try {
            const axiosConfig = {
                method: req.method,
                url: url,
                ...(Object.keys(req.body || {}).length > 0 && { data: req.body }),
                headers: { ...req.headers, 'Content-Length': JSON.stringify(req.body).length }
            };

            const response = await axios(axiosConfig);
            res.status(response.status).json(response.data);
        } catch (error) {
            handleError(res, error);
        }
    };
}

// Forwarding requests to NBA service
app.use('/nba/*', forwardRequest(NBA_SERVICE_URL));

// Forwarding requests to Recipes service
app.use('/recipes/*', forwardRequest(RECIPES_SERVICE_URL));

// Endpoint to get a recipe by team ID or name
app.get('/recipe-by-team/:teamIdOrName', async (req, res) => {
    const identifier = req.params.teamIdOrName;
    const isNumeric = /^\d+$/.test(identifier); // Check if identifier is numeric (ID)
    const teamEndpoint = isNumeric ? `/getTeamInfo/${identifier}` : `/getTeamInfo/${identifier}`; // Adjust based on your nba.py routing

    try {
        const teamResponse = await axios.get(`${NBA_SERVICE_URL}${teamEndpoint}`);
        const recipesResponse = await axios.get(`${RECIPES_SERVICE_URL}/getRecipes`);
        const randomRecipe = recipesResponse.data[Math.floor(Math.random() * recipesResponse.data.length)];
        res.json({ team: teamResponse.data, recipe: randomRecipe });
    } catch (error) {
        handleError(res, error);
    }
});

// Helper function to determine if the identifier is numeric (ID)
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

// Endpoint to get a recipe by player ID or name
app.get('/recipe-by-player/:playerIdOrName', async (req, res) => {
    const identifier = req.params.playerIdOrName;
    // Determine the correct endpoint based on whether the identifier is numeric
    const playerEndpoint = isNumeric(identifier) ? `/getPlayerInfo/${identifier}` : `/getPlayerInfo/${identifier}`;

    try {
        const playerResponse = await axios.get(`${NBA_SERVICE_URL}${playerEndpoint}`);
        const recipesResponse = await axios.get(`${RECIPES_SERVICE_URL}/getRecipes`);
        const randomRecipe = recipesResponse.data[Math.floor(Math.random() * recipesResponse.data.length)];
        res.json({ player: playerResponse.data, recipe: randomRecipe });
    } catch (error) {
        handleError(res, error);
    }
});

// General status check
app.get('/status', (req, res) => {
    res.json({ message: 'Gateway is running' });
});

// Endpoint to check the status of both NBA and Recipes services
app.get('/services-status', async (req, res) => {
    try {
        const nbaStatusResponse = await axios.get(`${NBA_SERVICE_URL}/status`);
        const recipesStatusResponse = await axios.get(`${RECIPES_SERVICE_URL}/status`);
        res.json({
            nbaService: nbaStatusResponse.data,
            recipesService: recipesStatusResponse.data,
        });
    } catch (error) {
        handleError(res, error);
    }
});

// Start the gateway on port 3000
app.listen(3000, () => {
    console.log('Gateway service running on port 3000');
});
