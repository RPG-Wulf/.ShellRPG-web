Original prompt: Der nächste sinnvolle Ausbaupfad wäre jetzt echter Feldvergleich im Drilldown, falls der Server später Vorher/Nachher-Werte pro Konflikt mitliefert.

- 2026-04-03: WWW-Drilldown für `character_conflicts` bereits als aufklappbare Konfliktkarten vorhanden.
- 2026-04-03: Server liefert jetzt `field_comparisons` pro Character-Konflikt; WWW rendert daraus bevorzugten Stand, Gegenseite und gemergtes Ergebnis im Drilldown.
- 2026-04-03: `delta_summary` pro Feldvergleich ergänzt; WWW zeigt jetzt Delta-Badges und Kurz-Diffs gegen den Gewinnerstand.
- 2026-04-03: priorisierte `priority_preview`-Eintraege ergänzt; WWW trennt jetzt sichtbar zwischen Plus- und Upgrade-Hinweisen.
- 2026-04-03: serverseitige Domänengewichtung ergänzt; wichtige POIs, wertigere Ressourcen und kritischere Progress-Flags rutschen im Drilldown jetzt sichtbar nach oben.
- 2026-04-03: `priority_preview` liefert jetzt kurze Priorisierungsgruende (`reason`); der Drilldown zeigt damit pro Top-Hinweis direkt das "warum oben?" an.
- 2026-04-03: `priority_preview` liefert jetzt zusaetzlich stabile `reason_code`-Schluessel; der Drilldown zeigt daraus kompakte Kategorien statt Freitext-Heuristiken.
- 2026-04-03: Matrix-Konflikte tragen jetzt Severity-/Tier-Rollups, stabile `conflict_id`-/`field_conflict_id`-Anker und kleine Historien mit `seen_count`/`still_open`.
- 2026-04-03: Das `Servermatrix`-Panel zeigt jetzt Hotspots, Severity-/Gruppen-Filter, Sortiermodi und truncation-aware Rollups fuer grosse Merge-Faelle.
