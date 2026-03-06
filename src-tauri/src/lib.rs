use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
    Migration {
      version: 1,
      description: "create_initial_tables",
      sql: "
      CREATE TABLE IF NOT EXISTS subjects(id TEXT PRIMARY KEY, name TEXT, cover_path TEXT NULL, pinned INT, created_at TEXT, last_studied_at TEXT NULL, total_minutes INT);
      CREATE TABLE IF NOT EXISTS tags(id TEXT PRIMARY KEY, name TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS subject_tags(subject_id TEXT, tag_id TEXT, PRIMARY KEY(subject_id, tag_id), FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE, FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS subgoals(id TEXT PRIMARY KEY, subject_id TEXT, text TEXT, done INT, created_at TEXT, FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, started_at TEXT, ended_at TEXT NULL, template TEXT, repeats INT, planned_minutes INT, actual_minutes INT);
      CREATE TABLE IF NOT EXISTS session_blocks(id TEXT PRIMARY KEY, session_id TEXT, idx INT, type TEXT, minutes INT, subject_id TEXT NULL, technique_id TEXT NULL, started_at TEXT NULL, ended_at TEXT NULL, FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE);
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "create_quotes_table",
      sql: "
      CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY, text TEXT NOT NULL, idx INT NOT NULL DEFAULT 0);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_1', 'Let''s do our best today! ✨', 0);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_2', 'You''re doing amazing! 💖', 1);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_3', 'Keep going, you got this! 🌟', 2);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_4', 'Every minute counts! ⏰', 3);
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "create_mechanic_logs_table",
      sql: "
      CREATE TABLE IF NOT EXISTS mechanic_logs(
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        retention TEXT,
        focus_drop TEXT,
        memorization_align TEXT,
        mechanical_fix TEXT
      );
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "migrate_to_metacognition_logs",
      sql: "
      DROP TABLE IF EXISTS mechanic_logs;
      CREATE TABLE IF NOT EXISTS metacognition_logs(
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        retention TEXT,
        focus_drop TEXT,
        memorization_align TEXT,
        mechanical_fix TEXT
      );
      ",
      kind: MigrationKind::Up,
    }
  ];

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:study_buddy.db", migrations)
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
