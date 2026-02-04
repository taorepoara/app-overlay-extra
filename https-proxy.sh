#!/bin/bash
set -e

local_hostname=${HOST:-$(hostname -I | cut -d " " -f 1)}

echo "Generating env files for hostname: $local_hostname"

echo "Starting caddy server to provide HTTPS proxying..."

# Generate caddy config file:
mkdir -p .caddy/conf
cat > .caddy/conf/Caddyfile <<EOL
https://$local_hostname:3443 {
  reverse_proxy :3000
}
EOL

# Start caddy server:
container=$(docker run --rm -dt --network host -v $PWD/.caddy/conf:/etc/caddy -v caddy_data:/data caddy)
set +e

# Load Caddy CA root certificate:
PEM_FILE_NAME=.caddy/caddy_ca.crt
echo "Loading Caddy CA root certificate..."
while ! curl -s -f "http://localhost:2019/pki/ca/local" | jq -r ".root_certificate" > $PEM_FILE_NAME; do
    echo >&2 'Site down, retrying in 1s...'
    sleep 1
done

# Install the certificate in the Android device:
echo "Installing Caddy CA root certificate in the Android device (Download directory)..."

# Not working... Source: https://stackoverflow.com/a/46569793/2139604

# hash=$(openssl x509 -inform PEM -subject_hash_old -in $PEM_FILE_NAME | head -1)
# OUT_FILE_NAME=".caddy/$hash.0"

# cp $PEM_FILE_NAME $OUT_FILE_NAME
# openssl x509 -inform PEM -text -in $PEM_FILE_NAME -out /dev/null >> $OUT_FILE_NAME

# sudo ~/Android/Sdk/platform-tools/adb push $OUT_FILE_NAME /system/etc/security/cacerts/

sudo ~/Android/Sdk/platform-tools/adb push $PEM_FILE_NAME /storage/self/primary/Download/


echo "Server is running with HTTPS proxying enabled:"
echo "Webapp: https://$local_hostname:3443"

docker logs -f $container

# Stop caddy server on exit:
docker stop $container