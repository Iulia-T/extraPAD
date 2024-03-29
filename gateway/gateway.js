const express = require('express');
const axios = require('axios');
const redis = require('redis');
const app = express();

app.use(express.json());

const NBA_SERVICE_URL = 'http://localhost:5000';
const RECIPES_SERVICE_URL = 'http://localhost:5001';
const TIMEOUT = 5000; 
const MAX_CONCURRENT_REQUESTS = 10; 

const REDIS_PORT = process.env.REDIS_PORT || 6379;
const redisClient = redis.createClient(REDIS_PORT);

// Connect to Redis
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

// Middleware for Redis cache
const cacheMiddleware = async (req, res, next) => {
    const { originalUrl } = req;
    try {
        const cacheResult = await redisClient.get(originalUrl);
        if (cacheResult != null) {
            console.log('Cache hit');
            return res.status(200).json(JSON.parse(cacheResult));
        } else {
            console.log('Cache miss');
            next();
        }
    } catch (error) {
        console.error('Redis error', error);
        next(error);
    }
};

let ongoingRequests = 0;

// Middleware to limit concurrent requests
function limitConcurrentRequests(req, res, next) {
    if (ongoingRequests >= MAX_CONCURRENT_REQUESTS) {
        return res.status(503).send('Server busy, please try again later.');
    }
    ongoingRequests++;
    res.on('finish', () => {
        ongoingRequests--;
    });
    next();
}

app.use(limitConcurrentRequests); // Apply the middleware globally

// Helper function to handle errors
function handleError(res, error) {
    console.error('Error occurred:', error.code === 'ECONNABORTED' ? `A timeout occurred: ${error.message}` : error.response || error.message);
    res.status(error.response ? error.response.status : error.code === 'ECONNABORTED' ? 408 : 500).json({
        message: 'Error forwarding the request',
        error: error.code === 'ECONNABORTED' ? `A timeout occurred: ${error.message}` : error.response ? error.response.data : error.message
    });
}

// Helper function to determine if the identifier is numeric (ID)
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

// Route forwarding function with timeout
function forwardRequest(serviceBaseUrl) {
    return async (req, res) => {
        const servicePath = req.originalUrl.split('/').slice(2).join('/');
        const url = `${serviceBaseUrl}/${servicePath}`;
        
        try {
            const axiosConfig = {
                method: req.method,
                url: url,
                timeout: TIMEOUT, // Include the timeout in the configuration
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
    const isNumeric = /^\d+$/.test(identifier); 
    const teamEndpoint = isNumeric ? `/getTeamInfo/${identifier}` : `/getTeamInfo/${identifier}`; 

    try {
        const teamResponse = await axios.get(`${NBA_SERVICE_URL}${teamEndpoint}`);
        const recipesResponse = await axios.get(`${RECIPES_SERVICE_URL}/getRecipes`);
        const randomRecipe = recipesResponse.data[Math.floor(Math.random() * recipesResponse.data.length)];
        res.json({ team: teamResponse.data, recipe: randomRecipe });
    } catch (error) {
        handleError(res, error);
    }
});

// Endpoint to get a recipe by player ID or name
app.get('/recipe-by-player/:playerIdOrName', async (req, res) => {
    const identifier = req.params.playerIdOrName;
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


app.get('/recipe-starting-with-team/:teamIdOrName', async (req, res) => {
    const identifier = req.params.teamIdOrName;
    const isNumeric = /^\d+$/.test(identifier);
    const teamEndpoint = isNumeric ? `/getTeamInfo/${identifier}` : `/getTeamInfo/${encodeURIComponent(identifier)}`;

    console.log(`Requesting: ${NBA_SERVICE_URL}${teamEndpoint}`); 

    try {
        const teamResponse = await axios.get(`${NBA_SERVICE_URL}${teamEndpoint}`);
        if (!teamResponse.data || teamResponse.data.error) {
            return res.status(404).json({ message: 'Team not found' });
        }
        const teamName = teamResponse.data.name;
        const firstLetter = teamName.charAt(0).toUpperCase();

        const recipesResponse = await axios.get(`${RECIPES_SERVICE_URL}/getRecipes`);
        const matchingRecipe = recipesResponse.data.find(recipe => recipe.name.startsWith(firstLetter));

        if (matchingRecipe) {
            res.json({ team: teamResponse.data, recipe: matchingRecipe });
        } else {
            res.status(404).json({ message: `No recipe found starting with the letter ${firstLetter}` });
        }
    } catch (error) {
        handleError(res, error);
    }
});




// General status check
app.get('/status', cacheMiddleware, async (req, res) => {
    res.json({ message: 'Gateway is running' });
    const result = { nbaService: nbaStatusResponse.data, recipesService: recipesStatusResponse.data };
    await redisClient.setEx(req.originalUrl, 3600, JSON.stringify(result)); // Cache for 1 hour
    res.json(result);
});

// Endpoint to check the status of both NBA and Recipes services
app.get('/services-status', async (req, res) => {
    try {
        const nbaStatusResponse = await axios.get(`${NBA_SERVICE_URL}/status`, { timeout: TIMEOUT });
        const recipesStatusResponse = await axios.get(`${RECIPES_SERVICE_URL}/status`, { timeout: TIMEOUT });
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
