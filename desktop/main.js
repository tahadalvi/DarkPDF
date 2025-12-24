const { app, BrowserWindow, Tray, Menu, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Note: Using NSIS installer, not Squirrel - no squirrel-startup needed

let mainWindow = null;
let tray = null;
let apiProcess = null;
let isQuitting = false;

// Determine if we're in development or production
const isDev = !app.isPackaged;

// Paths configuration
const getResourcePath = () => {
  if (isDev) {
    return path.join(__dirname, '..');
  }
  return process.resourcesPath;
};

const getApiPath = () => {
  const resourcePath = getResourcePath();
  if (isDev) {
    return null; // In dev, run API separately
  }
  // In production, use the bundled executable
  return path.join(resourcePath, 'api', 'api.exe');
};

const getWebPath = () => {
  const resourcePath = getResourcePath();
  if (isDev) {
    return 'http://localhost:3000';
  }
  return path.join(resourcePath, 'web');
};

const API_PORT = 8000;
const API_URL = `http://localhost:${API_PORT}`;

// Wait for API to be ready
function waitForApi(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkApi = () => {
      const req = http.get(`${API_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', () => {
        retry();
      });

      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime >= timeout) {
        reject(new Error('API startup timeout'));
      } else {
        setTimeout(checkApi, 500);
      }
    };

    checkApi();
  });
}

// Start the Python API server
function startApiServer() {
  return new Promise((resolve, reject) => {
    const apiPath = getApiPath();

    if (!apiPath) {
      // Development mode - assume API is running separately
      console.log('Development mode: expecting API to be running on port 8000');
      resolve();
      return;
    }

    if (!fs.existsSync(apiPath)) {
      reject(new Error(`API executable not found: ${apiPath}`));
      return;
    }

    console.log('Starting API server:', apiPath);

    apiProcess = spawn(apiPath, [], {
      cwd: path.dirname(apiPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    apiProcess.stdout.on('data', (data) => {
      console.log(`API: ${data}`);
    });

    apiProcess.stderr.on('data', (data) => {
      console.error(`API Error: ${data}`);
    });

    apiProcess.on('error', (err) => {
      console.error('Failed to start API:', err);
      reject(err);
    });

    apiProcess.on('exit', (code) => {
      console.log(`API process exited with code ${code}`);
      if (!isQuitting) {
        // Unexpected exit - show error
        dialog.showErrorBox('DarkPDF Error', 'The API server has stopped unexpectedly. The application will now close.');
        app.quit();
      }
    });

    // Wait for API to be ready
    waitForApi()
      .then(resolve)
      .catch(reject);
  });
}

// Stop the API server
function stopApiServer() {
  if (apiProcess) {
    console.log('Stopping API server...');

    // On Windows, we need to kill the process tree
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', apiProcess.pid, '/f', '/t']);
    } else {
      apiProcess.kill('SIGTERM');
    }

    apiProcess = null;
  }
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'DarkPDF',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#0d1017',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  // Load the app
  const webPath = getWebPath();
  if (isDev) {
    mainWindow.loadURL(webPath);
    mainWindow.webContents.openDevTools();
  } else {
    // Serve static files in production
    mainWindow.loadFile(path.join(webPath, 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  // Use a default icon if custom one doesn't exist
  if (!fs.existsSync(iconPath)) {
    console.log('Tray icon not found, skipping tray creation');
    return;
  }

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open DarkPDF',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('DarkPDF');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

// App ready
app.whenReady().then(async () => {
  try {
    // Start the API server first
    await startApiServer();

    // Create window and tray
    createWindow();
    createTray();

  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox('DarkPDF Error', `Failed to start: ${error.message}`);
    app.quit();
  }
});

// Handle all windows closed
app.on('window-all-closed', () => {
  // On macOS, apps usually stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

// Handle activate (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// Handle before quit
app.on('before-quit', () => {
  isQuitting = true;
  stopApiServer();
});

// Handle quit
app.on('quit', () => {
  stopApiServer();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('DarkPDF Error', `An unexpected error occurred: ${error.message}`);
  isQuitting = true;
  stopApiServer();
  app.quit();
});
