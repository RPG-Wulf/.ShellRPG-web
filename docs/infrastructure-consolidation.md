# Zentrale WWW-Infrastruktur: Bestandsaufnahme, Migration und Rollback

Stand der Repository-Analyse: 2026-08-27

## 1. Zielbild

```text
                         Internet
                            |
                            v
                   +----------------+
                   |      WWW       |
                   | Hauptendpunkt  |
                   +-------+--------+
                           |
                  +--------+--------+
                  |                 |
                  v                 v
            +-----------+     +-------------+
            |   Wiki    |     |     CDN     |
            | Subdomain |     | nur WWW-    |
            | verbunden |     |   Bilder    |
            +-----------+     +-------------+
```

Logische öffentliche Namen im aktuellen Repository-Vertrag:

- WWW: `https://www.shellrpg.tld`
- Wiki: `https://wiki.shellrpg.tld`
- CDN-Bildbasis: deployment-konfiguriert; aktuell ist der GitHub-backed
  jsDelivr-Pfad der Primärpfad.

Falls die realen Produktionsdomains davon abweichen, sind die tatsächlichen
Namen **vor** DNS-/TLS-Änderungen zu inventarisieren und atomar in Deployment-
Konfiguration plus Anwendungskonfiguration zu ersetzen.

## 2. Bestandsaufnahme aus den drei Repositories

### WWW (`RPG-Wulf/.ShellRPG-web`)

| Bereich | Gefundener Stand |
| --- | --- |
| Rolle | öffentlicher Haupt-Gateway + Browser-Client |
| Listener | `127.0.0.1:8080` |
| Backend | intern `http://127.0.0.1:8765` |
| API | Browser same-origin `/api/*`; `/api/events` als SSE |
| Session | `shellrpg_session`, HttpOnly, SameSite=Lax; im Migrationsbranch HTTPS-aware `Secure` |
| Bilder | lokaler Ursprung `public/media/**`; CDN-Pfad `assets/www/public/media/**` |
| Asset-Fallback | `/asset/*`, im Migrationsbranch image-only |
| Datenbank | keine WWW-eigene DB-Konfiguration gefunden |
| Benutzerverwaltung | Login/Session über private Server-API; Browser speichert nur öffentliche Geräte-/Account-Referenzen |
| Reverse Proxy/TLS | keine produktive Proxy- oder Zertifikatskonfiguration versioniert |

Der WWW-Gateway bleibt auf Loopback gebunden. Der private Serverport `8765`
darf nicht über den äußeren Reverse Proxy veröffentlicht werden.

### Wiki (`RPG-Wulf/.ShellRPG-wiki`)

| Bereich | Gefundener Stand |
| --- | --- |
| Rolle | öffentlich sichere, redigierte Dokumentation |
| Laufzeit | im Repository keine Wiki-Webruntime gefunden; primär Markdown |
| Port | keiner im Repository definiert |
| Datenbank | keine gefunden |
| Authentifizierung | keine Wiki-eigene Authentifizierung gefunden |
| Assets | Dokumentationsdateien im eigenen Repository |
| Reverse Proxy/TLS | nicht versioniert |

Daraus folgt als migrationsärmste Integration die eigene Subdomain
`wiki.shellrpg.tld` statt einer Montage unter `/wiki` im Python-Gateway.

### CDN (`RPG-Wulf/.ShellRPG-cdn`)

| Bereich | Gefundener Stand |
| --- | --- |
| Rolle vorher | allgemeiner kuratierter Asset-/Distributionsendpunkt |
| Rolle Ziel | ausschließlich WWW-Bildhost |
| aktiver Zielroot | `assets/www/public/media/**` |
| Schreibweg | lokales/deploymentseitiges Sync-Skript, keine öffentliche Upload-API |
| Laufzeit | statischer Bestand + dynv6-Update-Helfer |
| Datenbank | keine gefunden |
| Legacy | `assets/client`, `manifests/www` noch vorhanden, aber im Migrationsbranch nicht mehr produziert |

Der bisher konfigurierte Fallback `cdn-shellrpg.dns.army` lieferte bei der
öffentlichen DNS-Prüfung während dieser Analyse keine A-, AAAA- oder
CNAME-Antwort. Er darf beim Cutover nicht als funktionierende Redundanz
vorausgesetzt werden; DNS und HTTPS müssen unmittelbar vor Rollout erneut
verifiziert werden.

## 3. Abhängigkeiten

```text
Browser
  |
  v
WWW :443 (äußerer Reverse Proxy)
  |
  +--> 127.0.0.1:8080 ShellRPG-www
          |
          +--> 127.0.0.1:8765 ShellRPG-server (/api/*, privat)
          |
          +--> CDN-Bildbasis (nur public/media-Bilder)

Browser
  +--> Wiki :443 (separater Doku-Origin, von WWW verlinkt)
  +--> CDN  :443 (GET/HEAD nur für WWW-Bilder)
```

Nicht zulässige Abhängigkeiten:

- Wiki -> CDN als eigener Asset-Host
- CDN -> Server-API
- öffentlicher Client -> `127.0.0.1:8765` bzw. direkter Server-Origin
- öffentliche Schreibzugriffe -> CDN
- Client-/Terminal-Asset-Pipeline -> CDN

## 4. Vor produktiven Änderungen: Pflicht-Backups

Diese Repository-Änderungen verändern selbst keine Produktions-DNS-, Proxy-
oder TLS-Ressourcen. Vor einem realen Cutover muss der Operator trotzdem einen
wiederherstellbaren Snapshot anlegen.

Mindestens sichern und mit Zeitstempel/Checksumme dokumentieren:

1. DNS-Zone(n): A/AAAA/CNAME/TXT/CAA für WWW, Wiki und CDN.
2. Reverse-Proxy-Konfiguration inklusive Includes, Header-Regeln und
   Redirects.
3. TLS-Zertifikatsmetadaten und ACME-Konfiguration. Private Schlüssel nur im
   bestehenden gesicherten Secret-Backup-Verfahren behandeln, niemals ins
   Repository kopieren.
4. produktive `shellrpg-www.toml` und lokale ignorierte Origin-Konfiguration.
5. aktueller Wiki-Deploy-Stand.
6. aktueller CDN-Dateibestand inklusive Legacy-Pfade.
7. autoritativer Server-/Persistenzstand mit dem etablierten Backup-Verfahren
   des `ShellRPG-server`; diese Datenbank liegt außerhalb der drei hier
   analysierten Endpunkt-Repositories.
8. aktuellen Git-Commit/Release jedes Endpunkts.

Erst wenn Restore-Pfad und Verantwortlicher dokumentiert sind, DNS/Proxy/TLS
ändern.

## 5. Reverse-Proxy-Vertrag

Die konkrete Proxysoftware ist nicht in den Repositories festgelegt. Unabhängig
von Nginx/Caddy/HAProxy/Traefik gelten folgende Regeln.

### WWW

- öffentlich nur `443/tcp`; optional `80/tcp` ausschließlich für HTTP -> HTTPS
  Redirect/ACME.
- Upstream ausschließlich `127.0.0.1:8080`.
- `Host`, Client-IP und `X-Forwarded-Proto: https` korrekt setzen.
- `/api/events` nicht puffern und lange SSE-Verbindungen zulassen.
- keinen Proxy-Pfad auf `127.0.0.1:8765` veröffentlichen.
- keine pauschale CORS-Freigabe nötig, da Browser-API same-origin bleibt.

### Wiki

- eigener HTTPS-vHost `wiki.<domain>` auf den tatsächlichen statischen Wiki-
  Origin.
- keine WWW-Session-Cookies auf `.domain` verbreitern; das aktuelle öffentliche
  Wiki benötigt keine geteilte Session.
- alte Wiki-Hosts pfaderhaltend mit 301/308 auf den kanonischen Wiki-Origin
  umleiten, nachdem die Zielseite getestet wurde.

### CDN

- öffentlich nur HTTPS GET/HEAD.
- Root/Directory Listing und Anwendungsausführung deaktivieren.
- nur Bilddateien aus dem WWW-Image-Root ausliefern.
- POST/PUT/PATCH/DELETE und öffentliche Upload-Endpunkte ablehnen.
- keine Cookies setzen, keine Session- oder API-Verantwortung übernehmen.
- kein Wiki-/Client-Asset-Root mounten.

## 6. Cache-Regeln für Bilder

Da die bestehenden Dateinamen nicht durchgehend content-hashed sind, dürfen
sie nicht blind als unveränderlich (`immutable`) für sehr lange Zeit gecacht
werden.

Empfohlene Ausgangsbasis für den eigenen CDN-vHost:

```text
Cache-Control: public, max-age=86400, stale-while-revalidate=3600
```

Für später content-hashed/versionierte Bildpfade kann auf lange Laufzeiten plus
`immutable` umgestellt werden. Änderungen an einem bestehenden Dateinamen
müssen bis dahin Cache-Invalidierung oder einen neuen Dateinamen berücksichtigen.

Der WWW-`/asset/*`-Fallback darf kürzer cachen; er ist kein primärer Bildweg.

## 7. CORS, CSP und Mixed Content

- WWW-API bleibt same-origin; keine `Access-Control-Allow-Origin: *`-Regel
  hinzufügen.
- Normale `<img>`-Auslieferung benötigt für die meisten Fälle kein CORS.
- Falls Canvas-/Fetch-Nutzung von CDN-Bildern erforderlich wird, nur den
  konkreten WWW-Origin erlauben.
- ausschließlich HTTPS-URLs in WWW und Wiki verwenden.
- SVG wird nur aus der kontrollierten WWW-Pipeline akzeptiert; keine
  öffentlichen SVG-Uploads zulassen.

## 8. Migrationsreihenfolge

1. Repository-/Produktionsinventar abgleichen.
2. Abhängigkeiten und tatsächliche Domains dokumentieren.
3. Backups aus Abschnitt 4 erstellen und Restore prüfen.
4. neue WWW-/Wiki-/CDN-vHosts parallel vorbereiten, alte Pfade noch aktiv
   lassen.
5. WWW hinter TLS auf `127.0.0.1:8080` validieren.
6. Wiki auf eigener Subdomain veröffentlichen und Navigation in beide
   Richtungen testen.
7. CDN auf den WWW-Image-Root begrenzen; Schreibmethoden deaktivieren.
8. WWW-Bildpfade/Redirects auf den kanonischen CDN-Pfad aktivieren.
9. alte URLs pfaderhaltend redirecten.
10. vollständige Funktionstests aus Abschnitt 9 durchführen.
11. Logs/Browser-Konsole auf CORS-, Cookie-, TLS-, Cache- und Redirectfehler
    prüfen.
12. erst danach Legacy-CDN-Pfade, alte Hosts und redundante Proxyregeln
    entfernen.

## 9. Abnahmematrix

- [ ] `https://www...` liefert die Hauptanwendung.
- [ ] `/api/*` funktioniert ausschließlich über WWW.
- [ ] `/api/events` streamt ohne Proxy-Pufferung.
- [ ] WWW-Session-Cookie ist bei HTTPS `Secure; HttpOnly; SameSite=Lax` und
      host-only.
- [ ] `/health` verrät keine private Backend-Adresse.
- [ ] vorhandene `/public/media/...`-Bild-URLs redirecten ohne Schleife zum
      CDN.
- [ ] CDN liefert PNG/JPEG/GIF/WebP/SVG/ICO über HTTPS.
- [ ] CDN liefert keine CSS-/JS-/JSON-/Anwendungsdateien als WWW-Asset-Payload.
- [ ] Cache-Control und Browsercache verhalten sich wie geplant.
- [ ] Wiki ist über HTTPS erreichbar.
- [ ] WWW -> Wiki und Wiki -> WWW funktionieren.
- [ ] wichtige alte Wiki-URLs funktionieren oder redirecten pfaderhaltend.
- [ ] Wiki-Netzwerkverkehr verwendet den CDN-Bildhost nicht für eigene Assets.
- [ ] keine Mixed-Content-, CORS- oder Cookie-Warnungen im Browser.
- [ ] keine offenen öffentlichen Backend-Ports.
- [ ] keine öffentlichen CDN-Schreibmethoden.

## 10. Rollback

Rollback wird ausgelöst bei API-/Session-Ausfall, Redirect-Schleifen,
signifikanten 4xx/5xx-Anstiegen, TLS-Fehlern, fehlenden Bildern oder Wiki-
Erreichbarkeitsproblemen.

Reihenfolge:

1. WWW-Bildbasis/Redirects auf den vorher gesicherten Stand zurücksetzen.
2. vorherige Reverse-Proxy-vHosts/Redirects wieder aktivieren.
3. DNS nur auf die vorher dokumentierten Werte zurücksetzen, falls DNS Teil
   des fehlgeschlagenen Cutovers war.
4. vorherigen Wiki-/CDN-Deploy-Stand wiederherstellen.
5. Anwendung und wichtige URLs erneut prüfen.
6. Legacy-Daten **nicht löschen**, solange ein Rollback noch möglich sein muss.

## 11. Post-Validation Cleanup

Erst nach dokumentierter erfolgreicher Abnahme:

- historischen CDN-Root `assets/client` entfernen,
- historische `manifests/www` aus dem CDN entfernen,
- nicht mehr benötigte alte Wiki-/CDN-Hosts abschalten,
- redundante Proxy-/DNS-Regeln entfernen,
- Fallback-Origins entfernen, die nachweislich nicht mehr gebraucht werden.

Jede dieser Aktionen ist ein eigener, reviewbarer Cleanup-Schritt mit erneutem
Backup und Smoke-Test.
