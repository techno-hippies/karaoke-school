#!/bin/bash

echo "Setting up PostgreSQL for Graph Node..."

# Use simple dev password from env or default
PASSWORD=${PASSWORD:-dev}

# Create the graph user and database using sudo
sudo -u postgres psql << EOF
-- Create graph user with simple password
CREATE USER graph WITH PASSWORD '${PASSWORD}';

-- Create graph-node database
CREATE DATABASE "graph-node" WITH OWNER = graph TEMPLATE = template0 ENCODING = 'UTF8' LC_COLLATE = 'C' LC_CTYPE = 'C';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE "graph-node" TO graph;

-- Connect to the database and create extensions
\c graph-node
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
GRANT USAGE ON FOREIGN DATA WRAPPER postgres_fdw TO graph;

\q
EOF

echo "PostgreSQL setup complete. Database 'graph-node' with user 'graph' created."
echo ""
echo "Connection string: postgresql://graph:${PASSWORD}@localhost:5432/graph-node"
echo "Dev credentials: graph/${PASSWORD}"
