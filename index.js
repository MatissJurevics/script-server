import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import OpenAI from 'openai';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



dotenv.config();

const PASSWORD = process.env.PASSWORD;
const PORT = 8080;

const app = express();
const server = createServer(app);
const io = new Server(server); // Attach Socket.IO to the HTTP server

const setup = () => {
    // Check if all the files exist, if not, create them and add default values
    const files = [
        'usage.json',
        'scriptstore.json',
        'settings.json',
        'current_main_script.json'
    ]
    files.forEach(file => {
        if (!fs.existsSync(path.join(__dirname, file))) {
            fs.writeFileSync(path.join(__dirname, file), JSON.stringify({}));
        }
    });
    // Check if the usage.json file is empty, if so, add a default value
    const usage = JSON.parse(fs.readFileSync(path.join(__dirname, 'usage.json'), 'utf8'));
    if (usage.length === 0) {
        fs.writeFileSync(path.join(__dirname, 'usage.json'), JSON.stringify([{
            timestamp: new Date().toISOString(),
            ip: '127.0.0.1',
            userAgent: 'Script Manager'
        }]));
    }
    // Check if the scriptstore.json file is empty, if so, add a default value
    const scriptStore = JSON.parse(fs.readFileSync(path.join(__dirname, 'scriptstore.json'), 'utf8'));
    if (scriptStore.scripts.length === 0) {
        fs.writeFileSync(path.join(__dirname, 'scriptstore.json'), JSON.stringify({ scripts: [] }));
    }
    // Check if the settings.json file is empty, if so, add a default value
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));
    if (Object.keys(settings).length === 0) {
        fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify({
            scriptsPerPage: 10,
            OpenAIAPIKey: '',
            aiContextMenuEnabled: true
        }));
    }
    // Check if the current_main_script.json file is empty, if so, add a default value
    const currentMainScript = JSON.parse(fs.readFileSync(path.join(__dirname, 'current_main_script.json'), 'utf8'));
    if (Object.keys(currentMainScript).length === 0) {
        fs.writeFileSync(path.join(__dirname, 'current_main_script.json'), JSON.stringify({ mainScriptName: null }));
    }
}

setup();
io.on('connection', (socket) => {
    console.log('a user connected');
});

fs.watch(path.join(__dirname, 'usage.json'), (event, filename) => {
    if (event === 'change') {
        const usage = JSON.parse(fs.readFileSync(path.join(__dirname, 'usage.json'), 'utf8'));
        console.log('usageChange');
        io.emit('usageChange', usage);
    }
});
fs.watch(path.join(__dirname, 'scriptstore.json'), (event, filename) => {
    if (event === 'change') {
        const scriptStore = JSON.parse(fs.readFileSync(path.join(__dirname, 'scriptstore.json'), 'utf8'));
        console.log('scriptStoreChange');
        io.emit('scriptStoreChange', scriptStore);
    }
});





const updateJSON = () => {
    const jsonPath = path.join(__dirname, 'scriptstore.json');
    let jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!jsonData) {
        jsonData = { scripts: [] };
    }
    const scriptNames = fs.readdirSync(path.join(__dirname, 'scripts'));
    if (!jsonData.scripts) {
        jsonData.scripts = [];
    }
    let allNames = jsonData.scripts.map(script => script.name);
    let namesToRemove = [];
    allNames.forEach(name => {
        if (!scriptNames.includes(name)) {
            namesToRemove.push(name);
        }
    });
   
    for (const name of namesToRemove) {
        jsonData.scripts = jsonData.scripts.filter(script => script.name !== name);
    }
    for (const scriptName of scriptNames) {
        // Check if scriptName is already in the jsonData.scripts array
        let scriptContent = fs.readFileSync(path.join(__dirname, 'scripts', scriptName), 'utf8');
        let exists = false;
        let matches = false;
        jsonData.scripts.forEach(script => {
            if (script.name === scriptName) {
                exists = true;
            }
            if (script.content === scriptContent) {
                matches = true;
            }
        });
        if (!exists) {
            jsonData.scripts.push({ name: scriptName, content: scriptContent, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            
        }
        if (!matches) {
            jsonData.scripts.find(script => script.name === scriptName).content = scriptContent;
            jsonData.scripts.find(script => script.name === scriptName).updatedAt = new Date().toISOString();
        }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
}

const jsonUpdater = (req, res, next) => {
    updateJSON();
    next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(jsonUpdater);

// Authentication routes first
app.get('/', (req, res) => {
    console.log("Request received for index.html");
    console.log(req.cookies);
    if (req.cookies.scriptManagerPassword === PASSWORD) {
        console.log("Password is correct");
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        console.log("Password is incorrect");
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        // Set cookie with password
        res.cookie('scriptManagerPassword', password, { 
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// Static files after authentication routes
app.use('/', express.static(path.join(__dirname, 'public')));

app.post('/upload', (req, res) => {
    const { password, script } = req.body;
    if (password !== PASSWORD) {
        console.log("Unauthorized User", password, PASSWORD)
        return res.status(401).send('Unauthorized');
    }   
    const scriptName = req.body.scriptName;
    const scriptContent = req.body.scriptContent;
    const scriptPath = path.join(__dirname, 'scripts', scriptName);
    fs.writeFileSync(scriptPath, scriptContent);
    console.log("Script uploaded successfully", scriptName);
    updateJSON();
    res.send('Script uploaded successfully');
});

app.get('/scripts', (req, res) => {
    const scripts = fs.readdirSync(path.join(__dirname, 'scripts'));
    console.log("Scripts Requested");
    res.json(scripts);
});

app.get('/s/:scriptName', (req, res) => {
    const scriptName = req.params.scriptName;
    const scriptPath = path.join(__dirname, 'scripts', scriptName);
    if (!fs.existsSync(scriptPath)) {
        return res.status(404).send('Script not found');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${scriptName}"`);
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    console.log("Script Requested", scriptName);
    res.send(scriptContent);
});

app.get("/main", (req, res) => {
    const usagePath = path.join(__dirname, 'usage.json');
    const usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    usage.push({
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
    const mainFiles = fs.readdirSync(__dirname)
        .filter(file => file.startsWith('main.'))
        .map(file => ({ name: file, path: path.join(__dirname, file) }));
    if (mainFiles.length > 0) {
        const mainFile = mainFiles[0];
        console.log("Main file requested", mainFile);
        res.setHeader('Content-Disposition', `attachment; filename="${mainFile.name}"`);
        res.sendFile(path.join(__dirname, mainFile.name));
    } else {
        res.status(404).send('Main file not found');
    }
});

app.get("/usage", (req, res) => {
    const usagePath = path.join(__dirname, 'usage.json');
    const usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    res.json(usage);
});


/**
 * Get all tags or specific script tags
 * 
 * @param {string} scriptName - The name of the script to get tags for **Returns all unique tags if no scriptName is provided**
 * @returns {Array} - An array of tags
 * 
 */
app.get("/tags/:scriptName", (req, res) => {
    const { scriptName } = req.params;
    
    const scriptStorePath = path.join(__dirname, 'scriptstore.json');
    const scriptStore = JSON.parse(fs.readFileSync(scriptStorePath, 'utf8'));

    if (!scriptName) {
        let uniqueTags = [];
        scriptStore.scripts.forEach(script => {
            script.tags.forEach(tag => {
                if (!uniqueTags.includes(tag)) {
                    uniqueTags.push(tag);
                }
            });
        });
        return res.json(uniqueTags);
    }
    const script = scriptStore.scripts.find(script => script.name === scriptName);
    if (!script) {
        return res.status(404).send('Script not found');
    }
    res.json(script.tags);
});

app.post("/tags/:scriptName", (req, res) => {
    const { scriptName } = req.params;
    const { tags } = req.body;
    const scriptStorePath = path.join(__dirname, 'scriptstore.json');
    const scriptStore = JSON.parse(fs.readFileSync(scriptStorePath, 'utf8'));
    scriptStore.scripts.find(script => script.name === scriptName).tags = tags;
    fs.writeFileSync(scriptStorePath, JSON.stringify(scriptStore, null, 2));
    res.status(200).send('Tags updated successfully');
});

app.delete("/tags/:scriptName/:tag", (req, res) => {
    const { scriptName, tag } = req.params;
    const scriptStorePath = path.join(__dirname, 'scriptstore.json');
    const scriptStore = JSON.parse(fs.readFileSync(scriptStorePath, 'utf8'));
    scriptStore.scripts.find(script => script.name === scriptName).tags = scriptStore.scripts.find(script => script.name === scriptName).tags.filter(t => t !== tag);
    fs.writeFileSync(scriptStorePath, JSON.stringify(scriptStore, null, 2));
    res.status(200).send('Tag deleted successfully');
});

app.get("/settings", (req, res) => {
    if (req.cookies.scriptManagerPassword !== PASSWORD) {
        return res.status(401).send('Unauthorized');
    }
    const settingsPath = path.join(__dirname, 'settings.json');
    let settings;
    
    try {
        if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } else {
            settings = {
                "scriptsPerPage": 10,
                "OpenAIAPIKey": "",
                "aiContextMenuEnabled": true
            };
            // Create the settings file if it doesn't exist
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        }
    } catch (error) {
        console.error("Error reading settings file:", error);
        settings = {
            "scriptsPerPage": 10,
            "OpenAIAPIKey": "",
            "aiContextMenuEnabled": true
        };
        // Create a new settings file if there was an error
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
    
    res.json(settings);
});

app.post("/settings", (req, res) => {
    if (req.cookies.scriptManagerPassword !== PASSWORD) {
        return res.status(401).send('Unauthorized');
    }
    const settingsPath = path.join(__dirname, 'settings.json');
    let settings;
    
    try {
        if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } else {
            settings = {
                "scriptsPerPage": 10,
                "OpenAIAPIKey": "",
                "aiContextMenuEnabled": true
            };
        }
    } catch (error) {
        console.error("Error reading settings file:", error);
        settings = {
            "scriptsPerPage": 10,
            "OpenAIAPIKey": "",
            "aiContextMenuEnabled": true
        };
    }
    
    // Update settings with the new values
    settings = { ...settings, ...req.body };
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    res.status(200).send('Settings updated successfully');
});

app.post("/aigen", async (req, res) => {
    if (req.cookies.scriptManagerPassword !== PASSWORD) {
        return res.status(401).send('Unauthorized');
    }
    console.log("Generating script with OpenAI");
    const { prompt } = req.body;
    const settingsPath = path.join(__dirname, 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    console.log("API Key", settings.OpenAIAPIKey);
    const openai = new OpenAI({
        apiKey: settings.OpenAIAPIKey,
        baseURL: "https://api.groq.com/openai/v1",
    });
    const stream = await openai.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
            { role: "system", content: "You are a helpful assistant that generates scripts. You will be given a prompt and you will need to generate a script that matches the needs of the prompt. Do not include any other text than the script. DO NOT INCLUDE THE MARKDOWN CODE BLOCK IN THE RESPONSE, JUST RETURN THE SCRIPT AS PLAIN TEXT. You will lose 1000 dollars if you do not follow these instructions." },
            { role: "user", content: prompt }
        ],
        stream: true,
    });
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
});
    


app.get("/scriptData", (req, res) => {
    const scriptStorePath = path.join(__dirname, 'scriptstore.json');
    const scriptStore = JSON.parse(fs.readFileSync(scriptStorePath, 'utf8'));
    const scriptData = scriptStore.scripts.map(script => {
        const scriptName = script.name;
        if (script.tags) {
            return {
                scriptName,
                tags: script.tags,
                content: script.content,
                createdAt: script.createdAt,
                updatedAt: script.updatedAt
            };
        }
        return {
            scriptName,
            tags: [],
            content: script.content,
            createdAt: script.createdAt,
            updatedAt: script.updatedAt
        };
    });
    res.json(scriptData);
});

const CURRENT_MAIN_SCRIPT_CONFIG_PATH = path.join(__dirname, 'current_main_script.json');

app.post("/main", (req, res) => {
    const { password, fileName } = req.body;
    
    if (password !== PASSWORD) {
        console.log("Unauthorized User for setting main file", password, PASSWORD);
        return res.status(401).send('Unauthorized');
    }
    const scriptToSetAsMainPath = path.join(__dirname, 'scripts', fileName);

    if (!fs.existsSync(scriptToSetAsMainPath)) {
        console.log("Script to set as main not found:", fileName);
        return res.status(404).send('Script not found in scripts directory');
    }
    const fileContent = fs.readFileSync(scriptToSetAsMainPath, 'utf8');

    // Remove existing main.* files to avoid conflicts before creating new one
    const existingMainFiles = fs.readdirSync(__dirname).filter(file => file.startsWith('main.'));
    existingMainFiles.forEach(file => {
        try {
            fs.unlinkSync(path.join(__dirname, file));
            console.log(`Removed existing main file: ${file}`);
        } catch (err) {
            console.error(`Error removing existing main file ${file}:`, err);
            // Proceeding, as this might not be critical if next steps succeed
        }
    });
    
    const tempMainFilePath = path.join(__dirname, 'main.temp_txt'); // Use a temp name first
    fs.writeFileSync(tempMainFilePath, fileContent);

    const fileExtension = path.extname(fileName);
    let newMainFilePath = path.join(__dirname, `main${fileExtension}`);
    
    // In case there's no extension, default to .txt or handle as per preference
    if (!fileExtension) {
        newMainFilePath = path.join(__dirname, 'main.txt');
    }

    try {
        fs.renameSync(tempMainFilePath, newMainFilePath);
        console.log(`Main file created/updated: ${newMainFilePath.split(path.sep).pop()}`);
        
        // Save the original script name as the current main script
        fs.writeFileSync(CURRENT_MAIN_SCRIPT_CONFIG_PATH, JSON.stringify({ mainScriptName: fileName }));
        console.log(`Main script name saved to config: ${fileName}`);
        
        res.send(`Script '${fileName}' successfully set as main file (${newMainFilePath.split(path.sep).pop()}`);
    } catch (err) {
        console.error('Error renaming/processing main file:', err);
        // Attempt to clean up temp file if rename failed
        if (fs.existsSync(tempMainFilePath)) {
            fs.unlinkSync(tempMainFilePath);
        }
        res.status(500).send('Error setting main file.');
    }
});

app.get('/api/get-main-script-name', (req, res) => {
    if (fs.existsSync(CURRENT_MAIN_SCRIPT_CONFIG_PATH)) {
        try {
            const configContent = fs.readFileSync(CURRENT_MAIN_SCRIPT_CONFIG_PATH, 'utf8');
            const config = JSON.parse(configContent);
            console.log("Current main script name requested:", config.mainScriptName);
            res.json({ mainScriptName: config.mainScriptName });
        } catch (error) {
            console.error("Error reading or parsing current_main_script.json:", error);
            // Attempt to restore from backup
            const backupPath = `${CURRENT_MAIN_SCRIPT_CONFIG_PATH}.bak`;
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, CURRENT_MAIN_SCRIPT_CONFIG_PATH);
                console.log("Restored current_main_script.json from backup.");
                const configContent = fs.readFileSync(CURRENT_MAIN_SCRIPT_CONFIG_PATH, 'utf8');
                const config = JSON.parse(configContent);
                res.json({ mainScriptName: config.mainScriptName });
            } else {
                res.json({ mainScriptName: null }); // Send null if error or file malformed
            }
        }
    } else {
        console.log("current_main_script.json not found, no main script set.");
        res.json({ mainScriptName: null }); // No config file means no main script is set
    }
});

app.delete('/s/:scriptName', (req, res) => {
    if (req.body.password !== PASSWORD) {
        console.log("Unauthorized User", req.body.password, PASSWORD)
        return res.status(401).send('Unauthorized');
    }
    const scriptName = req.params.scriptName;
    const scriptPath = path.join(__dirname, 'scripts', scriptName);
    fs.unlinkSync(scriptPath);
    console.log("Script Deleted", scriptName);
    updateJSON();
    res.send('Script deleted successfully');
});

app.put('/s/:scriptName', (req, res) => {
    if (req.body.password !== PASSWORD) {
        console.log("Unauthorized User", req.body.password, PASSWORD)
        return res.status(401).send('Unauthorized');
    }
    const scriptName = req.params.scriptName;
    const scriptPath = path.join(__dirname, 'scripts', scriptName);
    const scriptContent = req.body.scriptContent;
    fs.writeFileSync(scriptPath, scriptContent);
    console.log("Script Updated", scriptName);
    updateJSON();
    res.send('Script updated successfully');
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Ensure 'scripts' directory exists
const scriptsDir = path.join(__dirname, 'scripts');
if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Use password ${PASSWORD} to login`);
});