#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

: "${LLAMA_CPP_REF:=b29c606e28a01b1bc8c1351026a0fa6e616bf6c4}"
: "${YELLOW_ROOT:=$HOME/.yellow-phone-worker}"
: "${YELLOW_MODEL:=}"
: "${SCRIPT_DIR:=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)}"

command -v pkg >/dev/null || { echo 'Run this script inside Termux' >&2; exit 2; }
mkdir -p "$YELLOW_ROOT/bin" "$YELLOW_ROOT/models" "$YELLOW_ROOT/run"
chmod 700 "$YELLOW_ROOT" "$YELLOW_ROOT/run"
touch "$YELLOW_ROOT/run/model"
cp "$SCRIPT_DIR/guard.sh" "$YELLOW_ROOT/guard.sh"
cp "$SCRIPT_DIR/start-server.sh" "$YELLOW_ROOT/start-server.sh"
cp "$SCRIPT_DIR/supervise-worker.sh" "$YELLOW_ROOT/supervise-worker.sh"
chmod 700 "$YELLOW_ROOT/guard.sh" "$YELLOW_ROOT/start-server.sh" "$YELLOW_ROOT/supervise-worker.sh"

pkg update -y
pkg install -y git cmake clang make python termux-api

if [ ! -d "$YELLOW_ROOT/llama.cpp/.git" ]; then
  git clone --depth 1 https://github.com/ggml-org/llama.cpp.git "$YELLOW_ROOT/llama.cpp"
fi
git -C "$YELLOW_ROOT/llama.cpp" fetch --depth 1 origin "$LLAMA_CPP_REF"
git -C "$YELLOW_ROOT/llama.cpp" checkout --detach "$LLAMA_CPP_REF"
cmake -S "$YELLOW_ROOT/llama.cpp" -B "$YELLOW_ROOT/llama-build" -DGGML_OPENMP=ON -DGGML_NATIVE=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build "$YELLOW_ROOT/llama-build" --target llama-server -j 2
ln -sf "$YELLOW_ROOT/llama-build/bin/llama-server" "$YELLOW_ROOT/bin/llama-server"

if [ ! -s "$YELLOW_ROOT/run/api-key" ]; then
  umask 077
  python -c 'import secrets; print(secrets.token_urlsafe(32), end="")' > "$YELLOW_ROOT/run/api-key"
fi
chmod 600 "$YELLOW_ROOT/run/api-key"
printf '%s\n' 'Bootstrap complete. Set YELLOW_MODEL to an existing GGUF path before starting.'
