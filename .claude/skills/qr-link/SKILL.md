---
name: qr-link
description: Generate a QR code for a URL or text and open it on screen. Use when the user asks for a "QR code", wants to scan a link onto their phone, or asks to share a local dev URL (e.g. a Vite/dev-server network address) with a mobile device.
allowed-tools: Bash, Read
---

# QR code for a link

Generate a scannable QR code from a URL (or any text) and show it to the user. Default to opening a PNG in an image viewer — terminal ASCII QR codes are often unscannable, so the PNG is the reliable path.

## Pre-flight

Verify the Python `qrcode` library is importable:

```bash
python3 -c "import qrcode" 2>/dev/null && echo ok || echo missing
```

If missing, tell the user to `pip install qrcode` (the pure-Python package needs no Pillow for ASCII, but Pillow IS required for PNG output — `pip install "qrcode[pil]"`). Don't auto-install.

Pick a viewer: prefer `feh`, fall back to `xdg-open`. Check with `which feh`.

## Resolving the link

If the user gives an explicit URL or text, use it verbatim.

If they say "the dev server" / "this link" / "share the app" without a URL, find the running dev server's **Network** address (not `localhost` — a phone can't reach `localhost`). Check the background dev-server task output for a line like `➜  Network: http://192.168.x.x:5173/` and use that. If there's no network address, tell the user the server must be started with `--host` for a phone to reach it.

## Generate + open

Write the PNG to `/tmp` and open it. Replace `LINK` with the resolved URL:

```bash
python3 -c "
import qrcode
qr = qrcode.QRCode(border=2)
qr.add_data('LINK')
qr.make(fit=True)
qr.make_image(fill_color='black', back_color='white').save('/tmp/qr-link.png')
print('saved /tmp/qr-link.png')
"
```

Then open it (background the viewer so it doesn't block):

```bash
DISPLAY=${DISPLAY:-:0} feh --geometry 400x400 /tmp/qr-link.png
```

Run the viewer as a background task. `feh` exits 0 when the user closes the window (`q` / `Esc`).

Also `Read` the PNG into the conversation so the user sees it inline even if the desktop window doesn't surface — belt and suspenders.

## Notes

- Don't bother printing ASCII QR codes; they frequently fail to scan. Go straight to PNG.
- Remind the user their phone must be on the same Wi-Fi/LAN when sharing a local network URL.
- For a quick non-graphical check only, `qr.print_ascii(invert=True)` exists, but treat it as a fallback, not the default.
