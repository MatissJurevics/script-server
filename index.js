import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const PASSWORD = process.env.PASSWORD;
const PORT = 8080;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    console.log("Script Requested", scriptName);
    res.send(scriptContent);
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