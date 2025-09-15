download-macos-binary:
    curl -O https://dl.typesense.org/releases/29.0/typesense-server-29.0-darwin-arm64.tar.gz
    tar -xzf typesense-server-29.0-darwin-arm64.tar.gz
    mv typesense-server typesense/typesense-server-aarch64-apple-darwin
    rm typesense-server-29.0-darwin-arm64.tar.gz typesense-server.md5.txt
