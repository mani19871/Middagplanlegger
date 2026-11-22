#!/usr/bin/env bash
# Husvett: lesepakke (bare lesing, endrer ingenting). Kjøres som mani. Se docs/installasjon-ubuntu.md 0A.2.
maske() { sed -E 's/0\.0\.0\.0/@A@/g; s/127\.0\.0\.1/@L@/g; s/([0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}\.[0-9]{1,3}/\1.x.x/g; s/([0-9a-fA-F]{1,4}:[0-9a-fA-F]{1,4}):[0-9a-fA-F:]*[0-9a-fA-F]/\1:…/g; s/@A@/0.0.0.0/g; s/@L@/127.0.0.1/g'; }
echo "== L3/L4 porter 80 og 443 (TCP og UDP)"; sudo ss -tlnp '( sport = :80 or sport = :443 )' | maske; sudo ss -ulnp '( sport = :443 )' | maske
echo "== L7/L8 Docker"; docker --version; docker compose version; apt list --installed 2>/dev/null | grep -Ei '^(docker|containerd)'
echo "== L9/L10 containere, volumer og nettverk"; sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | maske; sudo docker volume ls | grep -c middagsplanlegger; sudo docker network ls
echo "== L12 disk"; df -h / /var/lib/docker; sudo docker system df
echo "== L13 minne"; free -h; nproc
echo "== L15 brannmurtabeller"; sudo nft list tables; sudo ufw status | grep -c '(v6)'
echo "== L16 adresser (maskert)"; ip -4 -o addr show scope global | awk '{print $2, $4}' | maske; ip -6 -o addr show scope global | awk '{print $2, $4}' | maske
echo "== L17 tid"; timedatectl | grep -E 'Time zone|synchronized|NTP'
echo "== L18 planlagte jobber"; sudo ls /var/spool/cron/crontabs 2>/dev/null; ls /etc/cron.d; systemctl list-timers --all --no-pager; sudo grep -rniE 'prune|docker (rm|volume|system)' /etc/cron* /var/spool/cron /etc/systemd/system 2>/dev/null
echo "== T1 tilgang (C16)"; for u in mani koordinator administrator; do id "$u"; done; getent group sudo docker; sudo grep -rhv '^#' /etc/sudoers.d 2>/dev/null | grep -v '^$'; sudo passwd -S administrator; sudo grep -rh '^AllowUsers' /etc/ssh/sshd_config /etc/ssh/sshd_config.d 2>/dev/null
echo "== T2 oppdateringer og omstart"; systemctl is-active unattended-upgrades; grep -vh '^\s*//' /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null | grep -E 'Automatic-Reboot|origin=|Origins-Pattern|\$\{distro' ; ls /var/run/reboot-required 2>/dev/null || echo "ingen omstart ventet"
