// ============================================================
// FUTA 100L SURVIVAL GUIDE — SUPABASE CONFIGURATION
// File: supabase-config.js
// Version: 2.0.0
// Load this BEFORE db.js on every page
// ============================================================

(function (global) {
    'use strict';

    // ---------- CREDENTIALS ----------
    const SUPABASE_URL = 'https://othustwbygpxcynfnhuc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90aHVzdHdieWdweGN5bmZuaHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDY0OTgsImV4cCI6MjEwNTY4MjQ5OH0.NUoWMeLuqUp94zTcWhZzNDt1AtGI8BEeWyUuL_vk7D8';

    // ---------- GLOBAL CONFIG ----------
    const CONFIG = {
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
        formSubmitEmail: 'helpinghandshallneverfall@gmail.com',
        adminEmail: 'helpinghandshallneverfall@gmail.com',
        version: '2.0.0',
        sessionKey: 'futa_guide_session',
        profileCacheKey: 'futa_guide_profile',
        debug: false, // set to true to see verbose logs
        tables: {
            admins: 'admins',
            profiles: 'profiles',
            submissions: 'user_submissions',
            businesses: 'businesses',
            feedback: 'feedback',
            calculator: 'calculator_usage',
            courses: 'courses',
            calendar: 'calendar_events',
            settings: 'site_settings'
        }
    };

    // ---------- SUPABASE CLIENT ----------
    let supabaseClient = null;

    function initSupabase() {
        if (supabaseClient) return supabaseClient;

        if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
            console.error('[Supabase] SDK not loaded. Make sure to include the CDN script before supabase-config.js');
            return null;
        }

        try {
            supabaseClient = window.supabase.createClient(
                CONFIG.supabaseUrl,
                CONFIG.supabaseAnonKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: false,
                        storageKey: CONFIG.sessionKey
                    },
                    realtime: {
                        params: { eventsPerSecond: 10 }
                    }
                }
            );
            if (CONFIG.debug) console.log('[Supabase] Client initialized ✓');
            return supabaseClient;
        } catch (err) {
            console.error('[Supabase] Init failed:', err);
            return null;
        }
    }

    // ---------- UTILITIES ----------
    const Utils = {
        /** Safe UUID generator */
        uuid() {
            if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },

        /** Simple debounce */
        debounce(fn, wait = 300) {
            let t;
            return function (...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), wait);
            };
        },

        /** Format date nicely */
        formatDate(date, opts = {}) {
            if (!date) return 'N/A';
            const d = typeof date === 'string' ? new Date(date) : date;
            if (isNaN(d.getTime())) return 'N/A';
            return d.toLocaleString('en-NG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                ...opts
            });
        },

        /** Escape HTML to prevent XSS */
        escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        /** Truncate text */
        truncate(str, max = 60) {
            if (!str) return '';
            str = String(str);
            return str.length > max ? str.slice(0, max) + '…' : str;
        },

        /** Export JSON to CSV */
        jsonToCSV(data) {
            if (!Array.isArray(data) || data.length === 0) return '';
            const headers = Array.from(
                data.reduce((set, row) => {
                    Object.keys(row || {}).forEach(k => set.add(k));
                    return set;
                }, new Set())
            );
            const escape = (v) => {
                if (v === null || v === undefined) return '';
                let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
                return s;
            };
            const rows = data.map(row => headers.map(h => escape(row[h])).join(','));
            return [headers.join(','), ...rows].join('\n');
        },

        /** Trigger file download */
        downloadBlob(content, filename, type = 'text/plain') {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },

        /** Toast notification */
        toast(message, type = 'info', duration = 3000) {
            const existing = document.getElementById('futa-toast-container');
            let container = existing;
            if (!container) {
                container = document.createElement('div');
                container.id = 'futa-toast-container';
                container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
                document.body.appendChild(container);
            }
            const colors = {
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6'
            };
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            const el = document.createElement('div');
            el.style.cssText = `
                background:${colors[type] || colors.info};
                color:white;
                padding:12px 20px;
                border-radius:8px;
                box-shadow:0 10px 25px rgba(0,0,0,0.15);
                font-family:'Segoe UI',sans-serif;
                font-size:0.95rem;
                font-weight:600;
                display:flex;
                align-items:center;
                gap:10px;
                min-width:240px;
                max-width:340px;
                pointer-events:auto;
                opacity:0;
                transform:translateX(40px);
                transition:all 0.3s ease;
            `;
            el.innerHTML = `<span style="font-size:1.1rem;">${icons[type] || icons.info}</span><span>${Utils.escapeHtml(message)}</span>`;
            container.appendChild(el);
            requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateX(0)';
            });
            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transform = 'translateX(40px)';
                setTimeout(() => el.remove(), 300);
            }, duration);
        }
    };

    // ---------- LOCAL STORAGE HELPERS ----------
    const Storage = {
        get(key, fallback = null) {
            try {
                const v = localStorage.getItem(key);
                return v ? JSON.parse(v) : fallback;
            } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch {}
        },
        clearAll() {
            try {
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('futa_guide_') || k === 'appVersion' || k === 'onboarded') {
                        localStorage.removeItem(k);
                    }
                });
            } catch {}
        }
    };

    // ---------- EXPOSE GLOBALLY ----------
    global.FUTA_CONFIG = CONFIG;
    global.FUTA_UTILS = Utils;
    global.FUTA_STORAGE = Storage;
    global.getSupabase = initSupabase;

    // Auto-init when DOM ready (or immediately if already loaded)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }

    if (CONFIG.debug) console.log('[FUTA Config] Loaded v' + CONFIG.version);
})(window);
