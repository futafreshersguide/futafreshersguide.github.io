// ============================================================
// FUTA 100L SURVIVAL GUIDE — DATABASE LAYER
// File: db.js
// Version: 2.1.1
// Depends on: supabase-config.js
// ============================================================

(function (global) {
    'use strict';

    const CONFIG = global.FUTA_CONFIG;
    const Utils = global.FUTA_UTILS;
    const Storage = global.FUTA_STORAGE;

    if (!CONFIG) {
        console.error('[DB] supabase-config.js must be loaded first');
        return;
    }

    function sb() {
        const client = global.getSupabase ? global.getSupabase() : null;
        if (!client) throw new Error('[DB] Supabase client not available');
        return client;
    }

    async function query(table, builder, { silent = false } = {}) {
        try {
            const { data, error } = await builder;
            if (error) throw error;
            return { ok: true, data };
        } catch (err) {
            if (!silent) console.error(`[DB:${table}]`, err.message || err);
            return { ok: false, error: err.message || String(err), data: null };
        }
    }

    // ---------- AUTH ----------
    const Auth = {
        async signIn(email, password) {
            const { data, error } = await sb().auth.signInWithPassword({ email, password });
            if (error) return { ok: false, error: error.message };
            try {
                await sb().from(CONFIG.tables.admins)
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', data.user.id);
            } catch (_) {}
            return { ok: true, user: data.user, session: data.session };
        },

        async signOut() {
            const { error } = await sb().auth.signOut();
            Storage.remove(CONFIG.profileCacheKey);
            return { ok: !error, error: error?.message };
        },

        async getSession() {
            const { data, error } = await sb().auth.getSession();
            if (error) return { ok: false, error: error.message, session: null };
            return { ok: true, session: data.session };
        },

        async getUser() {
            const { data, error } = await sb().auth.getUser();
            if (error) return { ok: false, error: error.message, user: null };
            return { ok: true, user: data.user };
        },

        async getAdminProfile() {
            const u = await Auth.getUser();
            if (!u.ok || !u.user) return { ok: false, error: 'No user', admin: null };

            const cached = Storage.get(CONFIG.profileCacheKey);
            if (cached && cached.id === u.user.id && (Date.now() - cached.ts < 5 * 60 * 1000)) {
                return { ok: true, admin: cached.data };
            }

            const res = await query(CONFIG.tables.admins,
                sb().from(CONFIG.tables.admins).select('*').eq('id', u.user.id).maybeSingle());
            if (!res.ok) return { ok: false, error: res.error, admin: null };
            if (!res.data) return { ok: false, error: 'Not an admin', admin: null };

            Storage.set(CONFIG.profileCacheKey, { id: u.user.id, data: res.data, ts: Date.now() });
            return { ok: true, admin: res.data };
        },

        onChange(callback) {
            return sb().auth.onAuthStateChange((event, session) => callback(event, session));
        }
    };

    // ---------- PROFILES ----------
    const Profiles = {
        async create(payload) {
            const row = {
                full_name: payload.full_name,
                department: payload.department,
                whatsapp: payload.whatsapp || null,
                level: payload.level || null,
                is_fresher: payload.is_fresher || null,
                semester_guide: payload.semester_guide || null,
                device_info: payload.device_info || null,
                user_agent: navigator.userAgent || null,
                ip_hash: null
            };
            return query(CONFIG.tables.profiles,
                sb().from(CONFIG.tables.profiles).insert(row).select().single());
        },

        async list({ search = '', semester = '', limit = 500, offset = 0 } = {}) {
            let b = sb().from(CONFIG.tables.profiles).select('*', { count: 'exact' });
            if (semester) b = b.eq('semester_guide', semester);
            if (search) b = b.or(`full_name.ilike.%${search}%,department.ilike.%${search}%`);
            b = b.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            return query(CONFIG.tables.profiles, b);
        },

        async count() {
            const res = await query(CONFIG.tables.profiles,
                sb().from(CONFIG.tables.profiles).select('*', { count: 'exact', head: true }));
            return res.ok ? res.data : null;
        },

        async remove(id) {
            return query(CONFIG.tables.profiles,
                sb().from(CONFIG.tables.profiles).delete().eq('id', id));
        }
    };

    // ---------- SUBMISSIONS ----------
    const Submissions = {
        async create(payload) {
            const row = {
                name: payload.name,
                department: payload.department,
                whatsapp: payload.whatsapp || null,
                level: payload.level || null,
                is_fresher: payload.is_fresher || null,
                semester: payload.semester || null,
                source: payload.source || 'web'
            };
            if (payload.profile_id) row.profile_id = payload.profile_id;
            return query(CONFIG.tables.submissions,
                sb().from(CONFIG.tables.submissions).insert(row).select().single());
        },

        async list({ search = '', semester = '', limit = 1000, offset = 0 } = {}) {
            let b = sb().from(CONFIG.tables.submissions).select('*', { count: 'exact' });
            if (semester) b = b.eq('semester', semester);
            if (search) b = b.or(`name.ilike.%${search}%,department.ilike.%${search}%`);
            b = b.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            return query(CONFIG.tables.submissions, b);
        },

        async stats() {
            const [total, first, second, today] = await Promise.all([
                query(CONFIG.tables.submissions, sb().from(CONFIG.tables.submissions).select('*', { count: 'exact', head: true }), { silent: true }),
                query(CONFIG.tables.submissions, sb().from(CONFIG.tables.submissions).select('*', { count: 'exact', head: true }).eq('semester', 'first'), { silent: true }),
                query(CONFIG.tables.submissions, sb().from(CONFIG.tables.submissions).select('*', { count: 'exact', head: true }).eq('semester', 'second'), { silent: true }),
                query(CONFIG.tables.submissions, sb().from(CONFIG.tables.submissions).select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()), { silent: true })
            ]);
            return {
                total: total.data ?? 0,
                first: first.data ?? 0,
                second: second.data ?? 0,
                today: today.data ?? 0
            };
        },

        async remove(id) {
            return query(CONFIG.tables.submissions,
                sb().from(CONFIG.tables.submissions).delete().eq('id', id));
        },

        async removeAll() {
            return query(CONFIG.tables.submissions,
                sb().from(CONFIG.tables.submissions).delete().neq('id', '00000000-0000-0000-0000-000000000000'));
        }
    };

    // ---------- BUSINESSES ----------
    const Businesses = {
        async create(payload) {
            const row = {
                business_name: payload.business_name,
                category: payload.category,
                description: payload.description || null,
                location: payload.location || null,
                phone: payload.phone,
                owner_name: payload.owner_name || null,
                owner_department: payload.owner_department || null,
                status: 'pending'
            };
            return query(CONFIG.tables.businesses,
                sb().from(CONFIG.tables.businesses).insert(row).select().single());
        },

        async listApproved({ category = '', search = '' } = {}) {
            let b = sb().from(CONFIG.tables.businesses)
                .select('*')
                .eq('status', 'approved')
                .order('is_featured', { ascending: false })
                .order('created_at', { ascending: false });
            if (category) b = b.eq('category', category);
            if (search) b = b.or(`business_name.ilike.%${search}%,description.ilike.%${search}%`);
            return query(CONFIG.tables.businesses, b);
        },

        async listAll({ status = '', category = '', search = '', limit = 1000, offset = 0 } = {}) {
            let b = sb().from(CONFIG.tables.businesses).select('*', { count: 'exact' });
            if (status) b = b.eq('status', status);
            if (category) b = b.eq('category', category);
            if (search) b = b.or(`business_name.ilike.%${search}%,owner_name.ilike.%${search}%`);
            b = b.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            return query(CONFIG.tables.businesses, b);
        },

        async updateStatus(id, status, adminId, notes = null) {
            const row = {
                status,
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString()
            };
            if (notes !== null) row.admin_notes = notes;
            return query(CONFIG.tables.businesses,
                sb().from(CONFIG.tables.businesses).update(row).eq('id', id).select().single());
        },

        async toggleFeatured(id, featured) {
            return query(CONFIG.tables.businesses,
                sb().from(CONFIG.tables.businesses).update({ is_featured: featured }).eq('id', id).select().single());
        },

        async stats() {
            const [total, pending, approved, rejected, featured] = await Promise.all([
                query(CONFIG.tables.businesses, sb().from(CONFIG.tables.businesses).select('*', { count: 'exact', head: true }), { silent: true }),
                query(CONFIG.tables.businesses, sb().from(CONFIG.tables.businesses).select('*', { count: 'exact', head: true }).eq('status', 'pending'), { silent: true }),
                query(CONFIG.tables.businesses, sb().from(CONFIG.tables.businesses).select('*', { count: 'exact', head: true }).eq('status', 'approved'), { silent: true }),
                query(CONFIG.tables.businesses, sb().from(CONFIG.tables.businesses).select('*', { count: 'exact', head: true }).eq('status', 'rejected'), { silent: true }),
                query(CONFIG.tables.businesses, sb().from(CONFIG.tables.businesses).select('*', { count: 'exact', head: true }).eq('is_featured', true), { silent: true })
            ]);
            return {
                total: total.data ?? 0, pending: pending.data ?? 0,
                approved: approved.data ?? 0, rejected: rejected.data ?? 0,
                featured: featured.data ?? 0
            };
        },

        async remove(id) {
            return query(CONFIG.tables.businesses,
                sb().from(CONFIG.tables.businesses).delete().eq('id', id));
        },

        async categories() {
            const res = await query(CONFIG.tables.businesses,
                sb().from(CONFIG.tables.businesses).select('category').eq('status', 'approved'));
            if (!res.ok) return [];
            return [...new Set((res.data || []).map(r => r.category).filter(Boolean))].sort();
        }
    };

    // ---------- FEEDBACK ----------
    const Feedback = {
        async create(payload) {
            const row = {
                name: payload.name,
                email: payload.email,
                subject: payload.subject || null,
                message: payload.message
            };
            return query(CONFIG.tables.feedback,
                sb().from(CONFIG.tables.feedback).insert(row).select().single());
        },

        async list({ onlyUnread = false, search = '', limit = 500, offset = 0 } = {}) {
            let b = sb().from(CONFIG.tables.feedback).select('*', { count: 'exact' });
            if (onlyUnread) b = b.eq('is_read', false);
            if (search) b = b.or(`name.ilike.%${search}%,email.ilike.%${search}%,message.ilike.%${search}%`);
            b = b.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            return query(CONFIG.tables.feedback, b);
        },

        async markRead(id, isRead = true) {
            return query(CONFIG.tables.feedback,
                sb().from(CONFIG.tables.feedback).update({ is_read: isRead }).eq('id', id).select().single());
        },

        async toggleStar(id, isStarred) {
            return query(CONFIG.tables.feedback,
                sb().from(CONFIG.tables.feedback).update({ is_starred: isStarred }).eq('id', id).select().single());
        },

        async reply(id, replyText) {
            return query(CONFIG.tables.feedback,
                sb().from(CONFIG.tables.feedback)
                    .update({ admin_reply: replyText, replied_at: new Date().toISOString(), is_read: true })
                    .eq('id', id).select().single());
        },

        async stats() {
            const [total, unread, starred] = await Promise.all([
                query(CONFIG.tables.feedback, sb().from(CONFIG.tables.feedback).select('*', { count: 'exact', head: true }), { silent: true }),
                query(CONFIG.tables.feedback, sb().from(CONFIG.tables.feedback).select('*', { count: 'exact', head: true }).eq('is_read', false), { silent: true }),
                query(CONFIG.tables.feedback, sb().from(CONFIG.tables.feedback).select('*', { count: 'exact', head: true }).eq('is_starred', true), { silent: true })
            ]);
            return { total: total.data ?? 0, unread: unread.data ?? 0, starred: starred.data ?? 0 };
        },

        async remove(id) {
            return query(CONFIG.tables.feedback,
                sb().from(CONFIG.tables.feedback).delete().eq('id', id));
        }
    };

    // ---------- CALCULATOR ----------
    const Calculator = {
        async log(payload) {
            const row = {
                name: payload.name || null,
                department: payload.department || null,
                level: payload.level || null,
                action: payload.action || 'page_visit',
                calculation_type: payload.calculation_type || null,
                result_value: payload.result_value || null,
                page_source: payload.page_source || null,
                user_agent: navigator.userAgent || null
            };
            if (payload.profile_id) row.profile_id = payload.profile_id;
            return query(CONFIG.tables.calculator,
                sb().from(CONFIG.tables.calculator).insert(row), { silent: true });
        },

        async list({ action = '', calculationType = '', search = '', limit = 500, offset = 0 } = {}) {
            let b = sb().from(CONFIG.tables.calculator).select('*', { count: 'exact' });
            if (action) b = b.eq('action', action);
            if (calculationType) b = b.eq('calculation_type', calculationType);
            if (search) b = b.or(`name.ilike.%${search}%,department.ilike.%${search}%`);
            b = b.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            return query(CONFIG.tables.calculator, b);
        },

        async stats() {
            const [total, calcs, pdfs, visits] = await Promise.all([
                query(CONFIG.tables.calculator, sb().from(CONFIG.tables.calculator).select('*', { count: 'exact', head: true }), { silent: true }),
                query(CONFIG.tables.calculator, sb().from(CONFIG.tables.calculator).select('*', { count: 'exact', head: true }).eq('action', 'calculation'), { silent: true }),
                query(CONFIG.tables.calculator, sb().from(CONFIG.tables.calculator).select('*', { count: 'exact', head: true }).eq('action', 'pdf_download'), { silent: true }),
                query(CONFIG.tables.calculator, sb().from(CONFIG.tables.calculator).select('*', { count: 'exact', head: true }).eq('action', 'page_visit'), { silent: true })
            ]);
            return {
                total: total.data ?? 0, calculations: calcs.data ?? 0,
                pdfs: pdfs.data ?? 0, visits: visits.data ?? 0
            };
        },

        async remove(id) {
            return query(CONFIG.tables.calculator,
                sb().from(CONFIG.tables.calculator).delete().eq('id', id));
        },

        // ✅ Added removeAll for danger-zone "Clear Calculator Logs"
        async removeAll() {
            return query(CONFIG.tables.calculator,
                sb().from(CONFIG.tables.calculator).delete().neq('id', '00000000-0000-0000-0000-000000000000'));
        }
    };

    // ---------- COURSES ----------
    const Courses = {
        async list({ semester = '', level = '100', onlyActive = true } = {}) {
            let b = sb().from(CONFIG.tables.courses).select('*');
            if (semester) b = b.eq('semester', semester);
            if (level) b = b.eq('level', level);
            if (onlyActive) b = b.eq('is_active', true);
            b = b.order('display_order', { ascending: true });
            return query(CONFIG.tables.courses, b);
        },

        async get(code) {
            return query(CONFIG.tables.courses,
                sb().from(CONFIG.tables.courses).select('*').eq('code', code).maybeSingle());
        },

        async create(payload) {
            return query(CONFIG.tables.courses,
                sb().from(CONFIG.tables.courses).insert(payload).select().single());
        },

        async update(id, payload) {
            return query(CONFIG.tables.courses,
                sb().from(CONFIG.tables.courses).update(payload).eq('id', id).select().single());
        },

        async remove(id) {
            return query(CONFIG.tables.courses,
                sb().from(CONFIG.tables.courses).delete().eq('id', id));
        }
    };

    // ---------- CALENDAR ----------
    const Calendar = {
        async list({ semester = '', session = '2026/2027' } = {}) {
            let b = sb().from(CONFIG.tables.calendar).select('*');
            if (semester) b = b.eq('semester', semester);
            if (session) b = b.eq('session', session);
            b = b.order('event_date', { ascending: true });
            return query(CONFIG.tables.calendar, b);
        },

        async upcoming(limit = 5) {
            const today = new Date().toISOString().slice(0, 10);
            return query(CONFIG.tables.calendar,
                sb().from(CONFIG.tables.calendar)
                    .select('*').gte('event_date', today)
                    .order('event_date', { ascending: true }).limit(limit));
        },

        async create(payload) {
            return query(CONFIG.tables.calendar,
                sb().from(CONFIG.tables.calendar).insert(payload).select().single());
        },

        async update(id, payload) {
            return query(CONFIG.tables.calendar,
                sb().from(CONFIG.tables.calendar).update(payload).eq('id', id).select().single());
        },

        async remove(id) {
            return query(CONFIG.tables.calendar,
                sb().from(CONFIG.tables.calendar).delete().eq('id', id));
        }
    };

    // ---------- SETTINGS ----------
    const Settings = {
        async get(key) {
            const res = await query(CONFIG.tables.settings,
                sb().from(CONFIG.tables.settings).select('*').eq('key', key).maybeSingle());
            return res.ok && res.data ? res.data.value : null;
        },

        async getAll() {
            const res = await query(CONFIG.tables.settings,
                sb().from(CONFIG.tables.settings).select('*'));
            if (!res.ok) return {};
            return (res.data || []).reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});
        },

        async set(key, value) {
            return query(CONFIG.tables.settings,
                sb().from(CONFIG.tables.settings)
                    .upsert({ key, value, updated_at: new Date().toISOString() })
                    .select().single());
        }
    };

    // ---------- CONTENT BLOCKS ----------
    const Content = {
        async getPage(page) {
            const res = await query(CONFIG.tables.content,
                sb().rpc('get_page_content', { p_page: page }), { silent: true });
            if (!res.ok) return {};
            return (res.data || []).reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});
        },

        async listAll({ page = '', category = '', search = '' } = {}) {
            let b = sb().from(CONFIG.tables.content)
                .select('*')
                .order('page').order('category').order('display_order');
            if (page) b = b.eq('page', page);
            if (category) b = b.eq('category', category);
            if (search) b = b.or(`key.ilike.%${search}%,label.ilike.%${search}%,description.ilike.%${search}%`);
            return query(CONFIG.tables.content, b);
        },

        async update(key, value, adminId) {
            return query(CONFIG.tables.content,
                sb().from(CONFIG.tables.content)
                    .update({ value, updated_by: adminId, updated_at: new Date().toISOString() })
                    .eq('key', key).select().single());
        },

        async create(payload) {
            return query(CONFIG.tables.content,
                sb().from(CONFIG.tables.content).insert(payload).select().single());
        },

        async remove(key) {
            return query(CONFIG.tables.content,
                sb().from(CONFIG.tables.content).delete().eq('key', key));
        }
    };

    // ---------- NOTIFICATIONS ----------
    const Notifications = {
        async listActive({ audience = 'all' } = {}) {
            const now = new Date().toISOString();
            let b = sb().from(CONFIG.tables.notifications).select('*')
                .eq('is_active', true)
                .lte('publish_at', now)
                .or(`expires_at.is.null,expires_at.gt.${now}`);
            if (audience && audience !== 'all') {
                b = b.in('target_audience', ['all', audience]);
            }
            b = b.order('is_pinned', { ascending: false })
                 .order('priority', { ascending: true })
                 .order('publish_at', { ascending: false });
            return query(CONFIG.tables.notifications, b, { silent: true });
        },

        async listAll({ search = '', onlyActive = false } = {}) {
            let b = sb().from(CONFIG.tables.notifications).select('*');
            if (onlyActive) b = b.eq('is_active', true);
            if (search) b = b.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
            b = b.order('is_pinned', { ascending: false })
                 .order('created_at', { ascending: false });
            return query(CONFIG.tables.notifications, b);
        },

        async create(payload, adminId) {
            const row = {
                title: payload.title,
                message: payload.message,
                type: payload.type || 'info',
                priority: payload.priority || 5,
                target_audience: payload.target_audience || 'all',
                is_dismissible: payload.is_dismissible !== false,
                is_pinned: payload.is_pinned === true,
                is_active: payload.is_active !== false,
                publish_at: payload.publish_at || new Date().toISOString(),
                expires_at: payload.expires_at || null,
                link_url: payload.link_url || null,
                link_label: payload.link_label || null,
                created_by: adminId
            };
            return query(CONFIG.tables.notifications,
                sb().from(CONFIG.tables.notifications).insert(row).select().single());
        },

        async update(id, payload) {
            return query(CONFIG.tables.notifications,
                sb().from(CONFIG.tables.notifications).update(payload).eq('id', id).select().single());
        },

        async toggleActive(id, active) {
            return query(CONFIG.tables.notifications,
                sb().from(CONFIG.tables.notifications).update({ is_active: active }).eq('id', id).select().single());
        },

        async remove(id) {
            return query(CONFIG.tables.notifications,
                sb().from(CONFIG.tables.notifications).delete().eq('id', id));
        },

        async logRead(notificationId, profileId, dismissed = false) {
            return query(CONFIG.tables.notifReads,
                sb().from(CONFIG.tables.notifReads).insert({
                    notification_id: notificationId,
                    profile_id: profileId,
                    dismissed
                }), { silent: true });
        },

        async stats() {
            const [total, active, pinned] = await Promise.all([
                query(CONFIG.tables.notifications, sb().from(CONFIG.tables.notifications).select('*', { count: 'exact', head: true }), { silent: true }),
                query(CONFIG.tables.notifications, sb().from(CONFIG.tables.notifications).select('*', { count: 'exact', head: true }).eq('is_active', true), { silent: true }),
                query(CONFIG.tables.notifications, sb().from(CONFIG.tables.notifications).select('*', { count: 'exact', head: true }).eq('is_pinned', true), { silent: true })
            ]);
            return { total: total.data ?? 0, active: active.data ?? 0, pinned: pinned.data ?? 0 };
        }
    };

    // ---------- SESSIONS ----------
    const Sessions = {
        async listAll() {
            return query(CONFIG.tables.sessions,
                sb().from(CONFIG.tables.sessions).select('*').order('start_date', { ascending: false }));
        },

        async getActive() {
            return query(CONFIG.tables.sessions,
                sb().from(CONFIG.tables.sessions).select('*').eq('is_active', true).maybeSingle());
        },

        async setActive(id) {
            await query(CONFIG.tables.sessions,
                sb().from(CONFIG.tables.sessions).update({ is_active: false })
                    .neq('id', '00000000-0000-0000-0000-000000000000'),
                { silent: true });
            return query(CONFIG.tables.sessions,
                sb().from(CONFIG.tables.sessions).update({ is_active: true }).eq('id', id).select().single());
        },

        async create(payload) {
            return query(CONFIG.tables.sessions,
                sb().from(CONFIG.tables.sessions).insert(payload).select().single());
        },

        async update(id, payload) {
            return query(CONFIG.tables.sessions,
                sb().from(CONFIG.tables.sessions).update(payload).eq('id', id).select().single());
        },

        async remove(id) {
            return query(CONFIG.tables.sessions,
                sb().from(CONFIG.tables.sessions).delete().eq('id', id));
        }
    };

    // ---------- ACTIVITY ----------
    const Activity = {
        async list({ entityType = '', action = '', search = '', limit = 200, offset = 0 } = {}) {
            let b = sb().from(CONFIG.tables.activity).select('*', { count: 'exact' });
            if (entityType) b = b.eq('entity_type', entityType);
            if (action) b = b.eq('action', action);
            if (search) b = b.or(`entity_label.ilike.%${search}%,admin_email.ilike.%${search}%`);
            b = b.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            return query(CONFIG.tables.activity, b);
        },

        async log(payload) {
            return query(CONFIG.tables.activity,
                sb().from(CONFIG.tables.activity).insert(payload), { silent: true });
        }
    };

    // ---------- REALTIME ----------
    function subscribe(table, callback, filter = null) {
        try {
            const channelName = `realtime:${table}:${Date.now()}`;
            const opts = { event: '*', schema: 'public', table };
            if (filter) opts.filter = filter;
            return sb()
                .channel(channelName)
                .on('postgres_changes', opts, (payload) => callback(payload))
                .subscribe();
        } catch (err) {
            console.error('[Realtime] Subscribe failed:', err);
            return null;
        }
    }

    function unsubscribe(channel) {
        try { if (channel) sb().removeChannel(channel); } catch {}
    }

    async function healthCheck() {
        try {
            const { error } = await sb().from(CONFIG.tables.settings).select('key').limit(1);
            return { ok: !error, error: error?.message };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    // ---------- EXPOSE ----------
    global.DB = {
        Auth, Profiles, Submissions, Businesses, Feedback, Calculator,
        Courses, Calendar, Settings,
        Content, Notifications, Sessions, Activity,
        subscribe, unsubscribe, healthCheck,
        _query: query
    };

    if (CONFIG.debug) console.log('[FUTA DB] Loaded v' + CONFIG.version);
})(window);
