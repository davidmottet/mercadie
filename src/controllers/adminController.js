import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { promisify } from 'util';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Configuration
const SCRIPT_CONFIG = {
  root: path.join(__dirname, '../scripts'),
  allowedTypes: ['validators', 'generators'],
  allowedExtensions: ['.js'],
  maxLogRetention: 3600000, // 1 heure en millisecondes
};

// Maps pour stocker les processus et les logs
const runningProcesses = new Map();
const processLogs = new Map();

// Fonction utilitaire pour valider le chemin d'un script
function isValidScriptPath (scriptPath) {
  const normalizedPath = path.normalize(scriptPath);
  return (
    normalizedPath.startsWith(SCRIPT_CONFIG.root) &&
    SCRIPT_CONFIG.allowedExtensions.includes(path.extname(normalizedPath))
  );
}

async function getScriptsFromDirectory (dir) {
  const files = await readdir(dir);
  const scriptFiles = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await stat(filePath);

    if (stats.isFile() && SCRIPT_CONFIG.allowedExtensions.includes(path.extname(file))) {
      scriptFiles.push({
        name: file,
        path: filePath,
        size: (stats.size / 1024).toFixed(2) + ' KB',
        modified: stats.mtime.toLocaleString()
      });
    }
  }

  return scriptFiles;
}

export const showAdminDashboard = async (req, res) => {
  const scriptsRoot = path.join(__dirname, '../scripts');

  // Récupérer les scripts de validation
  const validatorsDir = path.join(scriptsRoot, 'validators');
  const validators = await getScriptsFromDirectory(validatorsDir);

  // Récupérer les scripts de génération
  const generatorsDir = path.join(scriptsRoot, 'generators');
  const generators = await getScriptsFromDirectory(generatorsDir);

  // Récupérer les processus en cours d'exécution
  const processes = Array.from(runningProcesses.entries()).map(([id, process]) => ({
    id,
    script: process.scriptName,
    startTime: process.startTime.toLocaleString(),
    status: process.exitCode === null ? 'En cours' : process.exitCode === 0 ? 'Terminé' : 'Erreur'
  }));

  res.render('admin/dashboard', {
    validators,
    generators,
    processes,
    processLogs: Object.fromEntries(processLogs)
  });
};

export const runScript = async (req, res) => {
  const { scriptType, scriptName, args = '' } = req.body;

  if (!scriptType || !scriptName) {
    const error = new Error('Type de script et nom de script requis');
    error.statusCode = 400;
    throw error;
  }

  // Valider le type de script
  if (!SCRIPT_CONFIG.allowedTypes.includes(scriptType)) {
    const error = new Error('Type de script non autorisé');
    error.statusCode = 400;
    throw error;
  }

  const scriptsRoot = SCRIPT_CONFIG.root;
  const scriptDir = path.join(scriptsRoot, scriptType);
  const scriptPath = path.join(scriptDir, scriptName);

  // Validation supplémentaire du chemin
  if (!isValidScriptPath(scriptPath)) {
    const error = new Error('Chemin de script non valide');
    error.statusCode = 400;
    throw error;
  }

  // Vérifier que le script existe
  if (!fs.existsSync(scriptPath)) {
    const error = new Error('Script non trouvé');
    error.statusCode = 404;
    throw error;
  }

  // Préparer les arguments
  const scriptArgs = args
    .split(' ')
    .filter(arg => arg.trim() !== '')
    .map(arg => arg.replace(/[;&|`$]/g, '')); // Échapper les caractères dangereux

  // Générer un ID unique pour ce processus
  const processId = Date.now().toString();

  // Initialiser les logs pour ce processus
  processLogs.set(processId, []);

  // Lancer le script en arrière-plan
  const childProcess = spawn('node', [scriptPath, ...scriptArgs], {
    cwd: path.resolve(__dirname, '../../'),
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  // Stocker les informations sur le processus
  runningProcesses.set(processId, {
    process: childProcess,
    scriptName,
    startTime: new Date(),
    exitCode: null
  });

  // Capturer la sortie standard
  childProcess.stdout.on('data', (data) => {
    const logs = processLogs.get(processId) || [];
    logs.push({
      type: 'stdout',
      message: data.toString(),
      timestamp: new Date().toISOString()
    });
    processLogs.set(processId, logs);
  });

  // Capturer la sortie d'erreur
  childProcess.stderr.on('data', (data) => {
    const logs = processLogs.get(processId) || [];
    logs.push({
      type: 'stderr',
      message: data.toString(),
      timestamp: new Date().toISOString()
    });
    processLogs.set(processId, logs);
  });

  // Gérer la fin du processus
  childProcess.on('close', (code) => {
    const processInfo = runningProcesses.get(processId);
    if (processInfo) {
      processInfo.exitCode = code;
    }

    const logs = processLogs.get(processId) || [];
    logs.push({
      type: 'system',
      message: `Processus terminé avec le code ${code}`,
      timestamp: new Date().toISOString()
    });
    processLogs.set(processId, logs);

    // Supprimer les logs après 1 heure
    setTimeout(() => {
      runningProcesses.delete(processId);
      processLogs.delete(processId);
    }, SCRIPT_CONFIG.maxLogRetention);
  });

  res.json({
    success: true,
    message: 'Script lancé avec succès',
    processId
  });
};

export const getProcessLogs = async (req, res) => {
  const { processId } = req.params;

  if (!processId) {
    const error = new Error('ID de processus requis');
    error.statusCode = 400;
    throw error;
  }

  const logs = processLogs.get(processId) || [];
  const processInfo = runningProcesses.get(processId);

  if (!processInfo) {
    const error = new Error('Processus non trouvé');
    error.statusCode = 404;
    throw error;
  }

  res.json({
    success: true,
    logs,
    status: processInfo.exitCode === null ? 'running' : processInfo.exitCode === 0 ? 'completed' : 'error',
    exitCode: processInfo.exitCode
  });
};

export const stopProcess = async (req, res) => {
  const { processId } = req.params;

  if (!processId) {
    const error = new Error('ID de processus requis');
    error.statusCode = 400;
    throw error;
  }

  const processInfo = runningProcesses.get(processId);

  if (!processInfo || processInfo.exitCode !== null) {
    const error = new Error('Processus non trouvé ou déjà terminé');
    error.statusCode = 404;
    throw error;
  }

  processInfo.process.kill();

  const logs = processLogs.get(processId) || [];
  logs.push({
    type: 'system',
    message: 'Processus arrêté manuellement',
    timestamp: new Date().toISOString()
  });
  processLogs.set(processId, logs);

  res.json({
    success: true,
    message: 'Processus arrêté avec succès'
  });
};