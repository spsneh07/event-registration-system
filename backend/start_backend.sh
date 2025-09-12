#!/bin/bash

# This script automates the process of starting the backend server.
# It first installs the required dependencies listed in package.json,
# and then it starts the Node.js server.

echo "--- Starting EventSphere Backend Server ---"

# Step 1: Install dependencies
# This command reads the package.json file and installs all the packages listed under "dependencies".
echo "Installing dependencies (npm install)..."
npm install

# Check if npm install was successful
if [ $? -ne 0 ]; then
    echo "Error: npm install failed. Please check for errors above."
    exit 1
fi

echo "Dependencies installed successfully."

# Step 2: Start the server
# This command runs the "start" script defined in your package.json file (which is "node server.js").
echo "Starting server (npm start)..."
npm start

echo "--- Server has been initiated. ---"
