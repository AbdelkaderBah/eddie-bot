#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

APP_DIR=${1:-$(pwd)}

echo "Using application directory: $APP_DIR"

# Export variable for Supervisor

export MY_APP_DIR="$APP_DIR"

# Change to your application's directory
#cd /path/to/your/app

# Pull the latest changes from git
echo "Pulling latest code..."
git pull

# Build the project in release mode
echo "Building project..."
cargo build --release

# Optionally, copy the new binary to a known location.
# Adjust the binary name and destination as needed.
#echo "Deploying new binary..."
#sudo cp target/release/my_app /usr/local/bin/my_app

# Restart the application via Supervisor
echo "Restarting application via Supervisor..."
sudo supervisorctl restart eddie

echo "Deployment complete!"
