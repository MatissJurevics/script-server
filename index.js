import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const PASSWORD = process.env.PASSWORD;
const PORT = 8080;
const app = express();

const jsonUpdater = (req, res, next) => {
    const jsonPath = path.join(__dirname, 'scriptstore.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const scriptNames = fs.readdirSync(path.join(__dirname, 'scripts'));
    let allNames = jsonData.scripts.map(script => script.name);
    let namesToRemove = [];
    allNames.forEach(name => {
        if (!scriptNames.includes(name)) {
            namesToRemove.push(name);
        }
    });
    console.log("namesToRemove", namesToRemove);
    console.log("scriptNames", scriptNames);
    console.log("allNames", allNames);
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
            jsonData.scripts.push({ name: scriptName, content: scriptContent });
        }
        if (!matches) {
            jsonData.scripts.find(script => script.name === scriptName).content = scriptContent;
        }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});