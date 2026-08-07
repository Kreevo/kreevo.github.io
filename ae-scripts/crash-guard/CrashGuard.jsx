// Crash Guard by Kreevo
// ScriptUI dockable panel for After Effects — versioned auto-backup,
// live system load monitor, pre-render health check, crash history log.
// v2.0.0 — full rebuild

(function (thisObj) {

    // ---------------------------------------------------------------
    // BRAND
    // ---------------------------------------------------------------
    var BRAND = {
        bg:       [0x2E / 255, 0x4A / 255, 0x3A / 255],
        card:     [0x3D / 255, 0x5C / 255, 0x48 / 255],
        btn:      [0x45 / 255, 0x67 / 255, 0x52 / 255],
        btnHover: [0x51 / 255, 0x76 / 255, 0x5F / 255],
        accent:   [0xD8 / 255, 0x5A / 255, 0x30 / 255],
        text:     [0xF5 / 255, 0xF2 / 255, 0xE3 / 255],
        muted:    [0xB8 / 255, 0xC4 / 255, 0xB5 / 255],
        border:   [0x1C / 255, 0x2E / 255, 0x22 / 255]
    };

    function getBestFont() {
        return ($.os.indexOf("Windows") !== -1) ? "Segoe UI" : "Helvetica Neue";
    }
    var FONT = getBestFont();

    // ---------------------------------------------------------------
    // LOGO — a plain PNG file that lives next to this script, same
    // approach as MotionVault. Nothing to embed, nothing to decode.
    // ---------------------------------------------------------------
    function getLogoFile() {
        try {
            var scriptFile = new File($.fileName);
            var logoFile = new File(scriptFile.parent.fsName + "/CrashGuard_logo.png");
            return logoFile.exists ? logoFile : null;
        } catch (e) {
            return null;
        }
    }
    var LOGO_FILE = getLogoFile();

    // ---------------------------------------------------------------
    // PATHS
    // ---------------------------------------------------------------
    var BASE_DIR = Folder.userData.fsName + "/Kreevo/CrashGuard";
    var SETTINGS_FILE = new File(BASE_DIR + "/settings.txt");
    var HISTORY_FILE = new File(BASE_DIR + "/history.log");
    var SESSION_MARKER = new File(BASE_DIR + "/session.lock");

    function ensureBaseDir() {
        try {
            var f = new Folder(BASE_DIR);
            if (!f.exists) f.create();
        } catch (e) {}
    }

    // ---------------------------------------------------------------
    // SETTINGS — plain "key=value" lines, no eval, no JSON dependency.
    // ---------------------------------------------------------------
    var SETTINGS_DEFAULTS = { enabled: true, intervalMinutes: 10, maxBackups: 20 };

    function loadSettings() {
        var result = {};
        for (var k in SETTINGS_DEFAULTS) result[k] = SETTINGS_DEFAULTS[k];
        try {
            if (SETTINGS_FILE.exists) {
                SETTINGS_FILE.open("r");
                var raw = SETTINGS_FILE.read();
                SETTINGS_FILE.close();
                var lines = raw.split("\n");
                for (var i = 0; i < lines.length; i++) {
                    var eq = lines[i].indexOf("=");
                    if (eq < 0) continue;
                    var key = lines[i].substring(0, eq).replace(/^\s+|\s+$/g, "");
                    var val = lines[i].substring(eq + 1).replace(/^\s+|\s+$/g, "");
                    if (!(key in SETTINGS_DEFAULTS)) continue;
                    if (typeof SETTINGS_DEFAULTS[key] === "boolean") {
                        result[key] = (val === "true");
                    } else {
                        var n = parseFloat(val);
                        if (!isNaN(n)) result[key] = n;
                    }
                }
            }
        } catch (e) {}
        return result;
    }

    function saveSettings(s) {
        try {
            ensureBaseDir();
            var lines = [];
            for (var k in SETTINGS_DEFAULTS) lines.push(k + "=" + s[k]);
            SETTINGS_FILE.open("w");
            SETTINGS_FILE.write(lines.join("\n"));
            SETTINGS_FILE.close();
        } catch (e) {}
    }

    var settings = loadSettings();

    // ---------------------------------------------------------------
    // HISTORY LOG
    // ---------------------------------------------------------------
    function timestamp() {
        var d = new Date();
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
               pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    function appendHistory(line) {
        try {
            ensureBaseDir();
            HISTORY_FILE.open("a");
            HISTORY_FILE.writeln("[" + timestamp() + "] " + line);
            HISTORY_FILE.close();
            trimHistoryIfNeeded();
        } catch (e) {}
    }

    function trimHistoryIfNeeded() {
        try {
            if (!HISTORY_FILE.exists || HISTORY_FILE.length < 200000) return;
            HISTORY_FILE.open("r");
            var raw = HISTORY_FILE.read();
            HISTORY_FILE.close();
            var lines = raw.split("\n");
            if (lines.length <= 400) return;
            var kept = lines.slice(lines.length - 300);
            HISTORY_FILE.open("w");
            HISTORY_FILE.write(kept.join("\n"));
            HISTORY_FILE.close();
        } catch (e) {}
    }

    function readHistoryTail(maxLines) {
        try {
            if (!HISTORY_FILE.exists) return "No history yet.";
            HISTORY_FILE.open("r");
            var raw = HISTORY_FILE.read();
            HISTORY_FILE.close();
            var lines = raw.split("\n");
            if (lines.length > maxLines) lines = lines.slice(lines.length - maxLines);
            return lines.join("\n");
        } catch (e) {
            return "Couldn't read history log.";
        }
    }

    // ---------------------------------------------------------------
    // CRASH DETECTION — a marker file that only survives a bad exit.
    // ---------------------------------------------------------------
    var possibleCrashDetected = false;
    function checkPreviousSession() {
        ensureBaseDir();
        try {
            if (SESSION_MARKER.exists) {
                possibleCrashDetected = true;
                appendHistory("Previous session did not close cleanly — possible crash or force-quit.");
            }
            SESSION_MARKER.open("w");
            SESSION_MARKER.write(timestamp());
            SESSION_MARKER.close();
        } catch (e) {}
    }
    function clearSessionMarker() {
        try { if (SESSION_MARKER.exists) SESSION_MARKER.remove(); } catch (e) {}
    }
    checkPreviousSession();

    // ---------------------------------------------------------------
    // SYSTEM LOAD — CPU / RAM / temperature, real readings only.
    // Never estimates or fakes a number; unavailable stays unavailable.
    // ---------------------------------------------------------------
    function runSystemCommand(cmd) {
        try {
            if (typeof system === "undefined" || !system.callSystem) return null;
            var out = system.callSystem(cmd);
            if (out === undefined || out === null) return null;
            return String(out);
        } catch (e) {
            return null;
        }
    }

    function trimSplitLines(s) {
        var raw = s.split(/\r?\n/);
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var t = raw[i].replace(/^\s+|\s+$/g, "");
            if (t.length) out.push(t);
        }
        return out;
    }

    var IS_WIN = ($.os.indexOf("Windows") !== -1);

    function getCPULoad() {
        try {
            if (IS_WIN) {
                var out = runSystemCommand('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"');
                if (!out) return null;
                var n = parseFloat(out);
                return isNaN(n) ? null : Math.round(n);
            } else {
                var out2 = runSystemCommand("top -l 1 -n 0");
                if (!out2) return null;
                var m = out2.match(/CPU usage:\s*([\d.]+)%\s*user,\s*([\d.]+)%\s*sys/);
                if (!m) return null;
                var load = parseFloat(m[1]) + parseFloat(m[2]);
                return isNaN(load) ? null : Math.round(load);
            }
        } catch (e) {
            return null;
        }
    }

    function getRAMUsage() {
        try {
            if (IS_WIN) {
                var out = runSystemCommand('powershell -NoProfile -Command "$o=Get-CimInstance Win32_OperatingSystem; Write-Output $o.FreePhysicalMemory; Write-Output $o.TotalVisibleMemorySize"');
                if (!out) return null;
                var lines = trimSplitLines(out);
                if (lines.length < 2) return null;
                var freeKB = parseFloat(lines[0]);
                var totalKB = parseFloat(lines[1]);
                if (isNaN(freeKB) || isNaN(totalKB) || totalKB <= 0) return null;
                var usedKB = totalKB - freeKB;
                return {
                    percent: Math.round((usedKB / totalKB) * 100),
                    usedGB: usedKB / 1048576,
                    totalGB: totalKB / 1048576
                };
            } else {
                var totalOut = runSystemCommand("sysctl -n hw.memsize");
                var vmOut = runSystemCommand("vm_stat");
                if (!totalOut || !vmOut) return null;
                var totalBytes = parseFloat(totalOut);
                if (isNaN(totalBytes) || totalBytes <= 0) return null;
                var pageSizeMatch = vmOut.match(/page size of (\d+) bytes/);
                var pageSize = pageSizeMatch ? parseFloat(pageSizeMatch[1]) : 4096;
                var freeMatch = vmOut.match(/Pages free:\s*(\d+)\./);
                var specMatch = vmOut.match(/Pages speculative:\s*(\d+)\./);
                var freePages = (freeMatch ? parseFloat(freeMatch[1]) : 0) + (specMatch ? parseFloat(specMatch[1]) : 0);
                var freeBytes = freePages * pageSize;
                var usedBytes = totalBytes - freeBytes;
                return {
                    percent: Math.round((usedBytes / totalBytes) * 100),
                    usedGB: usedBytes / 1073741824,
                    totalGB: totalBytes / 1073741824
                };
            }
        } catch (e) {
            return null;
        }
    }

    // Best-effort only. Many systems (especially newer Windows builds and
    // most Macs) simply don't expose this without extra vendor tools —
    // that's expected, so we label it rather than guess at a number.
    function getCPUTemp() {
        try {
            if (IS_WIN) {
                var out = runSystemCommand('powershell -NoProfile -Command "Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | ForEach-Object { Write-Output $_.CurrentTemperature }"');
                if (!out) return null;
                var lines = trimSplitLines(out);
                for (var i = 0; i < lines.length; i++) {
                    var n = parseFloat(lines[i]);
                    if (!isNaN(n) && n > 0) return Math.round((n / 10) - 273.15);
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function getGPUTemp() {
        try {
            var out = runSystemCommand("nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits");
            if (!out) return null;
            var n = parseFloat(out);
            return isNaN(n) ? null : Math.round(n);
        } catch (e) {
            return null;
        }
    }

    function playNotifySound() {
        try {
            if (IS_WIN) {
                runSystemCommand('powershell -NoProfile -Command "[console]::beep(880,150)"');
            } else {
                runSystemCommand("afplay /System/Library/Sounds/Glass.aiff");
            }
        } catch (e) {}
    }

    // ---------------------------------------------------------------
    // BACKUP CORE
    // ---------------------------------------------------------------
    function getBackupFolder() {
        if (!(app.project && app.project.file)) return null;
        var backupFolder = new Folder(app.project.file.parent.fsName + "/Kreevo_Backups");
        if (!backupFolder.exists) backupFolder.create();
        return backupFolder;
    }

    var statusText = null;
    function setStatus(msg) { if (statusText) { try { statusText.text = msg; } catch (e) {} } }

    function runBackup(silent) {
        if (!(app.project && app.project.file)) {
            if (!silent) alert("Save your project once with a name before backing up.");
            return false;
        }
        try {
            app.project.save();
            var backupFolder = getBackupFolder();
            if (!backupFolder) return false;
            var baseName = app.project.file.name.replace(/\.aep$/i, "");
            var backupFile = new File(backupFolder.fsName + "/" + baseName + "_" + timestamp().replace(/[:\s]/g, "-") + ".aep");
            app.project.file.copy(backupFile.fsName);
            cleanupOldBackups(backupFolder);
            setStatus("Last backup " + timestamp());
            appendHistory("Backup saved — " + backupFile.name + " (" + app.project.numItems + " items)");
            return true;
        } catch (err) {
            setStatus("Backup skipped — will retry next cycle");
            appendHistory("Backup failed silently — will retry next cycle");
            return false;
        }
    }

    function cleanupOldBackups(backupFolder) {
        try {
            var files = backupFolder.getFiles(function (f) { return f instanceof File && /\.aep$/i.test(f.name); });
            files.sort(function (a, b) { return a.created - b.created; });
            var excess = files.length - settings.maxBackups;
            for (var i = 0; i < excess; i++) files[i].remove();
        } catch (e) {}
    }

    function listBackups() {
        var backupFolder = getBackupFolder();
        if (!backupFolder) return [];
        var files = backupFolder.getFiles(function (f) { return f instanceof File && /\.aep$/i.test(f.name); });
        files.sort(function (a, b) { return b.created - a.created; });
        return files;
    }

    function restoreBackup(file) {
        var confirmed = confirm("Restore \"" + file.name + "\"?\n\nUnsaved changes in your current project will be lost.");
        if (!confirmed) return;
        try {
            app.open(file);
            appendHistory("Restored backup — " + file.name);
        } catch (err) {
            alert("Couldn't open that backup: " + err.toString());
        }
    }

    function runHealthCheck() {
        if (!app.project) { alert("Open a project first."); return; }
        var missing = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FootageItem && item.footageMissing) missing.push(item.name);
        }
        if (missing.length === 0) {
            alert("No missing footage found. Your project looks ready to render.");
        } else {
            alert("Found " + missing.length + " missing footage item(s):\n\n" + missing.join("\n") +
                  "\n\nRelink these before starting a long render.");
        }
    }

    // ---------------------------------------------------------------
    // PRE-RENDER CHECK
    // ---------------------------------------------------------------
    function checkRenderReadiness(alwaysAlert) {
        var cpu = getCPULoad();
        var ram = getRAMUsage();
        var reasons = [];
        if (cpu !== null && cpu >= 85) reasons.push("CPU is at " + cpu + "% — already maxed out.");
        if (ram !== null && ram.percent >= 85) reasons.push("RAM is at " + ram.percent + "% — very little headroom left.");

        if (reasons.length > 0) {
            alert("This may not be a great time to start a long render:\n\n" + reasons.join("\n") +
                  "\n\nAfter Effects may run slower or become unresponsive.");
            appendHistory("Pre-render warning shown — " + reasons.join(" / "));
        } else if (alwaysAlert) {
            alert("System load looks fine. Good time to render.");
        }
    }

    // ---------------------------------------------------------------
    // SCHEDULED TASKS — assigned to $.global so app.scheduleTask's
    // by-name lookup finds them whether this runs as a dockable panel
    // or a one-off script.
    // ---------------------------------------------------------------
    var backupTaskId = null;
    function scheduleNextBackup() {
        if (backupTaskId !== null) { try { app.cancelTask(backupTaskId); } catch (e) {} backupTaskId = null; }
        if (!settings.enabled) return;
        var delayMs = Math.max(1, settings.intervalMinutes) * 60 * 1000;
        try { backupTaskId = app.scheduleTask("$.global.crashGuardBackupTick()", delayMs, false); } catch (e) {}
    }
    $.global.crashGuardBackupTick = function () {
        if (!settings.enabled) return;
        var ok = runBackup(true);
        if (ok) playNotifySound();
        scheduleNextBackup();
    };

    var monitorTaskId = null;
    var wasRendering = false;
    var wasHighLoad = false;
    function scheduleNextMonitorTick() {
        // 8s balances a responsive readout against the overhead of
        // launching PowerShell on Windows for each stat (CPU/RAM/temps).
        try { monitorTaskId = app.scheduleTask("$.global.crashGuardMonitorTick()", 8000, false); } catch (e) {}
    }
    $.global.crashGuardMonitorTick = function () {
        updateMonitorUI();
        try {
            var isRendering = !!(app.project && app.project.renderQueue && app.project.renderQueue.rendering);
            if (isRendering && !wasRendering) checkRenderReadiness(false);
            wasRendering = isRendering;
        } catch (e) {}
        scheduleNextMonitorTick();
    };

    // ---------------------------------------------------------------
    // UI HELPERS
    // ---------------------------------------------------------------
    function styledText(parent, label, size, weight, color, multiline) {
        var t = parent.add("statictext", undefined, label, multiline ? { multiline: true } : undefined);
        try {
            t.graphics.font = ScriptUI.newFont(FONT, weight, size);
            t.graphics.foregroundColor = t.graphics.newPen(t.graphics.PenType.SOLID_COLOR, color, 1);
        } catch (e) {}
        return t;
    }

    function flatButton(parent, label, onClick, fullWidth) {
        var group = parent.add("group");
        group.orientation = "column";
        group.alignChildren = ["fill", "center"];
        group.minimumSize.height = 40;
        if (fullWidth !== false) group.alignment = ["fill", "top"];

        var isOver = false;
        group.onDraw = function () {
            var g = this.graphics;
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, isOver ? BRAND.btnHover : BRAND.btn);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(fill);
        };

        var label_ = group.add("statictext", undefined, label);
        label_.alignment = ["center", "center"];
        try {
            label_.graphics.font = ScriptUI.newFont(FONT, "BOLD", 13);
            label_.graphics.foregroundColor = label_.graphics.newPen(label_.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}

        group.addEventListener("mouseover", function () { isOver = true; group.notify("onDraw"); });
        group.addEventListener("mouseout", function () { isOver = false; group.notify("onDraw"); });
        group.addEventListener("mousedown", function () { if (onClick) onClick(); });

        return group;
    }

    function card(parent) {
        var c = parent.add("group");
        c.orientation = "column";
        c.alignChildren = ["fill", "top"];
        c.spacing = 10;
        c.margins = 14;
        try {
            c.graphics.backgroundColor = c.graphics.newBrush(c.graphics.BrushType.SOLID_COLOR, BRAND.card);
        } catch (e) {}
        return c;
    }

    function divider(parent) {
        var d = parent.add("group");
        d.minimumSize.height = 1;
        d.maximumSize.height = 1;
        try {
            d.graphics.backgroundColor = d.graphics.newBrush(d.graphics.BrushType.SOLID_COLOR, BRAND.border);
        } catch (e) {}
        return d;
    }

    // ---------------------------------------------------------------
    // MONITOR UI STATE — filled in by buildUI(), read by the tick above.
    // ---------------------------------------------------------------
    var cpuValueText = null, ramValueText = null, ramSubText = null;
    var tempValueText = null, gpuValueText = null, explanationText = null;

    function updateMonitorUI() {
        try {
            var cpu = getCPULoad();
            if (cpuValueText) {
                cpuValueText.text = (cpu === null) ? "—" : (cpu + "%");
                try {
                    var cpuColor = (cpu !== null && cpu >= 85) ? BRAND.accent : BRAND.text;
                    cpuValueText.graphics.foregroundColor = cpuValueText.graphics.newPen(cpuValueText.graphics.PenType.SOLID_COLOR, cpuColor, 1);
                } catch (e) {}
            }

            var ram = getRAMUsage();
            if (ramValueText) {
                ramValueText.text = (ram === null) ? "—" : (ram.percent + "%");
                try {
                    var ramColor = (ram !== null && ram.percent >= 85) ? BRAND.accent : BRAND.text;
                    ramValueText.graphics.foregroundColor = ramValueText.graphics.newPen(ramValueText.graphics.PenType.SOLID_COLOR, ramColor, 1);
                } catch (e) {}
            }
            if (ramSubText) ramSubText.text = (ram === null) ? "" : (ram.usedGB.toFixed(1) + " / " + ram.totalGB.toFixed(1) + " GB");

            var temp = getCPUTemp();
            if (tempValueText) tempValueText.text = (temp === null) ? "Not available on this system" : (temp + "°C");

            var gpuTemp = getGPUTemp();
            if (gpuValueText) gpuValueText.text = (gpuTemp === null) ? "Not available on this system" : (gpuTemp + "°C");

            var explanations = [];
            if (cpu !== null && cpu >= 85) explanations.push("CPU is maxed out — expect slower previews and renders right now.");
            if (ram !== null && ram.percent >= 85) explanations.push("RAM usage is very high — this is likely why After Effects is lagging.");
            if (explanationText) explanationText.text = explanations.join("\n");

            var highNow = explanations.length > 0;
            if (highNow && !wasHighLoad) appendHistory("High load detected — " + explanations.join(" / "));
            wasHighLoad = highNow;
        } catch (e) {}
    }

    // ---------------------------------------------------------------
    // HISTORY VIEWER — secondary window
    // ---------------------------------------------------------------
    function showHistoryWindow() {
        var w = new Window("palette", "Crash Guard — History", undefined, { resizeable: true });
        w.orientation = "column";
        w.alignChildren = ["fill", "fill"];
        w.spacing = 10;
        w.margins = 16;
        w.preferredSize = [420, 380];
        try { w.graphics.backgroundColor = w.graphics.newBrush(w.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        styledText(w, "BACKUP & ISSUE HISTORY", 12, "BOLD", BRAND.muted);

        var box = w.add("edittext", undefined, readHistoryTail(300), { multiline: true, readonly: true, scrollable: true });
        box.alignment = ["fill", "fill"];
        try {
            box.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 12);
            box.graphics.foregroundColor = box.graphics.newPen(box.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
            box.graphics.backgroundColor = box.graphics.newBrush(box.graphics.BrushType.SOLID_COLOR, BRAND.card);
        } catch (e) {}

        flatButton(w, "Close", function () { w.close(); });

        w.center();
        w.show();
    }

    // ---------------------------------------------------------------
    // UI
    // ---------------------------------------------------------------
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Crash Guard by Kreevo", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 12;
        win.margins = 16;
        win.preferredSize.width = 380;

        try { win.graphics.backgroundColor = win.graphics.newBrush(win.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        // ---- Header ----
        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["left", "center"];
        header.spacing = 10;

        if (LOGO_FILE) {
            try {
                var logo = header.add("image", undefined, LOGO_FILE);
                logo.preferredSize = [30, 30];
            } catch (e) {}
        }

        styledText(header, "CRASH GUARD", 17, "BOLD", BRAND.text);

        var spacer = header.add("group");
        spacer.alignment = ["fill", "fill"];

        var badge = header.add("group");
        badge.orientation = "column";
        badge.alignChildren = ["center", "center"];
        badge.minimumSize = [82, 22];
        badge.onDraw = function () {
            var g = this.graphics;
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, BRAND.accent);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(fill);
        };
        var badgeText = badge.add("statictext", undefined, "by Kreevo");
        try {
            badgeText.graphics.font = ScriptUI.newFont(FONT, "BOLD", 11);
            badgeText.graphics.foregroundColor = badgeText.graphics.newPen(badgeText.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}

        if (possibleCrashDetected) {
            var crashBanner = styledText(win, "⚠ Last session didn't close cleanly — Crash Guard is watching closely.", 12, "REGULAR", BRAND.accent, true);
            crashBanner.alignment = ["fill", "top"];
            crashBanner.preferredSize = [340, 30];
        }

        divider(win);

        // ---- System Load card ----
        var loadCard = card(win);
        styledText(loadCard, "SYSTEM LOAD", 12, "BOLD", BRAND.muted);

        var statsRow = loadCard.add("group");
        statsRow.orientation = "row";
        statsRow.alignChildren = ["fill", "top"];
        statsRow.spacing = 20;

        var cpuCol = statsRow.add("group");
        cpuCol.orientation = "column";
        cpuCol.alignChildren = ["left", "top"];
        cpuCol.alignment = ["fill", "top"];
        styledText(cpuCol, "CPU", 11, "BOLD", BRAND.muted);
        cpuValueText = styledText(cpuCol, "—", 30, "BOLD", BRAND.text);

        var ramCol = statsRow.add("group");
        ramCol.orientation = "column";
        ramCol.alignChildren = ["left", "top"];
        ramCol.alignment = ["fill", "top"];
        styledText(ramCol, "RAM", 11, "BOLD", BRAND.muted);
        ramValueText = styledText(ramCol, "—", 30, "BOLD", BRAND.text);
        ramSubText = styledText(ramCol, "", 11, "REGULAR", BRAND.muted);

        var tempRow = loadCard.add("group");
        tempRow.orientation = "row";
        tempRow.alignChildren = ["fill", "top"];
        tempRow.spacing = 20;

        var tempCol = tempRow.add("group");
        tempCol.orientation = "column";
        tempCol.alignChildren = ["left", "top"];
        tempCol.alignment = ["fill", "top"];
        styledText(tempCol, "CPU TEMP", 11, "BOLD", BRAND.muted);
        tempValueText = styledText(tempCol, "Checking…", 13, "ITALIC", BRAND.muted, true);
        tempValueText.preferredSize = [160, 32];

        var gpuCol = tempRow.add("group");
        gpuCol.orientation = "column";
        gpuCol.alignChildren = ["left", "top"];
        gpuCol.alignment = ["fill", "top"];
        styledText(gpuCol, "GPU TEMP", 11, "BOLD", BRAND.muted);
        gpuValueText = styledText(gpuCol, "Checking…", 13, "ITALIC", BRAND.muted, true);
        gpuValueText.preferredSize = [160, 32];

        explanationText = loadCard.add("statictext", undefined, "", { multiline: true });
        explanationText.alignment = ["fill", "top"];
        explanationText.preferredSize = [340, 34];
        try {
            explanationText.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 12);
            explanationText.graphics.foregroundColor = explanationText.graphics.newPen(explanationText.graphics.PenType.SOLID_COLOR, BRAND.accent, 1);
        } catch (e) {}

        flatButton(loadCard, "Check before I render", function () { checkRenderReadiness(true); });

        // ---- Auto-Backup card ----
        var autoCard = card(win);
        styledText(autoCard, "AUTO-BACKUP", 12, "BOLD", BRAND.muted);

        var enableRow = autoCard.add("group");
        enableRow.orientation = "row";
        enableRow.alignChildren = ["left", "center"];
        var enableCheck = enableRow.add("checkbox", undefined, "  Enabled — protecting your work automatically");
        enableCheck.value = settings.enabled;
        try { enableCheck.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}

        var intervalRow = autoCard.add("group");
        intervalRow.orientation = "row";
        intervalRow.alignChildren = ["left", "center"];
        intervalRow.spacing = 8;
        styledText(intervalRow, "Every", 13, "REGULAR", BRAND.muted);
        var intervalInput = intervalRow.add("edittext", undefined, String(settings.intervalMinutes));
        intervalInput.characters = 4;
        try { intervalInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}
        styledText(intervalRow, "minutes", 13, "REGULAR", BRAND.muted);

        var keepRow = autoCard.add("group");
        keepRow.orientation = "row";
        keepRow.alignChildren = ["left", "center"];
        keepRow.spacing = 8;
        styledText(keepRow, "Keep last", 13, "REGULAR", BRAND.muted);
        var maxBackupsInput = keepRow.add("edittext", undefined, String(settings.maxBackups));
        maxBackupsInput.characters = 4;
        try { maxBackupsInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}
        styledText(keepRow, "backups", 13, "REGULAR", BRAND.muted);

        statusText = styledText(autoCard, settings.enabled ? "Auto-backup on" : "Auto-backup off", 12, "REGULAR", BRAND.muted);

        function applySettingsFromUI() {
            settings.enabled = enableCheck.value;

            var interval = parseInt(intervalInput.text, 10);
            if (isNaN(interval) || interval < 1) interval = 10;
            settings.intervalMinutes = interval;
            intervalInput.text = String(interval);

            var keep = parseInt(maxBackupsInput.text, 10);
            if (isNaN(keep) || keep < 1) keep = 20;
            settings.maxBackups = keep;
            maxBackupsInput.text = String(keep);

            saveSettings(settings);

            if (settings.enabled) {
                setStatus("Auto-backup on — every " + settings.intervalMinutes + " min");
                scheduleNextBackup();
            } else {
                setStatus("Auto-backup off");
                if (backupTaskId !== null) { try { app.cancelTask(backupTaskId); } catch (e) {} backupTaskId = null; }
            }
        }

        enableCheck.onClick = applySettingsFromUI;
        intervalInput.onChange = applySettingsFromUI;
        maxBackupsInput.onChange = applySettingsFromUI;

        // ---- Action buttons ----
        var actions = win.add("group");
        actions.orientation = "column";
        actions.alignChildren = ["fill", "top"];
        actions.spacing = 8;

        flatButton(actions, "Back up now", function () { runBackup(false); });
        flatButton(actions, "Run health check", runHealthCheck);
        flatButton(actions, "View history log", showHistoryWindow);

        divider(win);

        // ---- Restore card ----
        var restoreCard = card(win);
        styledText(restoreCard, "RECENT BACKUPS", 12, "BOLD", BRAND.muted);

        var backupDropdown = restoreCard.add("dropdownlist", undefined, []);
        backupDropdown.alignment = ["fill", "top"];
        try { backupDropdown.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}

        function refreshBackupList() {
            backupDropdown.removeAll();
            var files = listBackups();
            for (var i = 0; i < files.length; i++) backupDropdown.add("item", files[i].name);
            backupDropdown._files = files;
            if (files.length > 0) backupDropdown.selection = 0;
        }
        refreshBackupList();

        var restoreActions = restoreCard.add("group");
        restoreActions.orientation = "column";
        restoreActions.alignChildren = ["fill", "top"];
        restoreActions.spacing = 8;

        flatButton(restoreActions, "Restore selected", function () {
            var idx = backupDropdown.selection ? backupDropdown.selection.index : -1;
            if (idx < 0 || !backupDropdown._files || !backupDropdown._files[idx]) {
                alert("Select a backup from the list first.");
                return;
            }
            restoreBackup(backupDropdown._files[idx]);
        });
        flatButton(restoreActions, "Refresh list", refreshBackupList);

        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () { this.layout.resize(); };

        win.onClose = function () {
            if (monitorTaskId !== null) { try { app.cancelTask(monitorTaskId); } catch (e) {} }
            clearSessionMarker();
        };

        if (settings.enabled) scheduleNextBackup();
        updateMonitorUI();
        scheduleNextMonitorTick();

        return win;
    }

    var panel = buildUI(thisObj);
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
