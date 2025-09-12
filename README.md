Backend Setup (Node.js & PostgreSQL)
This backend server uses Node.js, Express, and PostgreSQL to manage event data for the EventSphere application. Follow these steps to get it running locally.

1. Prerequisites
Node.js: You must have Node.js (version 16 or newer) and npm installed. Download Node.js here.

PostgreSQL: You need a running PostgreSQL database server. Download PostgreSQL here.

2. Database Setup
You need to create a dedicated user and database for this application.

Open a PostgreSQL terminal (like psql on Linux/macOS or SQL Shell on Windows).

Create a new database user. Replace 'your_secure_password' with a password of your choice.

CREATE USER your_postgres_user WITH PASSWORD 'your_secure_password';

Create the application database.

CREATE DATABASE event_db;

Grant all necessary privileges to your new user for the new database.

GRANT ALL PRIVILEGES ON DATABASE event_db TO your_postgres_user;

Connect to your new database to run the schema script.

\c event_db

Create the participants table. Copy the SQL commands from the backend/database.sql file and execute them in your psql terminal. This will set up the required table structure.

3. Server Configuration & Launch
Navigate to the backend directory in your command line terminal.

cd path/to/your/project/backend

Install the required npm packages.

npm install

Configure Database Connection:

Open the server.js file.

Inside the new Pool({...}) configuration object, update the user, password, and database fields to match the credentials you created in Step 2.

Start the server.

npm start

Your backend server should now be running and listening for requests on http://localhost:3000. You can now open the frontend/index.html file in your browser to interact with the application.