/**
 * Internationalization (i18n) Module
 * Supports English (en), Bahasa Indonesia (id), and Italiano (it).
 * Follows Anti-Slop principles: natural human phrasing, no corporate AI fluff.
 */

const TRANSLATIONS = {
    en: {
        // Navbar & Brand
        brand_subtitle: "Bondage Club Synchronized Room Audio & Remote Control",
        room_label: "Room:",
        connecting: "Connecting...",
        status_online: "Online",
        status_outside: "Outside Room",
        status_offline: "Offline",
        theme_toggle_title: "Toggle Light / Dark Theme",
        lang_select_title: "Select Interface Language",

        // Now Playing Card
        now_playing_tag: "NOW PLAYING",
        no_music_title: "No music currently playing",
        no_music_sub: "Use controls below or type !play in room chat",
        playing_synchronized: "Playing synchronized for all players in room",
        radio_playing_sub: "24/7 Radio Station (Online Stream)",
        req_by_label: "Requested by:",
        listen_browser: "Listen in Browser",
        stop_browser: "Stop Audio",
        web_player_hint: "Synchronized with in-game room audio",
        live_stream: "Live",
        live_247: "24/7",
        badge_yt: "YouTube Audio",
        badge_radio: "24/7 Radio",

        // Music Controls Card
        music_controls_tag: "MUSIC PLAYER CONTROLS",
        remote_control_badge: "Remote Control",
        label_song_query: "Song Title or URL (YouTube / .mp3 / .mp4):",
        placeholder_song_query: "e.g. Linkin Park Numb or YouTube link...",
        label_requester: "Requester Name:",
        placeholder_requester: "Your Name (Web DJ)",
        btn_play_track: "Play / Queue Track",
        btn_skip_track: "Skip Track",
        btn_stop_music: "Stop Music",
        btn_clear_queue: "Clear Queue",
        radio_stations_label: "24/7 Radio Stations:",
        radio_stations_sub: "(Click to play instantly)",

        // Room Status Card
        room_status_tag: "ROOM STATUS & MEMBERS",
        label_room_name: "Room Name",
        label_bot_char: "Bot Character",
        label_friends_count: "Friends Count",
        players_in_room_title: "Players in Room:",
        players_empty_hint: "Bot is waiting in the room, no other players present.",
        players_count_suffix: "Players",

        // Upcoming Queue Card
        queue_tag: "UPCOMING QUEUE",
        queue_empty_title: "Queue is Empty",
        queue_empty_desc: "Use the player form or type !play title in room chat to queue a track.",
        queue_req_by: "Req by:",

        // Room Administration Card
        room_admin_tag: "ROOM ADMINISTRATION",
        badge_room_admin: "Room Admin",
        tab_admin: "👑 Admin",
        tab_whitelist: "📜 Whitelist",
        tab_banlist: "🚫 Banlist",
        tab_kick: "👢 Kick",
        btn_add_admin: "+ Add Admin",
        btn_add_whitelist: "+ Add to Whitelist",
        btn_ban_member: "+ Ban Member",
        btn_kick_member: "👢 Kick from Room",
        admin_list_title: "Room Administrators List:",
        admin_list_empty: "No administrators registered.",
        wl_list_title: "Whitelist Members:",
        wl_list_empty: "Whitelist is empty (public access open).",
        ban_list_title: "Banned Members List:",
        ban_list_empty: "No banned members.",
        kick_note: "⚠️ Kicked players will be immediately removed from the room.",
        placeholder_member_id: "Member Number (e.g. 245253)",
        placeholder_kick_id: "Member Number to kick...",

        // Room Interaction & Expressions Card
        chat_tag: "ROOM INTERACTION & BOT EXPRESSIONS",
        badge_live_comms: "Live Comms",
        placeholder_chat_msg: "Type a message for Nava to say in the room...",
        option_emote: "Emote Message (*)",
        option_chat: "Normal Chat",
        btn_send_chat: "Send",
        expr_label: "Bot Facial Expressions:",
        expr_happy: "😊 Happy",
        expr_wink: "😉 Wink",
        expr_sing: "🎶 Sing",
        expr_thinking: "🤔 Thinking",
        expr_blush: "😳 Blush",
        expr_closed: "😌 Closed",

        // Authorized Members Card
        auth_tag: "AUTHORIZED MEMBERS & COMMANDS",
        auth_add_title: "Add Authorized Member:",
        btn_add_auth: "+ Add Member",
        auth_note: "💡 Authorized Members have permission to control the bot via in-game beeps/whispers, immunity from kick/ban, and full access to this Web Dashboard.",
        auth_list_title: "Current Authorized Members:",
        auth_empty_hint: "No authorized members registered. Add a member number above.",
        auth_commands_title: "⚡ Authorized Member Commands:",
        auth_beep_badge: "📡 In-Game Beep Command",
        auth_beep_desc: "Send a beep to Nava (#258115) to command the bot to switch rooms. Format: join <Room Name> or join Room|password.",
        placeholder_quick_room: "Room Name...",
        placeholder_quick_pass: "Password (optional)",
        btn_switch_room: "Switch Room",
        auth_whisper_badge: "🔒 Whisper Command",
        auth_whisper_desc: "Whisper !adminmenu to the bot in-game to view private room administration options.",
        auth_mgmt_badge: "👑 Room Management Whispers",
        auth_mgmt_desc: "Manage room administrators, whitelist, banlist, and kick members directly via private whisper.",
        auth_priv_badge: "🛡️ Privileges & Immunity",
        auth_priv_desc: "Authorized Members have full immunity from bot moderation actions and unrestricted access to all Web Dashboard controls.",
        btn_remove: "Remove",

        // Offline Modal
        offline_modal_title: "Bot Offline / Inactive",
        offline_modal_desc: "The dashboard and remote controls are active only when bot Nava is online and inside a game room.",
        offline_step_web: "🌐 Web Server:",
        offline_step_bot: "🤖 Bot Status:",
        offline_step_room: "🚪 Room Status:",
        offline_val_server_on: "Online (Port 3000)",
        offline_val_bot_conn: "Connected to Game",
        offline_val_bot_disconn: "Disconnected / Offline",
        offline_val_in_room: "Inside Room",
        offline_val_out_room: "Not Joined to Room",
        offline_reconnecting: "Attempting automatic reconnection...",

        // Footer
        footer_text: "Nava Music DJ • Bondage Club Audio Broadcaster & Remote Control Dashboard",

        // Toasts & Prompts
        toast_theme_switched: "Theme switched to",
        toast_lang_switched: "Language switched to English",
        toast_processing_req: 'Processing track request: "{query}"...',
        toast_no_audio: "No audio is currently playing in the room.",
        toast_audio_error: "Unable to play audio:",
        toast_commanding_switch: 'Commanding bot to join "{room}"...',
        toast_bot_offline_action: "Bot is offline or not currently inside a room. Action cancelled.",
        toast_action_success: "Action sent to bot successfully.",
        confirm_remove_admin: "Remove Member #{id} from room administrators?",
        confirm_remove_auth: "Remove Member #{id} from bot authorized members?",
        confirm_kick: "Kick Member #{id} from the room?",
        confirm_stop_music: "Stop music playback in the room?",
        confirm_clear_queue: "Clear the entire music queue?"
    },

    id: {
        // Navbar & Brand
        brand_subtitle: "Audio Ruangan Tersinkronisasi & Kontrol Jarak Jauh Bondage Club",
        room_label: "Ruangan:",
        connecting: "Menghubungkan...",
        status_online: "Online",
        status_outside: "Di Luar Ruangan",
        status_offline: "Offline",
        theme_toggle_title: "Beralih Tema Terang / Gelap",
        lang_select_title: "Pilih Bahasa Antarmuka",

        // Now Playing Card
        now_playing_tag: "SEDANG DIPUTAR",
        no_music_title: "Tidak ada musik yang sedang diputar",
        no_music_sub: "Gunakan panel di bawah atau ketik !play di obrolan ruangan",
        playing_synchronized: "Diputar serentak untuk semua pemain di ruangan",
        radio_playing_sub: "Stasiun Radio 24/7 (Siaran Langsung Online)",
        req_by_label: "Diminta oleh:",
        listen_browser: "Dengarkan di Browser",
        stop_browser: "Hentikan Audio",
        web_player_hint: "Tersinkronisasi dengan audio di dalam ruangan game",
        live_stream: "Langsung",
        live_247: "24/7",
        badge_yt: "Audio YouTube",
        badge_radio: "Radio 24/7",

        // Music Controls Card
        music_controls_tag: "KONTROL PEMUTAR MUSIK",
        remote_control_badge: "Kendali Jarak Jauh",
        label_song_query: "Judul Lagu atau URL (YouTube / .mp3 / .mp4):",
        placeholder_song_query: "Contoh: Linkin Park Numb atau tautan YouTube...",
        label_requester: "Nama Peminta:",
        placeholder_requester: "Nama Anda (Web DJ)",
        btn_play_track: "Putar / Antrekan Lagu",
        btn_skip_track: "Lewati Lagu",
        btn_stop_music: "Hentikan Musik",
        btn_clear_queue: "Kosongkan Antrean",
        radio_stations_label: "Stasiun Radio 24/7:",
        radio_stations_sub: "(Klik untuk langsung memutar)",

        // Room Status Card
        room_status_tag: "STATUS RUANGAN & ANGGOTA",
        label_room_name: "Nama Ruangan",
        label_bot_char: "Karakter Bot",
        label_friends_count: "Jumlah Teman",
        players_in_room_title: "Pemain di Ruangan:",
        players_empty_hint: "Bot sedang menunggu di ruangan, belum ada pemain lain.",
        players_count_suffix: "Pemain",

        // Upcoming Queue Card
        queue_tag: "ANTREAN BERIKUTNYA",
        queue_empty_title: "Antrean Kosong",
        queue_empty_desc: "Gunakan form pemutar atau ketik !play judul di obrolan untuk menambah lagu.",
        queue_req_by: "Diminta:",

        // Room Administration Card
        room_admin_tag: "ADMINISTRASI RUANGAN",
        badge_room_admin: "Admin Ruangan",
        tab_admin: "👑 Admin",
        tab_whitelist: "📜 Whitelist",
        tab_banlist: "🚫 Daftar Blokir",
        tab_kick: "👢 Keluarkan",
        btn_add_admin: "+ Tambah Admin",
        btn_add_whitelist: "+ Tambah ke Whitelist",
        btn_ban_member: "+ Blokir Anggota",
        btn_kick_member: "👢 Keluarkan dari Ruangan",
        admin_list_title: "Daftar Administrator Ruangan:",
        admin_list_empty: "Tidak ada administrator terdaftar.",
        wl_list_title: "Daftar Anggota Whitelist:",
        wl_list_empty: "Whitelist kosong (akses publik terbuka).",
        ban_list_title: "Daftar Anggota Terblokir:",
        ban_list_empty: "Tidak ada anggota yang diblokir.",
        kick_note: "⚠️ Pemain yang dikeluarkan akan langsung terlempar dari ruangan.",
        placeholder_member_id: "Nomor Anggota (contoh: 245253)",
        placeholder_kick_id: "Nomor Anggota yang akan dikeluarkan...",

        // Room Interaction & Expressions Card
        chat_tag: "INTERAKSI RUANGAN & EKSPRESI BOT",
        badge_live_comms: "Komunikasi Langsung",
        placeholder_chat_msg: "Ketik pesan yang akan diucapkan Nava di ruangan...",
        option_emote: "Pesan Emote (*)",
        option_chat: "Obrolan Biasa",
        btn_send_chat: "Kirim",
        expr_label: "Ekspresi Wajah Bot:",
        expr_happy: "😊 Senang",
        expr_wink: "😉 Kedip",
        expr_sing: "🎶 Bernyanyi",
        expr_thinking: "🤔 Berpikir",
        expr_blush: "😳 Tersipu",
        expr_closed: "😌 Pejam Mata",

        // Authorized Members Card
        auth_tag: "ANGGOTA RESMI & PERINTAH KHUSUS",
        auth_add_title: "Tambah Anggota Resmi:",
        btn_add_auth: "+ Tambah Anggota",
        auth_note: "💡 Anggota Resmi memiliki izin mengendalikan bot melalui beep/bisikan game, kebal dari kick/ban, dan akses penuh ke Dashboard Web ini.",
        auth_list_title: "Daftar Anggota Resmi Saat Ini:",
        auth_empty_hint: "Belum ada anggota resmi terdaftar. Tambahkan nomor anggota di atas.",
        auth_commands_title: "⚡ Perintah Anggota Resmi:",
        auth_beep_badge: "📡 Perintah Beep Game",
        auth_beep_desc: "Kirim beep ke Nava (#258115) untuk memerintahkan bot berpindah ruangan. Format: join <Nama Ruangan> atau join Ruangan|password.",
        placeholder_quick_room: "Nama Ruangan...",
        placeholder_quick_pass: "Password (opsional)",
        btn_switch_room: "Pindah Ruangan",
        auth_whisper_badge: "🔒 Perintah Bisikan",
        auth_whisper_desc: "Bisikkan !adminmenu ke bot di dalam game untuk membuka menu administrasi ruangan pribadi.",
        auth_mgmt_badge: "👑 Bisikan Pengelolaan Ruangan",
        auth_mgmt_desc: "Kelola admin, whitelist, daftar blokir, dan keluarkan anggota langsung melalui bisikan pribadi.",
        auth_priv_badge: "🛡️ Hak Istimewa & Kekebalan",
        auth_priv_desc: "Anggota Resmi memiliki kekebalan penuh dari aksi moderasi bot dan akses tanpa batas ke semua kontrol Web Dashboard.",
        btn_remove: "Hapus",

        // Offline Modal
        offline_modal_title: "Bot Sedang Offline / Tidak Aktif",
        offline_modal_desc: "Dashboard dan kontrol jarak jauh hanya aktif saat bot Nava online dan berada di dalam ruangan permainan.",
        offline_step_web: "🌐 Server Web:",
        offline_step_bot: "🤖 Status Bot:",
        offline_step_room: "🚪 Status Ruangan:",
        offline_val_server_on: "Online (Port 3000)",
        offline_val_bot_conn: "Terhubung ke Game",
        offline_val_bot_disconn: "Terputus / Offline",
        offline_val_in_room: "Di Dalam Ruangan",
        offline_val_out_room: "Belum Masuk Ruangan",
        offline_reconnecting: "Mencoba menghubungkan ulang otomatis...",

        // Footer
        footer_text: "Nava Music DJ • Pemutar Audio Ruangan & Dashboard Remote Bondage Club",

        // Toasts & Prompts
        toast_theme_switched: "Tema dialihkan ke",
        toast_lang_switched: "Bahasa dialihkan ke Bahasa Indonesia",
        toast_processing_req: 'Memproses permintaan lagu: "{query}"...',
        toast_no_audio: "Tidak ada audio yang sedang diputar di ruangan.",
        toast_audio_error: "Gagal memutar audio:",
        toast_commanding_switch: 'Memerintahkan bot untuk bergabung ke "{room}"...',
        toast_bot_offline_action: "Bot sedang offline atau belum berada di dalam ruangan. Aksi dibatalkan.",
        toast_action_success: "Aksi berhasil dikirim ke bot.",
        confirm_remove_admin: "Hapus Anggota #{id} dari administrator ruangan?",
        confirm_remove_auth: "Hapus Anggota #{id} dari anggota resmi bot?",
        confirm_kick: "Keluarkan Anggota #{id} dari ruangan?",
        confirm_stop_music: "Hentikan pemutaran musik di dalam ruangan?",
        confirm_clear_queue: "Kosongkan seluruh antrean musik?"
    },

    it: {
        // Navbar & Brand
        brand_subtitle: "Audio Sincronizzato per Stanze e Controllo Remoto Bondage Club",
        room_label: "Stanza:",
        connecting: "Connessione in corso...",
        status_online: "Online",
        status_outside: "Fuori Stanza",
        status_offline: "Offline",
        theme_toggle_title: "Attiva/Disattiva Tema Chiaro o Scuro",
        lang_select_title: "Seleziona la Lingua dell'Interfaccia",

        // Now Playing Card
        now_playing_tag: "IN RIPRODUZIONE",
        no_music_title: "Nessun brano in riproduzione",
        no_music_sub: "Usa i comandi sottostanti o digita !play nella chat della stanza",
        playing_synchronized: "In riproduzione sincronizzata per tutti nella stanza",
        radio_playing_sub: "Stazione Radio 24/7 (Streaming Online)",
        req_by_label: "Richiesto da:",
        listen_browser: "Ascolta nel Browser",
        stop_browser: "Ferma Audio",
        web_player_hint: "Sincronizzato con l'audio della stanza di gioco",
        live_stream: "Diretta",
        live_247: "24/7",
        badge_yt: "Audio YouTube",
        badge_radio: "Radio 24/7",

        // Music Controls Card
        music_controls_tag: "CONTROLLI DEL LETTORE MUSICALE",
        remote_control_badge: "Controllo Remoto",
        label_song_query: "Titolo del Brano o URL (YouTube / .mp3 / .mp4):",
        placeholder_song_query: "Es. Linkin Park Numb o link YouTube...",
        label_requester: "Nome Richiedente:",
        placeholder_requester: "Il Tuo Nome (Web DJ)",
        btn_play_track: "Riproduci / Metti in Coda",
        btn_skip_track: "Salta Brano",
        btn_stop_music: "Ferma Musica",
        btn_clear_queue: "Svuota Coda",
        radio_stations_label: "Stazioni Radio 24/7:",
        radio_stations_sub: "(Clicca per riprodurre all'istante)",

        // Room Status Card
        room_status_tag: "STATO DELLA STANZA E MEMBRI",
        label_room_name: "Nome Stanza",
        label_bot_char: "Personaggio Bot",
        label_friends_count: "Numero Amici",
        players_in_room_title: "Giocatori nella Stanza:",
        players_empty_hint: "Il bot è in attesa nella stanza, nessun altro giocatore presente.",
        players_count_suffix: "Giocatori",

        // Upcoming Queue Card
        queue_tag: "PROSSIMI IN CODA",
        queue_empty_title: "La Coda è Vuota",
        queue_empty_desc: "Usa il modulo del lettore o digita !play titolo nella chat della stanza.",
        queue_req_by: "Richiesto da:",

        // Room Administration Card
        room_admin_tag: "AMMINISTRAZIONE DELLA STANZA",
        badge_room_admin: "Amministratore Stanza",
        tab_admin: "👑 Amministratori",
        tab_whitelist: "📜 Whitelist",
        tab_banlist: "🚫 Lista Ban",
        tab_kick: "👢 Espelli",
        btn_add_admin: "+ Aggiungi Amministratore",
        btn_add_whitelist: "+ Aggiungi a Whitelist",
        btn_ban_member: "+ Banna Membro",
        btn_kick_member: "👢 Espelli dalla Stanza",
        admin_list_title: "Elenco Amministratori Stanza:",
        admin_list_empty: "Nessun amministratore registrato.",
        wl_list_title: "Membri nella Whitelist:",
        wl_list_empty: "La whitelist è vuota (accesso pubblico consentito).",
        ban_list_title: "Elenco Membri Bannati:",
        ban_list_empty: "Nessun membro bannato.",
        kick_note: "⚠️ I giocatori espulsi verranno rimossi immediatamente dalla stanza.",
        placeholder_member_id: "Numero Membro (es. 245253)",
        placeholder_kick_id: "Numero Membro da espellere...",

        // Room Interaction & Expressions Card
        chat_tag: "INTERAZIONE NELLA STANZA ED ESPRESSIONI",
        badge_live_comms: "Comunicazione Live",
        placeholder_chat_msg: "Digita un messaggio che Nava pronuncerà nella stanza...",
        option_emote: "Messaggio Emote (*)",
        option_chat: "Chat Normale",
        btn_send_chat: "Invia",
        expr_label: "Espressioni Facciali del Bot:",
        expr_happy: "😊 Felice",
        expr_wink: "😉 Occhiolino",
        expr_sing: "🎶 Canta",
        expr_thinking: "🤔 Riflessiva",
        expr_blush: "😳 Timida",
        expr_closed: "😌 Occhi Chiusi",

        // Authorized Members Card
        auth_tag: "MEMBRI AUTORIZZATI E COMANDI",
        auth_add_title: "Aggiungi Membro Autorizzato:",
        btn_add_auth: "+ Aggiungi Membro",
        auth_note: "💡 I Membri Autorizzati possono comandare il bot tramite beep/sussurri in gioco, godono di immunità da kick/ban e hanno pieno accesso a questa Web Dashboard.",
        auth_list_title: "Membri Autorizzati Attuali:",
        auth_empty_hint: "Nessun membro autorizzato registrato. Aggiungi un numero membro sopra.",
        auth_commands_title: "⚡ Comandi Membri Autorizzati:",
        auth_beep_badge: "📡 Comando Beep in Gioco",
        auth_beep_desc: "Invia un beep a Nava (#258115) per ordinare il cambio di stanza. Formato: join <Nome Stanza> oppure join Stanza|password.",
        placeholder_quick_room: "Nome Stanza...",
        placeholder_quick_pass: "Password (opzionale)",
        btn_switch_room: "Cambia Stanza",
        auth_whisper_badge: "🔒 Comando Sussurro",
        auth_whisper_desc: "Sussurra !adminmenu al bot in gioco per visualizzare le opzioni di amministrazione della stanza privata.",
        auth_mgmt_badge: "👑 Sussurri Gestione Stanza",
        auth_mgmt_desc: "Gestisci amministratori, whitelist, lista ban ed espelli membri direttamente tramite sussurri privati.",
        auth_priv_badge: "🛡️ Privilegi e Immunità",
        auth_priv_desc: "I Membri Autorizzati godono di piena immunità dalle azioni di moderazione del bot e accesso illimitato a tutti i controlli.",
        btn_remove: "Rimuovi",

        // Offline Modal
        offline_modal_title: "Bot Offline / Inattivo",
        offline_modal_desc: "La dashboard e i comandi remoti sono attivi solo quando il bot Nava è online e all'interno di una stanza di gioco.",
        offline_step_web: "🌐 Server Web:",
        offline_step_bot: "🤖 Stato Bot:",
        offline_step_room: "🚪 Stato Stanza:",
        offline_val_server_on: "Online (Porta 3000)",
        offline_val_bot_conn: "Connesso al Gioco",
        offline_val_bot_disconn: "Disconnesso / Offline",
        offline_val_in_room: "Nella Stanza",
        offline_val_out_room: "Non nella Stanza",
        offline_reconnecting: "Tentativo di riconnessione automatica in corso...",

        // Footer
        footer_text: "Nava Music DJ • Trasmettitore Audio Stanze e Dashboard Remota Bondage Club",

        // Toasts & Prompts
        toast_theme_switched: "Tema passato a",
        toast_lang_switched: "Lingua impostata su Italiano",
        toast_processing_req: 'Elaborazione richiesta brano: "{query}"...',
        toast_no_audio: "Nessun brano è attualmente in riproduzione nella stanza.",
        toast_audio_error: "Impossibile riprodurre l'audio:",
        toast_commanding_switch: 'Ordine inviato al bot per entrare in "{room}"...',
        toast_bot_offline_action: "Il bot è offline o non si trova in una stanza. Azione annullata.",
        toast_action_success: "Azione inviata al bot con successo.",
        confirm_remove_admin: "Rimuovere il Membro #{id} dagli amministratori della stanza?",
        confirm_remove_auth: "Rimuovere il Membro #{id} dai membri autorizzati del bot?",
        confirm_kick: "Espellere il Membro #{id} dalla stanza?",
        confirm_stop_music: "Fermare la riproduzione musicale nella stanza?",
        confirm_clear_queue: "Cancellare l'intera coda musicale?"
    }
};

const FLAG_SVGS = {
    en: `<svg class="flag-icon" viewBox="0 0 60 30" width="22" height="15" aria-hidden="true"><clipPath id="uk-clip-s"><path d="M0,0 v30 h60 v-30 z"/></clipPath><clipPath id="uk-clip-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><g clip-path="url(#uk-clip-s)"><path d="M0,0 v30 h60 v-30 z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#uk-clip-t)" stroke="#C8102E" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></g></svg>`,
    id: `<svg class="flag-icon" viewBox="0 0 640 480" width="22" height="15" aria-hidden="true"><rect width="640" height="240" fill="#e11d48"/><rect y="240" width="640" height="240" fill="#ffffff"/></svg>`,
    it: `<svg class="flag-icon" viewBox="0 0 3 2" width="22" height="15" aria-hidden="true"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#ffffff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>`
};

let currentLanguage = "en";

/**
 * Returns translated string for given key, falling back to English or key itself
 */
function t(key, params = {}) {
    const langDict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    let text = langDict[key] || TRANSLATIONS.en[key] || key;

    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
    return text;
}

/**
 * Applies the selected language across all static DOM elements and re-renders
 */
function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = "en";
    currentLanguage = lang;
    localStorage.setItem("nava_lang", lang);
    document.documentElement.lang = lang;

    // 1. Text Content
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (key) {
            el.textContent = t(key);
        }
    });

    // 2. Placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key) {
            el.placeholder = t(key);
        }
    });

    // 3. Titles / Tooltips
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.getAttribute("data-i18n-title");
        if (key) {
            el.title = t(key);
        }
    });

    // 4. Aria Labels
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
        const key = el.getAttribute("data-i18n-aria");
        if (key) {
            el.setAttribute("aria-label", t(key));
        }
    });

    // 5. Update Custom Flag Dropdown UI
    const currentFlagEl = document.getElementById("current-lang-flag");
    const currentCodeEl = document.getElementById("current-lang-code");
    if (currentFlagEl && FLAG_SVGS[lang]) {
        currentFlagEl.innerHTML = FLAG_SVGS[lang];
    }
    if (currentCodeEl) {
        currentCodeEl.textContent = lang.toUpperCase();
    }

    document.querySelectorAll(".lang-option").forEach(opt => {
        const optLang = opt.getAttribute("data-lang");
        const isSelected = optLang === lang;
        opt.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    // Fallback select element if present
    const langSelect = document.getElementById("lang-select");
    if (langSelect && langSelect.value !== lang) {
        langSelect.value = lang;
    }

    // Refresh dynamic status elements
    if (typeof refreshDynamicI18n === "function") {
        refreshDynamicI18n();
    }
}

/**
 * Initializes i18n from localStorage or browser preferences
 */
function initI18n() {
    const saved = localStorage.getItem("nava_lang");
    if (saved && TRANSLATIONS[saved]) {
        currentLanguage = saved;
    } else {
        const navLang = (navigator.language || "").toLowerCase();
        if (navLang.startsWith("id")) {
            currentLanguage = "id";
        } else if (navLang.startsWith("it")) {
            currentLanguage = "it";
        } else {
            currentLanguage = "en";
        }
    }

    setLanguage(currentLanguage);

    // Custom Flag Dropdown Controller
    const menuBtn = document.getElementById("lang-menu-btn");
    const menuList = document.getElementById("lang-menu-list");
    const options = document.querySelectorAll(".lang-option");

    if (menuBtn && menuList) {
        // Toggle dropdown open/close
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = !menuList.classList.contains("hidden");
            if (isOpen) {
                closeLangMenu();
            } else {
                openLangMenu();
            }
        });

        function openLangMenu() {
            menuList.classList.remove("hidden");
            menuBtn.setAttribute("aria-expanded", "true");
            const selectedOpt = menuList.querySelector('.lang-option[aria-selected="true"]') || options[0];
            if (selectedOpt) selectedOpt.focus();
        }

        function closeLangMenu() {
            menuList.classList.add("hidden");
            menuBtn.setAttribute("aria-expanded", "false");
        }

        // Option selection handlers
        options.forEach((opt, idx) => {
            opt.addEventListener("click", (e) => {
                e.stopPropagation();
                const nextLang = opt.getAttribute("data-lang");
                if (nextLang && nextLang !== currentLanguage) {
                    setLanguage(nextLang);
                    if (typeof showToast === "function") {
                        showToast(t("toast_lang_switched"), "info");
                    }
                }
                closeLangMenu();
                menuBtn.focus();
            });

            opt.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    opt.click();
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const nextOpt = options[idx + 1] || options[0];
                    if (nextOpt) nextOpt.focus();
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const prevOpt = options[idx - 1] || options[options.length - 1];
                    if (prevOpt) prevOpt.focus();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeLangMenu();
                    menuBtn.focus();
                }
            });
        });

        // Close when clicking outside
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".lang-dropdown-wrapper")) {
                closeLangMenu();
            }
        });

        // Close on Escape from button
        menuBtn.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openLangMenu();
            } else if (e.key === "Escape") {
                closeLangMenu();
            }
        });
    }

    // Legacy fallback select element if present
    const langSelect = document.getElementById("lang-select");
    if (langSelect) {
        langSelect.value = currentLanguage;
        langSelect.addEventListener("change", (e) => {
            const nextLang = e.target.value;
            setLanguage(nextLang);
            if (typeof showToast === "function") {
                showToast(t("toast_lang_switched"), "info");
            }
        });
    }
}

