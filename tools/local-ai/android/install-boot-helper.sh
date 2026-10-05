#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
: "${YELLOW_ROOT:=$HOME/.yellow-phone-worker}"
: "${YELLOW_BOOT_SSH:=0}"
[[ "$YELLOW_BOOT_SSH" = 0 || "$YELLOW_BOOT_SSH" = 1 ]] || { echo 'YELLOW_BOOT_SSH must be 0 or 1' >&2; exit 2; }
[ -x "$YELLOW_ROOT/guard.sh" ] || { echo 'missing executable guard.sh; run bootstrap.sh first' >&2; exit 2; }
[ -x "$YELLOW_ROOT/start-server.sh" ] || { echo 'missing executable start-server.sh; run bootstrap.sh first' >&2; exit 2; }
[ -x "$YELLOW_ROOT/supervise-worker.sh" ] || { echo 'missing executable supervise-worker.sh; run bootstrap.sh first' >&2; exit 2; }
if [ "$YELLOW_BOOT_SSH" = 1 ]; then
  command -v sshd >/dev/null || { echo 'sshd is required for opt-in loopback SSH' >&2; exit 2; }
  [ -s "$HOME/.ssh/authorized_keys" ] || { echo 'authenticated SSH key required first' >&2; exit 2; }
fi
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/yellow-llama.sh" <<'BOOT'
#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
YELLOW_ROOT="${YELLOW_ROOT:-$HOME/.yellow-phone-worker}"
YELLOW_MODEL="${YELLOW_MODEL:-}"
# The supervisor waits for a cool phone; a hot boot must not disable later restart.
exec "$YELLOW_ROOT/supervise-worker.sh"
BOOT
chmod 700 "$HOME/.termux/boot/yellow-llama.sh"
if [ "$YELLOW_BOOT_SSH" = 1 ]; then
  cat > "$HOME/.termux/boot/yellow-loopback-ssh.sh" <<'SSHBOOT'
#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
[ -s "$HOME/.ssh/authorized_keys" ] || exit 2
exec sshd -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o AuthenticationMethods=publickey -o PubkeyAuthentication=yes -o ListenAddress=127.0.0.1 -p 8022
SSHBOOT
  chmod 700 "$HOME/.termux/boot/yellow-loopback-ssh.sh"
fi
printf '%s\n' 'Boot helper installed; Termux:Boot will still require the configured model.'
